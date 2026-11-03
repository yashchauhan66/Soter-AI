'use strict';
const fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'run-content-04.cjs'),'utf8'),prefix=source.slice(0,source.indexOf('async function main()'));
new Function('require','__dirname',prefix+"\ntry{const proof=inputs();console.log('INPUTS_PASS');for(const n of ['compiler-02','readiness-03','package-04','manifest-components-03','package-components-06'])closed(n);console.log('CLOSURES_PASS');console.log(fullSuite(proof));}catch(e){console.error(e);process.exitCode=1;}")(require,__dirname);
