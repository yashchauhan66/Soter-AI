const fs=require("node:fs"),path=require("node:path"),base=__dirname;
let source=fs.readFileSync(path.join(base,"prepare-generated-input-proof-01.cjs"),"utf8");
const replacement="const marker=\"for(const name of lines(git('ls-files','--others','--exclude-standard','--',...sourceRoots))){\";";
source=source.replace(/^const marker=.*;$/m,replacement);
fs.writeFileSync(path.join(base,"prepare-generated-input-proof-02.cjs"),source,{flag:"wx"});
require("./prepare-generated-input-proof-02.cjs");
