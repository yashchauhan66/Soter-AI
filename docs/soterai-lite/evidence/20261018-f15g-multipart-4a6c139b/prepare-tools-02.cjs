// Review correction before gates: counts must never rewrite 64-character SHA patterns.
const fs=require('node:fs'),path=require('node:path');let source=fs.readFileSync(path.join(__dirname,'prepare-tools-01.cjs'),'utf8').split('const native=')[0];
source=source.replace(".replace(/\\b64\\b/g,'72')",'').replace("{flag:'wx'}", "{flag:'w'}").replace(" if(name==='run-local-02.ps1')", " if(name==='prepare-acceptance-01.cjs')s=s.replace(\"[['primary',64]\",\"[['primary',72]\");\n if(name==='run-native-broker-01.ps1')s=s.replace(\"-eq 'primary'){64}\",\"-eq 'primary'){72}\");\n if(name==='run-local-02.ps1')");
new Function('require','__dirname',source)(require,__dirname);console.log('G tooling restored all SHA256 lengths to64; primary count explicitly72. Native source unchanged.');
