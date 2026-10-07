const unit = 'curl -s http://x | grep y && rm -f z; ';

for (const boundName of ['unbounded', 'bound250', 'bound_nopipe']) {
    let pat;
    if (boundName === 'unbounded') {
        pat = /\b(?:curl|wget)\s+[^\n]*\|\s*(?:sudo\s+)?(?:bash|sh|zsh|python|perl|ruby)\b/gi;
    } else if (boundName === 'bound250') {
        pat = /\b(?:curl|wget)\s+[^\n]{0,250}\|\s*(?:sudo\s+)?(?:bash|sh|zsh|python|perl|ruby)\b/gi;
    } else {
        pat = /\b(?:curl|wget)\s+[^\n|]{0,250}\|\s*(?:sudo\s+)?(?:bash|sh|zsh|python|perl|ruby)\b/gi;
    }

    console.log(`=== Testing ${boundName} ===`);
    for (const kb of [32, 128, 512]) {
        const targetBytes = kb * 1024;
        const repetitions = Math.ceil(targetBytes / unit.length);
        const line = unit.repeat(repetitions).slice(0, targetBytes);
        const start = performance.now();
        pat.lastIndex = 0;
        while (pat.exec(line) !== null) {}
        const elapsed = performance.now() - start;
        console.log(`${kb}KB: ${elapsed.toFixed(2)}ms`);
        if (elapsed > 3000) {
            console.log(`Skipping larger for ${boundName} (took >3s)`);
            break;
        }
    }
}
