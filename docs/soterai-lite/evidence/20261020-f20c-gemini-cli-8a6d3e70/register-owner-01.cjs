const fs=require('node:fs');
for(const name of ['vscode-extension','soterai-lite']){
 const file='packages/'+name+'/package.json', manifest=JSON.parse(fs.readFileSync(file,'utf8'));
 const properties=manifest.contributes.configuration.properties;
 for(const key of ['soterai.lite.geminiCliAdapter','soterai.broker.geminiProviderUrl'])if(properties[key])throw Error('Already registered');
 properties['soterai.lite.geminiCliAdapter']={type:'boolean',default:true,scope:'machine',description:'Enable reviewed pinned Gemini CLI dedicated text/safe-read profile. Explicit curated launch variables and actual route verification are required. Disabling revokes local capabilities and preserves restrictive profile files.'};
 properties['soterai.broker.geminiProviderUrl']={type:'string',default:'',scope:'machine',description:'Reviewed Gemini provider base URL for the owned broker; no path/query/credential. HTTPS or explicit synthetic loopback HTTP only. Blank withholds Gemini traffic.'};
 manifest.capabilities.untrustedWorkspaces.restrictedConfigurations.push('soterai.lite.geminiCliAdapter','soterai.broker.geminiProviderUrl');
 for(const [command,title] of [['configurePinnedGeminiCli','Review Pinned Gemini CLI Safe-Read Profile'],['restorePinnedGeminiCli','Restore Pinned Gemini CLI Profile Config'],['geminiCliAdapterStatus','Pinned Gemini CLI Adapter Status']]){
  manifest.contributes.commands.push({command:'soterai.'+command,title,category:'SoterAI'});
  manifest.contributes.menus.commandPalette.push({command:'soterai.'+command,when:'soterai.advancedCommands'});
 }
 fs.writeFileSync(file,JSON.stringify(manifest,null,2)+'\n');
}
