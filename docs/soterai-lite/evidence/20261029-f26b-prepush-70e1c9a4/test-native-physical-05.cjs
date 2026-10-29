const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {ordinary,verifyRow}=require('./native-physical-admission-05.cjs'),root=path.resolve(__dirname,'../../../..');
const parent='D:\\SoterAI-Lite-test-profiles\\f03-unit-temp';const fixture=fs.mkdtempSync(path.join(parent,'f26b-physical-')),target=path.join(fixture,'ordinary');fs.mkdirSync(target);const file=path.join(target,'public.txt');fs.writeFileSync(file,'TEST_ONLY_PUBLIC_ANCESTRY\n',{flag:'wx'});let checks=0;
ordinary(root);checks++;ordinary(path.dirname(root));checks++;ordinary(file);checks++;
const row={path:file,bytes:fs.statSync(file).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};verifyRow(row);checks++;
assert.throws(()=>verifyRow({...row,sha256:'0'.repeat(64)}));checks++;
const linked=path.join(fixture,'junction');fs.symlinkSync(target,linked,'junction');assert.throws(()=>ordinary(path.join(linked,'public.txt')));checks++;
const hard=path.join(fixture,'hardlink.txt');fs.linkSync(file,hard);assert.throws(()=>ordinary(hard));checks++;
fs.writeFileSync(path.join(__dirname,'native-physical-component-05.json'),JSON.stringify({status:'PASS7_REAL_METADATA_CLOUD_PATH_JUNCTION_HARDLINK_HASH_CONTROLS_NOT_GUI',checks,fixture,rootCloudLikeDirectoriesAcceptedOnlyWithExactPhysicalPath:true,signalsRequested:0},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({status:'PASS7_REAL_PHYSICAL_ADMISSION_COMPONENTS',checks,fixture}));
