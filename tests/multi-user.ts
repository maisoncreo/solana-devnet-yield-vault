import * as anchor from '@coral-xyz/anchor';
import { strict as assert } from 'assert';
import { createMint, getOrCreateAssociatedTokenAccount, mintTo, getAccount, TOKEN_PROGRAM_ID } from '@solana/spl-token';
const {PublicKey, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction} = anchor.web3;

describe('Independent depositors', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.DefiVault as anchor.Program<any>;
  const admin = (provider.wallet as anchor.Wallet).payer;
  const alice = Keypair.generate(), bob = Keypair.generate();
  const bn = (n:number) => new anchor.BN(n);
  let mint: anchor.web3.PublicKey, vault: anchor.web3.PublicKey, vaultToken: anchor.web3.PublicKey;
  let adminToken: anchor.web3.PublicKey;
  const tokens = new Map<string, anchor.web3.PublicKey>();
  const position = (user: anchor.web3.Keypair) => PublicKey.findProgramAddressSync([Buffer.from('position'),vault.toBuffer(),user.publicKey.toBuffer()], program.programId)[0];
  const accounts = (user: anchor.web3.Keypair) => ({user:user.publicKey,mint,vault,vaultToken,position:position(user),userToken:tokens.get(user.publicKey.toBase58())!,tokenProgram:TOKEN_PROGRAM_ID});
  const deposit = (user:anchor.web3.Keypair, amount:number) => program.methods.deposit(bn(amount),bn(1)).accountsStrict({...accounts(user),systemProgram:SystemProgram.programId}).signers([user]).rpc();
  const withdraw = (user:anchor.web3.Keypair, shares:number, amount:number) => program.methods.withdraw(bn(shares),bn(amount)).accountsStrict(accounts(user)).signers([user]).rpc();
  const balance = async (address:anchor.web3.PublicKey) => (await getAccount(provider.connection,address)).amount;
  const shares = async (user:anchor.web3.Keypair) => (await (program.account as any).userPosition.fetch(position(user))).shares.toString();
  async function snapshot() {
    const state = await (program.account as any).vault.fetch(vault);
    return {assets:state.totalAssets.toString(), totalShares:state.totalShares.toString(), vaultTokens:await balance(vaultToken),aliceTokens:await balance(accounts(alice).userToken),bobTokens:await balance(accounts(bob).userToken),aliceShares:await shares(alice),bobShares:await shares(bob)};
  }
  before(async () => {
    await sendAndConfirmTransaction(provider.connection, new Transaction().add(...[alice,bob].map(user=>SystemProgram.transfer({fromPubkey:admin.publicKey,toPubkey:user.publicKey,lamports:100_000_000}))),[admin]);
    mint=await createMint(provider.connection,admin,admin.publicKey,null,6);
    for(const user of [admin,alice,bob]) {
      const ata=(await getOrCreateAssociatedTokenAccount(provider.connection,admin,mint,user.publicKey)).address;
      tokens.set(user.publicKey.toBase58(),ata);
      await mintTo(provider.connection,admin,mint,ata,admin,10_000);
    }
    adminToken=tokens.get(admin.publicKey.toBase58())!;
    vault=PublicKey.findProgramAddressSync([Buffer.from('vault'),admin.publicKey.toBuffer(),mint.toBuffer()],program.programId)[0];
    vaultToken=PublicKey.findProgramAddressSync([Buffer.from('tokens'),vault.toBuffer()],program.programId)[0];
    await program.methods.initializeVault(bn(100_000)).accountsStrict({admin:admin.publicKey,mint,vault,vaultToken,tokenProgram:TOKEN_PROGRAM_ID,systemProgram:SystemProgram.programId}).rpc();
    await deposit(alice,1000);
    await program.methods.addYield(bn(100)).accountsStrict({admin:admin.publicKey,mint,vault,vaultToken,adminToken,tokenProgram:TOKEN_PROGRAM_ID}).rpc();
    await deposit(bob,1100);
  });
  it('rejects Bob withdrawing Alice position without changing either balance or position',async()=>{
    const before=await snapshot();
    await assert.rejects(program.methods.withdraw(bn(100),bn(1)).accountsStrict({...accounts(bob),position:position(alice)}).signers([bob]).rpc(),(e:any)=>e.error?.errorCode?.code==='ConstraintSeeds');
    assert.deepEqual(await snapshot(),before);
  });
  it('rejects missing owner signature, including a forged non-signer account meta',async()=>{
    const before=await snapshot();
    const instruction=await program.methods.withdraw(bn(100),bn(1)).accountsStrict(accounts(alice)).instruction();
    const {blockhash}=await provider.connection.getLatestBlockhash();
    const message=new anchor.web3.TransactionMessage({payerKey:admin.publicKey,recentBlockhash:blockhash,instructions:[instruction]}).compileToV0Message();
    const unsignedOwner=new anchor.web3.VersionedTransaction(message);
    unsignedOwner.sign([admin]); // Alice's required signature is intentionally absent.
    const simulation = await provider.connection.simulateTransaction(unsignedOwner,{sigVerify:true});
    assert.equal(simulation.value.err, 'SignatureFailure', JSON.stringify(simulation.value));
    assert.deepEqual(await snapshot(),before);
    // Also prove the program itself enforces Signer, even when a caller clears the meta flag.
    const userMeta=instruction.keys.find(key=>key.pubkey.equals(alice.publicKey));
    assert.ok(userMeta);
    userMeta.isSigner=false;
    await assert.rejects(provider.sendAndConfirm(new Transaction().add(instruction)),(e:any)=>{
      const detail=String(e)+' '+(e.logs||[]).join(' ');
      return /AccountNotSigner|account did not sign/i.test(detail);
    });
    assert.deepEqual(await snapshot(),before);
  });
  it('allocates yield fairly across two depositors and conserves assets through partial and full withdrawals',async()=>{
    assert.deepEqual(await snapshot(),{assets:'2200',totalShares:'2000',vaultTokens:2200n,aliceTokens:9000n,bobTokens:8900n,aliceShares:'1000',bobShares:'1000'});
    await program.methods.addYield(bn(200)).accountsStrict({admin:admin.publicKey,mint,vault,vaultToken,adminToken,tokenProgram:TOKEN_PROGRAM_ID}).rpc();
    await withdraw(bob,500,600);
    assert.deepEqual(await snapshot(),{assets:'1800',totalShares:'1500',vaultTokens:1800n,aliceTokens:9000n,bobTokens:9500n,aliceShares:'1000',bobShares:'500'});
    await withdraw(alice,1000,1200);
    await withdraw(bob,500,600);
    assert.deepEqual(await snapshot(),{assets:'0',totalShares:'0',vaultTokens:0n,aliceTokens:10200n,bobTokens:10100n,aliceShares:'0',bobShares:'0'});
    assert.equal(await balance(adminToken),9700n);
  });
});
