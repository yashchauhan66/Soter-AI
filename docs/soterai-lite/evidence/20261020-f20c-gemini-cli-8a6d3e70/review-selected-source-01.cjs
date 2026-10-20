'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root='C:/Users/USER/AppData/Roaming/npm/node_modules/@google/gemini-cli/bundle';
const queries={
 'gemini-63IMHOLI.js':['GEMINI_CLI_SYSTEM_DEFAULTS_PATH','ignoreLocalEnv','loadEnvironment','loadSettings(','GEMINI_CLI_SYSTEM_SETTINGS_PATH','selectedType','enableAutoUpdate','excludeTools =','coreTools:','folderTrust','extensionsEnabled:','mcpEnabled:'],
 'chunk-32XQ54AJ.js':['static getGlobalGeminiDir','getSystemConfigDir()','GEMINI_CLI_SYSTEM_DEFAULTS_PATH','getCoreTools()','const coreTools','this.coreTools','GEMINI_API_KEY','USE_GEMINI','async function createContentGenerator','GOOGLE_GEMINI_BASE_URL','enableAutoUpdate','ignoreLocalEnv','loadApiKey','keytar','getSystemPoliciesDir','streamGenerateContent','class GoogleGenAI']
};
const observations=[];
for(const [relative,needles]of Object.entries(queries)){const bytes=fs.readFileSync(path.join(root,relative)),source=bytes.toString('utf8');for(const needle of needles){let offset=-1,count=0;while((offset=source.indexOf(needle,offset+1))>=0&&count++<5)observations.push({relative,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),needle,offset,code:source.slice(Math.max(0,offset-260),offset+1700)});}}
const result={status:'STATIC_ONLY',observations};
fs.writeFileSync(path.join(__dirname,'selected-source-review-01.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
for(const item of observations)console.log('\n'+item.relative+' @'+item.offset+' '+item.needle+'\n'+item.code);
