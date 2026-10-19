const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),crypto=require("node:crypto"),base=__dirname;
let guard=fs.readFileSync(path.join(base,"../20261018-f18-cline-46a8c902/matrix-guards-01.cjs"),"utf8").split("F18").join("F19");
const anchor="if(!allowed){records.deniedChildLaunches.push(";
assert.equal(guard.split(anchor).length,2);
guard=guard.replace(anchor,[
 'const expectedNative=path.resolve(root,"extensions/anthropic.claude-code-2.1.301-win32-x64/resources/native-binary/claude.exe");',
 'if(path.resolve(executable).toLowerCase()===expectedNative.toLowerCase()&&!options.shell&&inside(cwd)&&path.resolve(cwd).toLowerCase()===path.resolve(root,"workspace").toLowerCase()',
 ' &&options.env&&path.resolve(options.env.CLAUDE_CONFIG_DIR||"").toLowerCase()===path.resolve(root,"profile/claude").toLowerCase()',
 ' &&argv.length===13&&argv[0]==="--setting-sources"&&argv[1]==="user"&&argv[2]==="-p"&&typeof argv[3]==="string"&&Buffer.byteLength(argv[3])<=4096',
 ' &&argv.slice(4).join("|")==="--output-format|stream-json|--verbose|--no-session-persistence|--max-turns|2|--model|claude-sonnet-4-6")allowed=true;',
 anchor
].join("\n"));
// The reviewed CLI argv has 12 entries: 4 prefix + 8 constant suffix.
guard=guard.replace("argv.length===13&&argv[0]","argv.length===12&&argv[0]");
fs.writeFileSync(path.join(base,"matrix-guards-01.cjs"),guard,{flag:"wx"});
const files=["product-matrix-01.cjs","matrix-guards-01.cjs","run-product-matrix-01.ps1"].map(name=>{const bytes=fs.readFileSync(path.join(base,name));return{path:name,bytes:bytes.length,sha256:crypto.createHash("sha256").update(bytes).digest("hex")};});
fs.writeFileSync(path.join(base,"native-fixture-freeze-01.json"),JSON.stringify({status:"FROZEN_NOT_EXECUTED",expected:22,files,scope:"Exact new VSIX editor owner/controller plus actual pinned CLI text route; scripted consent LOW; webview prompt session UNVERIFIED"},null,2)+"\n",{flag:"wx"});
console.log(JSON.stringify({status:"FROZEN_NOT_EXECUTED",expected:22}));
