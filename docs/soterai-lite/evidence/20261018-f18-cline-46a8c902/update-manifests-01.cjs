'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),repo=path.resolve(__dirname,'../../../..');
for(const [name,indent]of [['packages/vscode-extension/package.json',4],['packages/soterai-lite/package.json',2]]){
 const file=path.join(repo,name),value=JSON.parse(fs.readFileSync(file,'utf8')),properties=value.contributes.configuration.properties;
 assert.ok(!Object.hasOwn(properties,'soterai.lite.clineAdapter'));
 properties['soterai.lite.clineAdapter']={type:'boolean',default:true,scope:'machine',description:'Enable reviewed setup for the pinned Windows Cline version using an owned broker, approved safe-read MCP session and native hook. Unverified versions/configs withhold setup. Disabling invalidates managed sessions and retains saved denies; vendor hook failures/direct context remain outside this route.'};
 value.capabilities.untrustedWorkspaces.restrictedConfigurations.push('soterai.lite.clineAdapter');
 const rows=[['soterai.configurePinnedCline','Review Pinned Cline Setup'],['soterai.restorePinnedCline','Restore Previous Cline Config'],['soterai.clineAdapterStatus','Show Pinned Cline Adapter Status']];
 for(const [command,title]of rows){assert.ok(!value.contributes.commands.some(row=>row.command===command));value.contributes.commands.push({command,title,category:'SoterAI'});value.contributes.menus.commandPalette.push({command,when:'soterai.advancedCommands'});}
 fs.writeFileSync(file,JSON.stringify(value,null,indent)+'\n');
}
const readme=path.join(repo,'packages/vscode-extension/README.md'),text=fs.readFileSync(readme,'utf8');assert.ok(text.includes('The 62 safety-relevant settings'));fs.writeFileSync(readme,text.replace('The 62 safety-relevant settings','The 63 safety-relevant settings'));
console.log('Both manifests now63 machine/restricted flags; three owner-invoked advanced Cline commands. No configuration applied.');
