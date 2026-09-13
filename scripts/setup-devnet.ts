import * as anchor from '@coral-xyz/anchor';
import {createMint,getOrCreateAssociatedTokenAccount,mintTo,TOKEN_PROGRAM_ID} from '@solana/spl-token';
import fs from 'fs';
async function main(){
 const provider=anchor.AnchorProvider.env();
 if(await provider.connection.getGenesisHash()!=='EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG')throw Error('This script only permits Solana Devnet');
 if(fs.existsSync('deployment.json'))throw Error('deployment.json already exists; refusing to create another vault');
 anchor.setProvider(provider);const program=anchor.workspace.DefiVault as anchor.Program<any>;
 const payer=(provider.wallet as anchor.Wallet).payer;
 const mint=await createMint(provider.connection,payer,payer.publicKey,null,6);
 const userToken=(await getOrCreateAssociatedTokenAccount(provider.connection,payer,mint,payer.publicKey)).address;
 const mintTx=await mintTo(provider.connection,payer,mint,userToken,payer,1_000_000_000);
 const vault=anchor.web3.PublicKey.findProgramAddressSync([Buffer.from('vault'),payer.publicKey.toBuffer(),mint.toBuffer()],program.programId)[0];
 const vaultToken=anchor.web3.PublicKey.findProgramAddressSync([Buffer.from('tokens'),vault.toBuffer()],program.programId)[0];
 const position=anchor.web3.PublicKey.findProgramAddressSync([Buffer.from('position'),vault.toBuffer(),payer.publicKey.toBuffer()],program.programId)[0];
 const initialize=await program.methods.initializeVault(new anchor.BN(1_000_000_000_000)).accountsStrict({admin:payer.publicKey,mint,vault,vaultToken,tokenProgram:TOKEN_PROGRAM_ID,systemProgram:anchor.web3.SystemProgram.programId}).rpc();
 const config={cluster:'devnet',programId:program.programId.toBase58(),mint:mint.toBase58(),admin:payer.publicKey.toBase58(),vault:vault.toBase58(),decimals:6,transactions:{mintTx,initialize} as Record<string,string>};
 fs.writeFileSync('deployment.json',JSON.stringify(config,null,2));
 const accounts={user:payer.publicKey,mint,vault,vaultToken,position,userToken,tokenProgram:TOKEN_PROGRAM_ID};
 config.transactions.deposit=await program.methods.deposit(new anchor.BN(100_000_000),new anchor.BN(100_000_000)).accountsStrict({...accounts,systemProgram:anchor.web3.SystemProgram.programId}).rpc();
 fs.writeFileSync('deployment.json',JSON.stringify(config,null,2));
 config.transactions.addYield=await program.methods.addYield(new anchor.BN(10_000_000)).accountsStrict({admin:payer.publicKey,mint,vault,vaultToken,adminToken:userToken,tokenProgram:TOKEN_PROGRAM_ID}).rpc();
 fs.writeFileSync('deployment.json',JSON.stringify(config,null,2));
 config.transactions.withdraw=await program.methods.withdraw(new anchor.BN(50_000_000),new anchor.BN(55_000_000)).accountsStrict(accounts).rpc();
 fs.writeFileSync('deployment.json',JSON.stringify(config,null,2));
 console.log('Saved deployment.json with confirmed Devnet transaction signatures');
}
main().catch(e=>{console.error(e);process.exitCode=1});
