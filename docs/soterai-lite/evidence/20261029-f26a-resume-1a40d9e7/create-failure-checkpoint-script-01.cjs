const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),own=n=>path.join(__dirname,n);
let source=fs.readFileSync(own('scoped-checkpoint-git-01.cjs'),'utf8');
const start=source.indexOf('function preflight(){'),end=source.indexOf('const [mode,expectedHash]',start);assert(start>=0&&end>start);
const preflight=`function preflight(){
 assert.equal(sha(fs.readFileSync(git)),'da240fe9bc24895b3e04150a4990b8a6ff329ecabcd8f19684c2cc310da5ef3f');assert.equal(text(['rev-parse','--show-object-format']),'sha1');
 const p=read(own('progress-04.json'));assert.equal(p.status,'NATIVE06_FAIL_RETAINED_DIAGNOSTIC07_PREPARED_EXPLICIT_APPROVAL_REQUIRED');assert.equal(p.native06.pass,4);assert.equal(p.native06.fail,1);assert.equal(p.native06.notRun,25);assert.equal(p.native07,'NOT_AUTHORIZED_NOT_MATERIALIZED_NOT_RUN');
 for(const row of [p.proposal,p.candidate,p.review]){const b=fs.readFileSync(ordinary(row.path));assert.equal(b.length,row.bytes);assert.equal(sha(b),row.sha256);}
 const result=cp.execFileSync(process.execPath,[own('diagnostic-admission-07.cjs')],{cwd:repo,env,windowsHide:true,shell:false,maxBuffer:1048576});assert(result.toString('utf8').includes('DIAGNOSTIC07_STATIC_ADMISSION_PASS_NOT_AUTHORIZED_NOT_RUN'));
 for(const name of ['native07-syntax-01','native07-outer-syntax-01','native07-outer-ps-syntax-01']){const r=read(own(name+'.txt.result.json'));assert.equal(r.exitCode,0);assert.equal(sha(fs.readFileSync(own(name+'.txt'))),r.sha256.toLowerCase());}
 assert(!fs.existsSync(own('native07-user-approval-01.json'))&&!fs.existsSync(own('native07-consumption-01.json'))&&!fs.existsSync(own('run-precommit-native-07.ps1')));assert(!fs.existsSync(hooks)||fs.readdirSync(hooks).length===0);return p;
}
`;
source=source.slice(0,start)+preflight+source.slice(end);
const replacements=[
 ["phase='preparation'","phase='native06-failure-diagnostic07-preparation'"],
 ['f26a-preparation-manifest-01.json','f26a-native06-failure-manifest-01.json'],
 ['f26a-preparation-byte-proof-01.json','f26a-native06-failure-byte-proof-01.json'],
 ['f26a-preparation-body-01.txt','f26a-native06-failure-body-01.txt'],
 ['bc1986c663f264e6fa86d06908a27f6136cefa7f','d9ec44045bb1fca66bdf560f48df99342b4c2eb8'],
 ['progress-01.json','progress-04.json'],
 ['PASS_EXACT_LOCAL_F26A_PREPARATION_CHECKPOINT_BYTES_NATIVE06_DEFERRED','PASS_EXACT_LOCAL_F26A_FAILED_NATIVE06_DIAGNOSTIC07_PREPARATION_BYTES'],
 ['INCOMPLETE_NATIVE06_USER_DEFERRED','INCOMPLETE_NATIVE06_FAILED_NATIVE07_NOT_AUTHORIZED']
];for(const[from,to]of replacements){assert(source.includes(from));source=source.split(from).join(to);}
const bodyStart=source.indexOf('fs.writeFileSync(own(body),'),bodyEnd=source.indexOf(';const old=',bodyStart);assert(bodyStart>=0&&bodyEnd>bodyStart);
const body='docs(lite): retain failed F26a native06 and prepare bounded diagnostics\n\nRecord actual4PASS1FAIL25NOT_RUN, consumed single approval, natural owner closure and scoped user-authorized cache cleanup. Prepare metadata-only diagnostic07 with first-install2, privacy3, delegation3, strict typecheck, fresh driver and syntax checks. Original34 callbacks/bootstrap/deadlines/runtime bytes remain unchanged. Native07 is not authorized or executed; F26a remains incomplete. Preserve unrelated user changes.\n';
source=source.slice(0,bodyStart)+'fs.writeFileSync(own(body),'+JSON.stringify(body)+",{flag:'wx'})"+source.slice(bodyEnd);
const scope=/scope:'Preparation evidence[^']*'/;assert(scope.test(source));source=source.replace(scope,"scope:'Current H26R failure, approval-consumption, scoped cache-cleanup receipts and diagnostic07 preparation evidence plus metadata only. No production/shared changes, no extra native07 approval/materialization/launch or F26a acceptance. Preserve all unrelated user source/generated/app/scratch changes unstaged.'");
fs.writeFileSync(own('scoped-native06-failure-git-01.cjs'),source,{flag:'wx'});
console.log('Scoped failure/preparation checkpoint script created; raw-byte commit and exhaustive membership verification retained.');
