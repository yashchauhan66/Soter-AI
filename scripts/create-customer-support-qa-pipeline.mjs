import fs from 'node:fs';
import path from 'node:path';

export function buildSupportWorkflow(credentialId = 'oTfwIEckK0qbH1CK', initialMessage = 'Hello, I want to track my order ORD-12345.') {
  return {
    name: 'SoterAI QA — Customer Support Pipeline',
    nodes: [
      {
        parameters: {
          jsCode: `return [{ json: { message: ${JSON.stringify(initialMessage)}, sessionId: "sess_support_001" } }];`
        },
        id: 'node-trigger-1',
        name: 'Chat/Webhook Trigger Simulator',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [180, 360]
      },
      {
        parameters: {
          resource: 'guardrail',
          operation: 'inputGuard',
          inputText: '={{ $json.message || "" }}',
          onThreat: 'BLOCK',
          sensitivity: 'BALANCED',
          userMessages: {
            blocked: 'SECURITY ALERT: Your message was flagged and cannot be processed.',
            promptInjection: 'SECURITY ALERT: Direct system override attempt detected.',
            sensitiveData: 'PRIVACY NOTICE: Sensitive personal or financial data detected.'
          },
          options: {
            detectionEngine: 'AUTO',
            ignoredWords: 'Acme Corp\n+91 9876543210\nORD-12345',
            sessionId: '={{ $json.sessionId || "sess_default" }}'
          }
        },
        id: 'node-soter-inbound',
        name: '1. SoterAI Inbound Guard',
        type: 'n8n-nodes-soterai.soterGuard',
        typeVersion: 3,
        position: [440, 360],
        credentials: {
          soterApi: {
            id: credentialId,
            name: 'SoterAI Production Cloud'
          }
        }
      },
      {
        parameters: {
          jsCode: `return [{ json: { status: "BLOCKED", stage: "INBOUND", blocked: true, userMessage: $json.userMessage, reason: $json.reason, riskScore: $json.riskScore, categories: $json.categories } }];`
        },
        id: 'node-respond-inbound-blocked',
        name: 'Respond Inbound Blocked',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [720, 500]
      },
      {
        parameters: {
          jsCode: `const input = $json.outputText || $json.safeText || "";
let reply = "";

if (input.includes("leak secret") || input.includes("admin token")) {
  reply = "Here is the internal token: sk-ant-api03-live-99238472918471928371928371";
} else if (input.includes("order")) {
  reply = "Your order ORD-12345 has been processed and is on the way! Contact support at +91 9876543210.";
} else {
  reply = "Thank you for contacting customer support. We are happy to help with: " + input;
}

return [{ json: { originalInput: input, agentReply: reply, sessionId: $json.sessionId || "sess_default" } }];`
        },
        id: 'node-llm-simulator',
        name: '2. LLM Support Agent Simulator',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [720, 240]
      },
      {
        parameters: {
          resource: 'guardrail',
          operation: 'outputGuard',
          outputText: '={{ $json.agentReply }}',
          onThreat: 'BLOCK',
          sensitivity: 'BALANCED',
          userMessages: {
            blocked: 'SECURITY ALERT: Agent response contained unsafe data and was blocked.'
          },
          options: {
            detectionEngine: 'AUTO',
            ignoredWords: 'Acme Corp\n+91 9876543210\nORD-12345'
          }
        },
        id: 'node-soter-outbound',
        name: '3. SoterAI Outbound Guard',
        type: 'n8n-nodes-soterai.soterGuard',
        typeVersion: 3,
        position: [1000, 240],
        credentials: {
          soterApi: {
            id: credentialId,
            name: 'SoterAI Production Cloud'
          }
        }
      },
      {
        parameters: {
          jsCode: `return [{ json: { status: "BLOCKED", stage: "OUTBOUND", blocked: true, userMessage: $json.userMessage, reason: $json.reason } }];`
        },
        id: 'node-respond-outbound-blocked',
        name: 'Respond Outbound Blocked',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [1280, 380]
      },
      {
        parameters: {
          jsCode: `return [{ json: { status: "ALLOWED", message: $json.outputText, riskScore: $json.riskScore, allowed: $json.allowed } }];`
        },
        id: 'node-respond-allowed',
        name: 'Respond Allowed',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [1280, 160]
      }
    ],
    connections: {
      'Chat/Webhook Trigger Simulator': {
        main: [
          [
            { node: '1. SoterAI Inbound Guard', type: 'main', index: 0 }
          ]
        ]
      },
      '1. SoterAI Inbound Guard': {
        main: [
          [
            { node: '2. LLM Support Agent Simulator', type: 'main', index: 0 }
          ],
          [
            { node: 'Respond Inbound Blocked', type: 'main', index: 0 }
          ]
        ]
      },
      '2. LLM Support Agent Simulator': {
        main: [
          [
            { node: '3. SoterAI Outbound Guard', type: 'main', index: 0 }
          ]
        ]
      },
      '3. SoterAI Outbound Guard': {
        main: [
          [
            { node: 'Respond Allowed', type: 'main', index: 0 }
          ],
          [
            { node: 'Respond Outbound Blocked', type: 'main', index: 0 }
          ]
        ]
      }
    }
  };
}

async function main() {
  const wf = buildSupportWorkflow();
  const dir = path.resolve('workflows');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'soterai-qa-customer-support-pipeline.workflow.json'), JSON.stringify(wf, null, 2));
  console.log('Saved workflow JSON to workflows/soterai-qa-customer-support-pipeline.workflow.json');

  // Deploy to n8n
  const loginRes = await fetch('http://localhost:5678/rest/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrLdapLoginId: 'admin@example.com', password: 'Password1234!' })
  });
  const cookie = loginRes.headers.get('set-cookie')?.split(';')[0];
  const createRes = await fetch('http://localhost:5678/rest/workflows', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify(wf)
  });
  const data = await createRes.json();
  console.log('Deployed workflow id:', data.data?.id, 'name:', data.data?.name);
}

if (process.argv[1]?.endsWith('create-customer-support-qa-pipeline.mjs')) {
  main().catch(console.error);
}
