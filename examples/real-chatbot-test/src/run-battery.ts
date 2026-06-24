// Target 1 harness: drives soter.secureChat (input guard -> real Groq -> output
// guard) through the 6-scenario battery and prints JSON evidence.
import { soter } from "./guard";
import { callGroqLLM } from "./llm-groq";
import { SCENARIOS, passesExpectation } from "./battery";

async function runInput(s: (typeof SCENARIOS)[number]) {
  let llmCalled = false;
  let safeSentToLLM = "";
  const result = await soter.secureChat({
    message: s.message,
    userId: "rct-user",
    sessionId: `rct-${s.id}-${Date.now()}`,
    callLLM: async (llmInput) => {
      llmCalled = true;
      safeSentToLLM = llmInput.safeInput;
      return callGroqLLM(llmInput);
    },
  });

  const inputAction = result.inputResult?.action ?? "UNKNOWN";
  const actual = result.blocked && !result.outputResult ? "BLOCK" : inputAction;

  const decisionPass = passesExpectation(s.expect, actual);
  const llmPass = llmCalled === s.expectLLMCalled;

  return {
    target: "real-chatbot-test",
    id: s.id,
    label: s.label,
    kind: s.kind,
    input: s.message,
    expected: s.expect,
    actualAction: actual,
    allowed: result.inputResult?.allowed,
    blocked: result.blocked,
    riskScore: result.inputResult?.riskScore,
    riskTypes: result.inputResult?.riskTypes,
    safeText: result.inputResult?.safeText ?? result.inputResult?.redactedText,
    llmCalled,
    safeSentToLLM,
    reply: (result.reply ?? "").slice(0, 220),
    pass: decisionPass && llmPass,
    decisionPass,
    llmPass,
  };
}

async function runOutput(s: (typeof SCENARIOS)[number]) {
  // S6: run a (would-be) LLM reply straight through the OUTPUT guard.
  const result: any = await soter.guardOutput({
    aiResponse: s.message,
    sessionId: `rct-${s.id}-${Date.now()}`,
  });
  const actual = result.action;
  return {
    target: "real-chatbot-test",
    id: s.id,
    label: s.label,
    kind: s.kind,
    input: s.message,
    expected: s.expect,
    actualAction: actual,
    allowed: result.allowed,
    riskScore: result.riskScore,
    riskTypes: result.riskTypes,
    safeText: result.safeText ?? result.redactedText,
    reply: result.safeText ?? result.redactedText ?? "(blocked)",
    pass: passesExpectation(s.expect, actual),
  };
}

async function main() {
  const out: any[] = [];
  for (const s of SCENARIOS) {
    try {
      out.push(s.kind === "output" ? await runOutput(s) : await runInput(s));
    } catch (e: any) {
      out.push({
        target: "real-chatbot-test",
        id: s.id,
        label: s.label,
        error: e?.message ?? String(e),
        pass: false,
      });
    }
  }
  console.log("BATTERY_JSON_START");
  console.log(JSON.stringify(out, null, 2));
  console.log("BATTERY_JSON_END");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
