// Update only localnet configuration; never read or replace a deployment secret.
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
process.chdir(path.resolve(__dirname, '..'));
const key = 'target/deploy/defi_vault-keypair.json';
if (!fs.existsSync(key)) throw new Error('Run anchor build first to create the local program keypair.');
const id = execFileSync('solana-keygen', ['pubkey', key], { encoding: 'utf8' }).trim();
if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(id)) throw new Error('Invalid program public key');
const config = fs.readFileSync('Anchor.toml', 'utf8');
const section = /(\[programs\.localnet\][\s\S]*?)(?=\n\[|$)/;
if (!section.test(config)) throw new Error('Missing programs.localnet');
const updated = config.replace(section, block => {
  if (!/^defi_vault\s*=.*$/m.test(block)) throw new Error('Missing localnet program');
  return block.replace(/^defi_vault\s*=.*$/m, `defi_vault = "${id}"`);
});
const sourcePath = 'programs/defi_vault/src/lib.rs';
const source = fs.readFileSync(sourcePath, 'utf8');
if (!/declare_id!\("[^"]+"\);/.test(source)) throw new Error('Missing declare_id');
fs.writeFileSync('Anchor.toml', updated);
fs.writeFileSync(sourcePath, source.replace(/declare_id!\("[^"]+"\);/, `declare_id!("${id}");`));
console.log(`Localnet program: ${id}. Devnet configuration unchanged. Run anchor build next.`);
