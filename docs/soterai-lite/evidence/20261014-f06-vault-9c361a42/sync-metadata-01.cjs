const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../../..'),canonical=path.join(root,'packages/vscode-extension/package.json'),lite=path.join(root,'packages/soterai-lite/package.json');
const manifest=JSON.parse(fs.readFileSync(canonical,'utf8'));
manifest.contributes.configuration.properties['soterai.lite.vaultMode']={type:'boolean',default:true,scope:'machine',description:'Enable optional owner-reviewed encrypted vault migration and safe recovery. Turning this off preserves saved denies and ciphertext, never restores raw values.'};
manifest.capabilities.untrustedWorkspaces.restrictedConfigurations.push('soterai.lite.vaultMode');
manifest.contributes.commands.push({command:'soterai.recoverVaultMigration',title:'Complete Safe Vault Recovery',category:'SoterAI',icon:'$(history)'});
manifest.contributes.menus.commandPalette.push({command:'soterai.recoverVaultMigration',when:'soterai.advancedCommands && isWorkspaceTrusted'});
manifest.contributes.menus['explorer/context'].push({command:'soterai.migrateSecretsToVault',when:'resourceScheme == file && !explorerResourceIsFolder && isWorkspaceTrusted',group:'soterai@6'},
 {command:'soterai.recoverVaultMigration',when:'resourceScheme == file && !explorerResourceIsFolder && isWorkspaceTrusted',group:'soterai@7'});
fs.writeFileSync(canonical,JSON.stringify(manifest,null,4)+'\n');
const target=JSON.parse(fs.readFileSync(lite,'utf8'));target.contributes=manifest.contributes;target.activationEvents=manifest.activationEvents;target.capabilities=manifest.capabilities;
fs.writeFileSync(lite,JSON.stringify(target,null,2)+'\n');
console.log(JSON.stringify({status:'SYNCED_NOT_TESTED',machineSettings:Object.values(manifest.contributes.configuration.properties).filter(p=>p.scope==='machine').length,commands:manifest.contributes.commands.length}));
