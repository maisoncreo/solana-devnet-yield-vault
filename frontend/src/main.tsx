import './polyfills';
import {Buffer} from 'buffer';
import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ConnectionProvider, WalletProvider, useAnchorWallet, useConnection} from '@solana/wallet-adapter-react';
import {WalletModalProvider, WalletMultiButton} from '@solana/wallet-adapter-react-ui';
import {AnchorProvider, BN, Program, Idl} from '@coral-xyz/anchor';
import {PublicKey, SystemProgram, Transaction} from '@solana/web3.js';
import {getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction, TOKEN_PROGRAM_ID} from '@solana/spl-token';
import '@solana/wallet-adapter-react-ui/styles.css';
import './style.css';
const RPC = 'https://api.devnet.solana.com';
type Config = {programId:string; mint:string; admin:string; decimals:number};
const format = (n:bigint,d=6) => {const s=n.toString().padStart(d+1,'0'); return d ? `${s.slice(0,-d)}.${s.slice(-d)}` : s;};
function parse(s:string,d:number) {if(!/^\d+(\.\d+)?$/.test(s)) throw Error('Введите положительное число'); const [a,b='']=s.split('.'); if(b.length>d) throw Error(`Максимум ${d} знаков после запятой`); const n=BigInt(a+b.padEnd(d,'0')); if(n<=0n||n>18446744073709551615n)throw Error('Сумма вне допустимого диапазона');return n;}
function App(){
 const wallet=useAnchorWallet(); const {connection}=useConnection();
 const [config,setConfig]=useState<Config|null>(null),[idl,setIdl]=useState<Idl|null>(null);
 const [status,setStatus]=useState('Загрузка конфигурации…'),[busy,setBusy]=useState(false),[amount,setAmount]=useState('10'),[sig,setSig]=useState('');
 const [data,setData]=useState({assets:0n,shares:0n,mine:0n});
 useEffect(()=>{Promise.all([fetch('/deployment.json').then(r=>{if(!r.ok)throw Error();return r.json()}),fetch('/defi_vault.json').then(r=>{if(!r.ok)throw Error();return r.json()})]).then(([c,i])=>{setConfig(c);setIdl(i);setStatus('Подключите кошелёк в Devnet')}).catch(()=>setStatus('Программа ещё не развёрнута. Конфигурация появится после Devnet deployment.'));},[]);
 function client(){if(!wallet||!config||!idl)throw Error('Подключите кошелёк и загрузите конфигурацию');const program=new Program(idl,new AnchorProvider(connection,wallet,{commitment:'confirmed'}));if(program.programId.toBase58()!==config.programId)throw Error('Program ID не совпадает с IDL');const mint=new PublicKey(config.mint);const vault=PublicKey.findProgramAddressSync([Buffer.from('vault'),new PublicKey(config.admin).toBuffer(),mint.toBuffer()],program.programId)[0];const vaultToken=PublicKey.findProgramAddressSync([Buffer.from('tokens'),vault.toBuffer()],program.programId)[0];const position=PublicKey.findProgramAddressSync([Buffer.from('position'),vault.toBuffer(),wallet.publicKey.toBuffer()],program.programId)[0];const userToken=getAssociatedTokenAddressSync(mint,wallet.publicKey);return {program,mint,vault,vaultToken,position,userToken};}
 async function refresh(){
  if(!config||!idl)return;
  const program=new Program(idl,{connection});
  const mint=new PublicKey(config.mint);
  const vault=PublicKey.findProgramAddressSync([Buffer.from('vault'),new PublicKey(config.admin).toBuffer(),mint.toBuffer()],program.programId)[0];
  const v=await (program.account as any).vault.fetch(vault);
  let mine=0n;
  if(wallet){const position=PublicKey.findProgramAddressSync([Buffer.from('position'),vault.toBuffer(),wallet.publicKey.toBuffer()],program.programId)[0];const p=await (program.account as any).userPosition.fetchNullable(position);mine=BigInt(p?.shares.toString()??'0');}
  setData({assets:BigInt(v.totalAssets.toString()),shares:BigInt(v.totalShares.toString()),mine});
 }

 useEffect(()=>{setData({assets:0n,shares:0n,mine:0n});refresh().catch(e=>setStatus(String(e.message)));},[wallet?.publicKey.toBase58(),config,idl]);
 async function run(op:'deposit'|'withdraw'|'addYield'){
  setBusy(true);setSig('');
  try{
   const c=client();if(!wallet||!config)throw Error('Кошелёк не подключён');
   const n=parse(amount,config.decimals);const v=await (c.program.account as any).vault.fetch(c.vault);const assets=BigInt(v.totalAssets.toString()),shares=BigInt(v.totalShares.toString());
   const quote=op==='deposit'?(shares===0n?n:n*shares/assets):op==='withdraw'?(shares===0n?0n:n*assets/shares):n;
   if(quote===0n)throw Error('Сумма слишком мала');const min=quote*995n/1000n||1n;
   const base={user:wallet.publicKey,mint:c.mint,vault:c.vault,vaultToken:c.vaultToken,position:c.position,userToken:c.userToken,tokenProgram:TOKEN_PROGRAM_ID};
   const instruction=op==='deposit'?await c.program.methods.deposit(new BN(n.toString()),new BN(min.toString())).accountsStrict({...base,systemProgram:SystemProgram.programId}).instruction():op==='withdraw'?await c.program.methods.withdraw(new BN(n.toString()),new BN(min.toString())).accountsStrict(base).instruction():await c.program.methods.addYield(new BN(n.toString())).accountsStrict({admin:wallet.publicKey,mint:c.mint,vault:c.vault,vaultToken:c.vaultToken,adminToken:c.userToken,tokenProgram:TOKEN_PROGRAM_ID}).instruction();
   const latest=await connection.getLatestBlockhash('confirmed');const tx=new Transaction({...latest,feePayer:wallet.publicKey});tx.add(createAssociatedTokenAccountIdempotentInstruction(wallet.publicKey,c.userToken,wallet.publicKey,c.mint));tx.add(instruction);
   setStatus('Ожидается подпись в кошельке');const signed=await wallet.signTransaction(tx);setStatus('Отправка транзакции');const signature=await connection.sendRawTransaction(signed.serialize());setSig(signature);setStatus('Транзакция отправлена. Ожидается подтверждение');
   const result=await connection.confirmTransaction({signature,...latest},'confirmed');if(result.value.err)throw Error(JSON.stringify(result.value.err));setStatus('Транзакция подтверждена');try{await refresh();}catch{setStatus('Транзакция подтверждена, но обновить балансы не удалось. Проверьте Explorer.');}
  }catch(e:any){setStatus(`Операция не завершена: ${e.message}. Если есть ссылка на транзакцию, проверьте её статус перед повтором.`);}finally{setBusy(false);}
 }
 return <main><header><a className="brand" href="#">◈ VAULT LAB</a><span className="network">● SOLANA DEVNET</span><WalletMultiButton/></header><section className="hero"><p className="eyebrow">УЧЕБНЫЙ DEFI-ПРОЕКТ</p><h1>Внесите токены.<br/><em>Следите за своей долей.</em></h1><p>Доходность для демонстрации поступает из переводов администратора. Здесь используются только тестовые токены.</p></section><section className="stats"><article><small>Активы хранилища</small><strong>{format(data.assets,config?.decimals)}</strong><span>DEV-USDC</span></article><article><small>Всего долей</small><strong>{format(data.shares,config?.decimals)}</strong><span>vault shares</span></article><article><small>Ваши доли</small><strong>{format(data.mine,config?.decimals)}</strong><span>Оценка: {format(data.shares?data.mine*data.assets/data.shares:0n,config?.decimals)} DEV-USDC</span></article></section><section className="panel"><div><h2>Управление позицией</h2><p>Для внесения укажите количество DEV-USDC. Для вывода — количество долей. Минимальный результат защищён допуском 0,5%.</p></div><div><label htmlFor="amount">Количество токенов / долей</label><input id="amount" value={amount} onChange={e=>setAmount(e.target.value)} inputMode="decimal" disabled={busy}/><div className="actions"><button disabled={busy||!wallet||!config} onClick={()=>run('deposit')}>Внести токены</button><button className="secondary" disabled={busy||!wallet||!config} onClick={()=>run('withdraw')}>Вывести доли</button></div>{wallet&&config&&wallet.publicKey.toBase58()===config.admin&&<button className="secondary" disabled={busy} onClick={()=>run('addYield')}>Добавить тестовую доходность</button>}</div></section><aside role="status" aria-live="polite">{status}{sig&&<p><a target="_blank" rel="noreferrer" href={`https://explorer.solana.com/tx/${sig}?cluster=devnet`}>Посмотреть транзакцию ↗</a></p>}</aside><footer>Без гарантированной ставки · Без комиссии протокола · Только Devnet</footer></main>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><ConnectionProvider endpoint={RPC}><WalletProvider wallets={[]} autoConnect><WalletModalProvider><App/></WalletModalProvider></WalletProvider></ConnectionProvider></React.StrictMode>);
