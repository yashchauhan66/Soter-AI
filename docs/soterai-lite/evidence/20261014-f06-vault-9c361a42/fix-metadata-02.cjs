const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'../../../..');
const canonical=path.join(root,'packages/vscode-extension/package.json'),manifest=JSON.parse(fs.readFileSync(canonical,'utf8'));
manifest.contributes.menus.commandPalette.find(item=>item.command==='soterai.recoverVaultMigration').when='soterai.advancedCommands';
fs.writeFileSync(canonical,JSON.stringify(manifest,null,4)+'\n');
const lite=path.join(root,'packages/soterai-lite/package.json'),target=JSON.parse(fs.readFileSync(lite,'utf8'));target.contributes=manifest.contributes;
fs.writeFileSync(lite,JSON.stringify(target,null,2)+'\n');
console.log('Recovery palette gate matches existing advanced context. Manager trust gate retained.');
