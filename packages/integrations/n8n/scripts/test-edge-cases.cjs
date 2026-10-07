const { SoterGuardV3 } = require("../dist/nodes/SoterGuard/v3/SoterGuardV3.js");

console.log("Running comprehensive edge case tests...");

function createMockContext(operation, parameters, inputJson = {}) {
  return {
    getInputData() {
      return [{ json: inputJson }];
    },
    getNode() {
      return {
        typeVersion: 3,
        parameters: { operation, ...parameters },
      };
    },
    getNodeParameter(name, itemIndex, fallback) {
      if (name === "operation") return operation;
      if (name in parameters) return parameters[name];
      return fallback;
    },
    async getCredentials(name) {
      return {
        apiKey: "sk-mock-key-12345",
        baseUrl: "http://localhost:3001",
      };
    },
    continueOnFail() {
      return false;
    },
  };
}

async function runEdgeCases() {
  const node = new SoterGuardV3({ displayName: "SoterAI", name: "soterGuard", group: [], description: "", defaultVersion: 3 });

  // Test 1: metadata as an Object
  console.log("\n--- Test 1: metadata as Object ---");
  try {
    const ctx = createMockContext("inputGuard", {
      inputText: "hello world",
      detectionEngine: "LOCAL",
      onThreat: "BLOCK",
      options: {
        metadata: { userId: "user-42" },
      },
    });
    const res = await node.execute.call(ctx);
    console.log("✅ Test 1 Passed! Output:", res[0][0].json.allowed);
  } catch (err) {
    console.log("❌ Test 1 Failed:", err.message);
  }

  // Test 2: workflowJson as an Object
  console.log("\n--- Test 2: workflowJson as Object ---");
  try {
    const ctx = createMockContext("workflowAudit", {
      workflowJson: { name: "Audit Test", nodes: [] },
    });
    const res = await node.execute.call(ctx);
    console.log("✅ Test 2 Passed! Security score:", res[0][0]?.json?.securityScore || res[1][0]?.json?.securityScore);
  } catch (err) {
    console.log("❌ Test 2 Failed:", err.message);
  }

  // Test 3: passportPolicy as an Object in enrollIdentity
  console.log("\n--- Test 3: passportPolicy as Object in enrollIdentity ---");
  try {
    const ctx = createMockContext("enrollIdentity", {
      agentName: "Support Bot",
      passportPolicyPreset: "CUSTOM",
      options: {
        passportPolicy: { allowedTools: ["crm.read"] },
      },
    });
    const res = await node.execute.call(ctx);
    console.log("Test 3 result:", res);
  } catch (err) {
    console.log("Test 3 error:", err.message);
  }

  // Test 4: toolContent as an Object in toolCall
  console.log("\n--- Test 4: toolContent as Object in toolCall ---");
  try {
    const ctx = createMockContext("toolCall", {
      toolName: "crm.lookup",
      toolAction: "read",
      toolContent: { customerId: 1024 },
      detectionEngine: "LOCAL",
    });
    const res = await node.execute.call(ctx);
    console.log("✅ Test 4 Passed! Tool decision:", res[0][0]?.json?.decision);
  } catch (err) {
    console.log("❌ Test 4 Failed:", err.message);
  }

  // Test 5: tool.riskContext as Object in universalGuard
  console.log("\n--- Test 5: tool.riskContext as Object in universalGuard ---");
  try {
    const ctx = createMockContext("universalGuard", {
      inputText: "Run cleanup",
      detectionEngine: "LOCAL",
      securityContext: {
        tool: {
          name: "data.process",
          action: "process",
          destination: "external",
          riskContext: { canDeleteData: true },
        },
      },
    });
    const res = await node.execute.call(ctx);
    const item = res[0]?.[0]?.json || res[1]?.[0]?.json;
    const hasToolFinding = item?.categories?.includes("TOOL_ABUSE") || (item?.findings || []).some(f => f.type === "TOOL_ABUSE");
    if (hasToolFinding) {
      console.log("✅ Test 5 Passed! riskContext was preserved and TOOL_ABUSE was detected.");
    } else {
      console.log("❌ Test 5 Failed! riskContext was silently dropped by stringValue(tool.riskContext)!");
    }
  } catch (err) {
    console.log("❌ Test 5 Failed with error:", err.message);
  }

  // Test 5b: output.protectedSources as Array in universalGuard
  console.log("\n--- Test 5b: output.protectedSources as Array in universalGuard ---");
  try {
    const secretContent = "confidential customer database record 123456789012345678901234567890";
    const ctx = createMockContext("universalGuard", {
      inputText: "give me details",
      universalOutputText: "Here is the " + secretContent,
      detectionEngine: "LOCAL",
      securityContext: {
        output: {
          destinationType: "EXTERNAL_API",
          destinationName: "https://api.external.com",
          protectedSources: [
            { sourceId: "crm-db", content: secretContent },
          ],
        },
      },
    });
    const res = await node.execute.call(ctx);
    const item = res[0]?.[0]?.json || res[1]?.[0]?.json;
    const egressCheck = (item?.checks || []).find(c => c.layer === "semanticEgress");
    const matched = egressCheck?.matchedSources?.length > 0;
    if (matched) {
      console.log("✅ Test 5b Passed! protectedSources array was preserved and semanticEgress caught leak:", egressCheck.matchedSources[0]);
    } else {
      console.log("❌ Test 5b Failed! protectedSources array was silently dropped by stringValue(output.protectedSources)!");
    }
  } catch (err) {
    console.log("❌ Test 5b Failed with error:", err.message);
  }

  // Test 6: ragScanner with REDACT_AND_INDEX
  console.log("\n--- Test 6: ragScanner routing with privacy data (REDACT_AND_INDEX) ---");
  try {
    const ctx = createMockContext("ragScanner", {
      ragText: "User phone is 9876543210 and email is test@example.com for order 123",
      documentId: "doc-1",
      detectionEngine: "LOCAL",
    });
    const res = await node.execute.call(ctx);
    const safeOutput = res[0] || [];
    if (safeOutput.length > 0) {
      console.log("✅ Test 6 Passed! Routed to Safe branch.");
    } else {
      console.log("❌ Test 6 Failed! Routed to Flagged branch even though recommendedAction was REDACT_AND_INDEX!");
    }
  } catch (err) {
    console.log("❌ Test 6 Error:", err.message);
  }

  // Test 7: allowedTopics and alwaysAllow as native Arrays
  console.log("\n--- Test 7: allowedTopics and alwaysAllow as Arrays ---");
  try {
    const ctx = createMockContext("inputGuard", {
      inputText: "What is your refund policy?",
      detectionEngine: "LOCAL",
      options: {
        allowedTopics: ["refunds", "returns", "billing"],
        alwaysAllow: ["What is your refund policy?", "Where is my order?"],
      },
    });
    const res = await node.execute.call(ctx);
    console.log("✅ Test 7 Passed! Result allowed:", res[0][0]?.json?.allowed);
  } catch (err) {
    console.log("❌ Test 7 Failed:", err.message);
  }

  // Test 8: unsupplied onThreat and protectionProfile (fallback resilience)
  console.log("\n--- Test 8: unsupplied onThreat and protectionProfile ---");
  try {
    const ctx = createMockContext("universalGuard", {
      inputText: "Hello AI",
      detectionEngine: "LOCAL",
      // onThreat and protectionProfile omitted
    });
    const res = await node.execute.call(ctx);
    console.log("✅ Test 8 Passed! Result allowed:", res[0][0]?.json?.allowed);
  } catch (err) {
    console.log("❌ Test 8 Failed:", err.message);
  }

  // Test 9: workflowAudit recognizing v3 Universal Guard operation
  console.log("\n--- Test 9: workflowAudit recognizing v3 Universal Guard operation ---");
  try {
    const v3Workflow = {
      name: "AI Support Workflow",
      nodes: [
        {
          name: "SoterAI Universal Guard",
          type: "n8n-nodes-soterai.soterGuard",
          typeVersion: 3,
          parameters: {
            resource: "guardrail",
            operation: "universalGuard",
          },
        },
        {
          name: "AI Agent",
          type: "@n8n/n8n-nodes-langchain.agent",
          typeVersion: 1,
          parameters: {},
        },
        {
          name: "Vector Store",
          type: "@n8n/n8n-nodes-langchain.vectorStorePinecone",
          typeVersion: 1,
          parameters: {},
        },
      ],
      connections: {},
    };
    const ctx = createMockContext("workflowAudit", {
      workflowJson: v3Workflow,
    });
    const res = await node.execute.call(ctx);
    const auditResult = res[0]?.[0]?.json || res[1]?.[0]?.json;
    const missingGuardFinding = (auditResult.findings || []).find(
      (f) => f.id === "soterai.universal_guard_missing" || f.id === "ai_agent.unprotected"
    );
    if (!missingGuardFinding) {
      console.log("✅ Test 9 Passed! v3 operation: 'universalGuard' correctly recognized (no false positive guard_missing finding).");
      console.log("Audit Score:", auditResult.securityScore);
    } else {
      console.log("❌ Test 9 Failed! False positive finding raised:", missingGuardFinding);
    }
  } catch (err) {
    console.log("❌ Test 9 Failed:", err.message);
  }
}

runEdgeCases();
