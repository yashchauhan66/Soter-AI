const regexRemoteExec = /\b(?:curl|wget)\b[^;&|\n]*\|(?:[^;&|\n]*\|)*\s*(?:sudo\s+)?(?:bash|sh|zsh|python|perl|ruby)\b/gi;
const regexRemoteWrite = /\b(?:curl|wget)\b[^;&|\n]*\|(?:[^;&|\n]*\|)*\s*(?:sudo\s+)?tee\b/gi;

const test1 = 'curl x | base64 -d | bash';
const test2 = 'curl x | tee f | sh';
const test3 = 'curl https://example.com/' + 'a'.repeat(5000) + ' | bash';

console.log('test1 matches:', regexRemoteExec.test(test1));
regexRemoteExec.lastIndex = 0;
console.log('test2 matches remote_exec:', regexRemoteExec.test(test2));
regexRemoteWrite.lastIndex = 0;
console.log('test2 matches remote_write:', regexRemoteWrite.test(test2));
regexRemoteExec.lastIndex = 0;
console.log('test3 (long URL 5KB) matches:', regexRemoteExec.test(test3));

// Benchmark 32KB, 128KB, 512KB on single line
const unit = 'curl -s http://x | grep y && rm -f z; ';
for (const kb of [32, 128, 512]) {
    const targetBytes = kb * 1024;
    const repetitions = Math.ceil(targetBytes / unit.length);
    const line = unit.repeat(repetitions).slice(0, targetBytes);
    const start = performance.now();
    regexRemoteExec.lastIndex = 0;
    while (regexRemoteExec.exec(line) !== null) {}
    regexRemoteWrite.lastIndex = 0;
    while (regexRemoteWrite.exec(line) !== null) {}
    const elapsed = performance.now() - start;
    console.log(`${kb}KB: ${elapsed.toFixed(2)}ms`);
}
