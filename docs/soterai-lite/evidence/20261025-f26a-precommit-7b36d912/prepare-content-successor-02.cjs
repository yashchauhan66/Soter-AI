const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const file = path.join(__dirname, 'prepare-content-templates-01.cjs'), before = fs.readFileSync(file), source = before.toString('utf8');
const marker = 'return text.replace(before, after);';
if (source.split(marker).length !== 2) throw Error('Expected exact helper replacement boundary.');
const next = source.replace(marker, 'return text.replace(before, () => after);')
 .replaceAll('inspect-vsix-01.template.ps1', 'inspect-vsix-02.template.ps1')
 .replaceAll('artifact-binding-01.template.ps1', 'artifact-binding-02.template.ps1')
 .replaceAll('content-template-custody-01.json', 'content-template-custody-02.json');
fs.writeFileSync(path.join(__dirname, 'prepare-content-templates-02.cjs'), next, { flag: 'wx' });
fs.writeFileSync(path.join(__dirname, 'content-template-correction-01.json'), JSON.stringify({ time: new Date().toISOString(),
 status: 'PRE_EXECUTION_HELPER_CORRECTION_NOT_PRODUCT_OR_NATIVE', beforeSha256: crypto.createHash('sha256').update(before).digest('hex'),
 failure: 'PowerShell syntax01 observed6 inspector errors. JavaScript string replacement interpreted the regex end-anchor plus closing quote as replacement-tail substitution and duplicated the remaining template inside the regex.',
 change: 'Return literal generated PowerShell from replacement callback; create separate02 templates/receipt. Original helper/templates/syntaxFAIL retained unchanged. No product/assertion/budget relaxation.' }, null, 2) + '\n', { flag: 'wx' });
console.log('Separate literal-replacement helper02 prepared; original failed attempt retained.');
