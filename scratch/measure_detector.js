const { detectTerminalCommandRisk } = require('../packages/guard-core/dist/index.js');

const unit = 'curl -s http://x | grep y && rm -f z; ';
for (const kb of [32, 128, 512]) {
    const targetBytes = kb * 1024;
    const repetitions = Math.ceil(targetBytes / unit.length);
    const line = unit.repeat(repetitions).slice(0, targetBytes);
    const start = performance.now();
    detectTerminalCommandRisk(line);
    const elapsed = performance.now() - start;
    console.log(`${kb}KB: ${elapsed.toFixed(2)}ms`);
}
