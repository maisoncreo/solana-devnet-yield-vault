const fs=require('fs');
fs.mkdirSync('frontend/public',{recursive:true});
fs.copyFileSync('target/idl/defi_vault.json','frontend/public/defi_vault.json');
if(fs.existsSync('deployment.json'))fs.copyFileSync('deployment.json','frontend/public/deployment.json');
