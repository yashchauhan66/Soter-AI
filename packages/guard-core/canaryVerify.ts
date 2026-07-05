import { DecisionEngine } from "./src/DecisionEngine";
import { redactText } from "./src/Redactor";
import { HashCache } from "./src/HashCache";
import { PolicyEvaluator } from "./src/PolicyEvaluator";

// Realistic formats that will trigger the detectors
const SOTER_CANARY_OPENAI_KEY = "sk-proj-sotercanary1234567890abcdefghijkl";
const SOTER_CANARY_AWS_KEY = "AKIAIOSFODNN7EXAMPLE";
const SOTER_CANARY_DB_URL = "postgresql://user:password@localhost:5432/prod";
const SOTER_CANARY_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjYW5hcnkiOiJ2YWx1ZXkifQ.signature-value";

async function runValidation() {
    console.log("=== STARTING SOTERAI GUARD-CORE CANARY VALIDATION ===");
    const engine = new DecisionEngine();

    // Text containing all canaries
    const testInput = `
    Hello Developer. Here are some configs:
    OpenAI Key: ${SOTER_CANARY_OPENAI_KEY}
    AWS Key: ${SOTER_CANARY_AWS_KEY}
    Database URL: ${SOTER_CANARY_DB_URL}
    JWT: ${SOTER_CANARY_JWT}
  `;

    console.log("Input size:", testInput.length, "chars");

    // Run scan
    console.log("\n--- Testing DecisionEngine ---");
    const decision = await engine.scan(testInput, { context: "file" });
    console.log("Decision:", decision.decision);
    console.log("Risk Score:", decision.riskScore);
    console.log("Severity:", decision.severity);
    console.log("Categories detected:", decision.categories.join(", "));
    console.log("Findings count:", decision.findings.length);

    // 2. Secret leakage check
    console.log("\n--- Checking Leakage ---");
    const rawCanaries = [
        SOTER_CANARY_OPENAI_KEY,
        SOTER_CANARY_AWS_KEY,
        SOTER_CANARY_DB_URL,
        SOTER_CANARY_JWT
    ];

    const decisionStr = JSON.stringify(decision);
    let leakFound = false;
    for (const canary of rawCanaries) {
        if (decisionStr.includes(canary)) {
            console.error(`🚨 LEAK DETECTED: Raw secret "${canary}" was found in decision output!`);
            leakFound = true;
        }
    }
    if (!leakFound) {
        console.log("✅ SUCCESS: No raw secrets found in the decision object structure.");
    }

    // 3. Caching check
    console.log("\n--- Testing Hash Cache ---");
    const hashVal = decision.inputHash;
    const cachedDecision = engine.getCache().get(hashVal);
    if (cachedDecision) {
        console.log("✅ SUCCESS: Cache hit found.");
        const cachedStr = JSON.stringify(cachedDecision);
        let cachedLeak = false;
        for (const canary of rawCanaries) {
            if (cachedStr.includes(canary)) {
                console.error(`🚨 LEAK DETECTED: Raw secret "${canary}" in Cache!`);
                cachedLeak = true;
            }
        }
        if (!cachedLeak) console.log("✅ SUCCESS: No raw secrets stored in cache.");
    } else {
        console.error("❌ FAIL: Cache missed compiled hash.");
    }

    // 4. Performance benchmarking
    console.log("\n--- Performance Benchmarking ---");
    const text1Kb = "OpenAI key sk-proj-sotercanary1234567890abcdefghijkl. ".repeat(20); // ~1KB
    const text10Kb = "OpenAI key sk-proj-sotercanary1234567890abcdefghijkl. ".repeat(200); // ~10KB
    const text100Kb = "OpenAI key sk-proj-sotercanary1234567890abcdefghijkl. ".repeat(2000); // ~100KB

    const t1 = await runBenchmark(engine, text1Kb, "1KB");
    const t2 = await runBenchmark(engine, text10Kb, "10KB");
    const t3 = await runBenchmark(engine, text100Kb, "100KB");

    console.log(`Scan Latencies: 1KB=${t1.toFixed(2)}ms, 10KB=${t2.toFixed(2)}ms, 100KB=${t3.toFixed(2)}ms`);

    console.log("\n=== VALIDATION COMPLETED ===");
}

async function runBenchmark(engine: DecisionEngine, text: string, label: string): Promise<number> {
    const start = performance.now();
    // Bypass cache to measure raw performance
    await engine.scan(text, { context: "file", skipCache: true });
    return performance.now() - start;
}

runValidation().catch(console.error);
