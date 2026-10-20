'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root='C:/Users/USER/AppData/Roaming/npm/node_modules/@google/gemini-cli/bundle';
const requests={
 'chunk-ODKPTNXF.js':[['function loadSettings',10000],['function loadEnvironment',5000],['ignoreLocalEnv',1800],['GEMINI_CLI_SYSTEM_DEFAULTS_PATH',1800],['enableAutoUpdate',1000]],
 'chunk-32XQ54AJ.js':[['var HybridTokenStorage',6000],['var KeychainTokenStorage',2400],['async function createContentGenerator(',8500],['getAuthTypeFromEnv',2200],['static getGlobalGeminiDir',2500]],
 'gemini-63IMHOLI.js':[['const excludeTools',2500],['const skipExtensions',1800],['mcpEnabled',1600],['autoUpdate',1600],['enableAutoUpdate',1600]]
};
const observations=[];
for(const [relative,queries]of Object.entries(requests)){const bytes=fs.readFileSync(path.join(root,relative)),source=bytes.toString();for(const [needle,length]of queries){const offset=source.indexOf(needle);if(offset>=0)observations.push({relative,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),needle,offset,code:source.slice(Math.max(0,offset-120),offset+length)});}}
const result={status:'STATIC_ONLY',observations};fs.writeFileSync(path.join(__dirname,'selected-source-review-02.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(observations.map(({relative,needle,offset})=>({relative,needle,offset}))));
