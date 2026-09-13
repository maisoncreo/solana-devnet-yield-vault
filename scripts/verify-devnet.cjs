const a=require('@coral-xyz/anchor');
const fs=require('fs');
(async()=>{
 const c=new a.web3.Connection('https://api.devnet.solana.com','confirmed');
 const d=JSON.parse(fs.readFileSync('deployment.json'));
 const p=new a.Program(JSON.parse(fs.readFileSync('target/idl/defi_vault.json')),{connection:c});
 const v=await p.account.vault.fetch(new a.web3.PublicKey(d.vault));
 const statuses=await c.getSignatureStatuses(Object.values(d.transactions),{searchTransactionHistory:true});
 if(statuses.value.some(s=>!s||s.err||!['confirmed','finalized'].includes(s.confirmationStatus)))throw Error('Unconfirmed or failed transaction');
 if(v.totalAssets.toString()!=='55000000'||v.totalShares.toString()!=='50000000')throw Error('Unexpected vault state');
 console.log(JSON.stringify({assets:v.totalAssets.toString(),shares:v.totalShares.toString(),transactions:statuses.value.map(s=>s.confirmationStatus)}));
})().catch(e=>{console.error(e);process.exitCode=1});
