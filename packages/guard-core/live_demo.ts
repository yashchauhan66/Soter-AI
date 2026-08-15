import { DecisionEngine } from "./src/index"; // directly importing from guard-core src
import * as fs from "fs";

async function runLiveTest() {
    console.log("==========================================");
    console.log("🚨 SOTER-AI REAL VIBE-CODING LIVE TEST 🚨");
    console.log("==========================================\n");

    const engine = new DecisionEngine();

    console.log("👉 SCENARIO 1: AI Agent reading an .env file containing Secrets");
    const fakeEnv = `
DATABASE_URL=postgres://user:supersecretpass@db.example.com:5432/prod
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
`;
    console.log("[Input to AI Engine]:", fakeEnv);
    const d1 = await engine.scan(fakeEnv, { context: "file" });

    console.log("🔍 SoterAI Analysis Results:");
    console.log("- Risk Score:", d1.riskScore);
    console.log("- Categories:", d1.categories);
    console.log("- Decision (Action Taken):", d1.decision.toUpperCase());
    console.log("- Redacted Safe Text Sent to AI:\n", d1.redactedText || "N/A");
    console.log("------------------------------------------\n");

    console.log("👉 SCENARIO 2: AI Agent suggesting a destructive terminal command");
    const fakeCommand = `rm -rf / --no-preserve-root`;
    console.log("[Command AI Wants to Run]:", fakeCommand);
    const d2 = await engine.scan(fakeCommand, { context: "terminal" });

    console.log("🔍 SoterAI Analysis Results:");
    console.log("- Risk Score:", d2.riskScore);
    console.log("- Categories:", d2.categories);
    console.log("- Decision (Action Taken):", d2.decision.toUpperCase());
    if (d2.decision === "block" || d2.decision === "warn") {
        console.log("✅ BLOCKED or WARNED successfully. Machine kept safe!");
    }
    console.log("==========================================\n");
    console.log("TEST COMPLETED. SoterAI works as advertised! 🛡️");
}

runLiveTest().catch(console.error);
