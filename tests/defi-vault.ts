import * as anchor from '@coral-xyz/anchor';
import { strict as assert } from 'assert';
import { createMint, getOrCreateAssociatedTokenAccount, mintTo, getAccount, transfer } from '@solana/spl-token';
const { PublicKey, Keypair, SystemProgram } = anchor.web3;

describe('Vault transactions', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.DefiVault as anchor.Program<any>;
  const payer = (provider.wallet as anchor.Wallet).payer;
  let mint: anchor.web3.PublicKey, userToken: anchor.web3.PublicKey, vault: anchor.web3.PublicKey, vaultToken: anchor.web3.PublicKey, position: anchor.web3.PublicKey;
  const bn = (n: number) => new anchor.BN(n);
  const tokenProgram = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
  const state = () => (program.account as any).vault.fetch(vault);
  const accounts = () => ({user: payer.publicKey, mint, vault, vaultToken, position, userToken, tokenProgram, systemProgram: SystemProgram.programId});
  const deposit = (n: number, min = 1) => program.methods.deposit(bn(n), bn(min)).accountsStrict(accounts()).rpc();
  const withdraw = (n: number, min = 1) => {const {systemProgram, ...a} = accounts(); return program.methods.withdraw(bn(n), bn(min)).accountsStrict(a).rpc();};
  const yieldTo = (n: number) => program.methods.addYield(bn(n)).accountsStrict({admin:payer.publicKey,mint,vault,vaultToken,adminToken:userToken,tokenProgram}).rpc();
  async function rejected(fn: () => Promise<any>, code: string) {
    const before = await state();
    const beforeTokens = (await getAccount(provider.connection, vaultToken)).amount;
    const beforeUserTokens = (await getAccount(provider.connection, userToken)).amount;
    const beforePosition = await (program.account as any).userPosition.fetchNullable(position);
    try { await fn(); assert.fail('Expected transaction rejection'); }
    catch(e:any) { assert.equal(e.error?.errorCode?.code, code, String(e)); }
    const after = await state();
    assert.equal(after.totalAssets.toString(), before.totalAssets.toString());
    assert.equal(after.totalShares.toString(), before.totalShares.toString());
    assert.equal((await getAccount(provider.connection, vaultToken)).amount, beforeTokens);
    assert.equal((await getAccount(provider.connection, userToken)).amount, beforeUserTokens);
    const afterPosition = await (program.account as any).userPosition.fetchNullable(position);
    assert.equal(afterPosition?.shares.toString(), beforePosition?.shares.toString());
  }
  before(async () => {
    mint = await createMint(provider.connection,payer,payer.publicKey,null,6);
    userToken = (await getOrCreateAssociatedTokenAccount(provider.connection,payer,mint,payer.publicKey)).address;
    await mintTo(provider.connection,payer,mint,userToken,payer,1_000_000);
    vault = PublicKey.findProgramAddressSync([Buffer.from('vault'),payer.publicKey.toBuffer(),mint.toBuffer()],program.programId)[0];
    vaultToken = PublicKey.findProgramAddressSync([Buffer.from('tokens'),vault.toBuffer()],program.programId)[0];
    position = PublicKey.findProgramAddressSync([Buffer.from('position'),vault.toBuffer(),payer.publicKey.toBuffer()],program.programId)[0];
  });
  it('initializes a vault with zero assets',async()=>{
    await program.methods.initializeVault(bn(100_000)).accountsStrict({admin:payer.publicKey,mint,vault,vaultToken,tokenProgram,systemProgram:SystemProgram.programId}).rpc();
    assert.equal((await state()).totalAssets.toString(),'0');
  });
  it('rejects yield without depositors atomically',async()=>rejected(()=>yieldTo(100),'EmptyVault'));
  it('rejects zero deposit atomically',async()=>rejected(()=>deposit(0),'ZeroAmount'));
  it('first deposit creates shares 1:1',async()=>{await deposit(1000); assert.equal((await state()).totalShares.toString(),'1000');});
  it('admin yield increases assets without shares',async()=>{await yieldTo(100); const s=await state(); assert.equal(s.totalAssets.toString(),'1100'); assert.equal(s.totalShares.toString(),'1000');});
  it('second deposit uses current share price',async()=>{await deposit(110); assert.equal((await state()).totalShares.toString(),'1100');});
  it('rejects deposit slippage atomically',async()=>rejected(()=>deposit(110,101),'Slippage'));
  it('rejects yield from a different admin',async()=>{
    const attacker=Keypair.generate();
    await rejected(()=>program.methods.addYield(bn(1)).accountsStrict({admin:attacker.publicKey,mint,vault,vaultToken,adminToken:userToken,tokenProgram}).signers([attacker]).rpc(),'ConstraintSeeds');
  });
  it('rejects a token account owned by another user',async()=>{
    const other=Keypair.generate();
    const otherToken=(await getOrCreateAssociatedTokenAccount(provider.connection,payer,mint,other.publicKey)).address;
    await rejected(()=>program.methods.deposit(bn(10),bn(1)).accountsStrict({...accounts(),userToken:otherToken}).rpc(),'ConstraintTokenOwner');
  });
  it('rejects a different mint token account',async()=>{
    const otherMint=await createMint(provider.connection,payer,payer.publicKey,null,6);
    const otherToken=(await getOrCreateAssociatedTokenAccount(provider.connection,payer,otherMint,payer.publicKey)).address;
    await rejected(()=>program.methods.deposit(bn(10),bn(1)).accountsStrict({...accounts(),userToken:otherToken}).rpc(),'ConstraintTokenMint');
  });
  it('rejects capacity overflow atomically' ,async()=>rejected(()=>deposit(100_000),'Capacity'));
  it('rejects excessive withdrawal atomically',async()=>rejected(()=>withdraw(1101),'InsufficientShares'));
  it('rejects withdrawal slippage atomically',async()=>rejected(()=>withdraw(100,111),'Slippage'));
  it('ignores direct donations in share price',async()=>{await transfer(provider.connection,payer,userToken,vaultToken,payer,100); assert.equal((await state()).totalAssets.toString(),'1210');});
  it('withdraws principal plus yield',async()=>{const before=(await getAccount(provider.connection,userToken)).amount; await withdraw(1100,1210); assert.equal((await getAccount(provider.connection,userToken)).amount-before,1210n); assert.equal((await state()).totalShares.toString(),'0'); assert.equal((await state()).totalAssets.toString(),'0');});
  it('reopens empty vault at 1:1 despite surplus',async()=>{await deposit(100); assert.equal((await state()).totalShares.toString(),'100');});
});
