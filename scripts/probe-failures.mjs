import { request, runAdHoc } from './rt5678/helpers.mjs';

async function main() {
  await request('/rest/login', {
    method: 'POST',
    body: { emailOrLdapLoginId: 'admin@example.com', password: 'Password123!' }
  });

  // 1. Inspect OP-03-UNIVERSAL-LOCAL
  console.log('\n=== 1. Inspect OP-03-UNIVERSAL-LOCAL ===');
  const wf3 = {
    name: 'probe-universal-' + Date.now(),
    nodes: [
      {
        parameters: { mode: 'runOnceForAllItems', jsCode: 'return [{ json: { userPrompt: "Help with account", agentOutput: "Your account is active." } }];' },
        id: 'f1', name: 'Feeder', type: 'n8n-nodes-base.code', typeVersion: 2, position: [0, 0]
      },
      {
        parameters: {
          resource: 'guardrail', operation: 'universalGuard',
          inputText: '={{ $json.userPrompt }}', universalOutputText: '={{ $json.agentOutput }}',
          protectionProfile: 'standard', onThreat: 'BLOCK',
          options: { detectionEngine: 'LOCAL' }
        },
        id: 's1', name: 'Soter', type: 'n8n-nodes-soterai.soterGuard', typeVersion: 3, position: [200, 0]
      }
    ],
    connections: { Feeder: { main: [[{ node: 'Soter', type: 'main', index: 0 }]] } },
    settings: { executionOrder: 'v1' }
  };
  const exec3 = await runAdHoc(wf3, 'Soter');
  console.log('Status:', exec3.status);
  console.log('Branch 0 (Safe):', JSON.stringify(exec3.runData?.Soter?.[0]?.data?.main?.[0], null, 2));
  console.log('Branch 1 (Flagged):', JSON.stringify(exec3.runData?.Soter?.[0]?.data?.main?.[1], null, 2));

  // 2. Inspect OP-05-PII-BRANCHING
  console.log('\n=== 2. Inspect OP-05-PII-BRANCHING ===');
  const wf5 = {
    name: 'probe-pii-branch-' + Date.now(),
    nodes: [
      {
        parameters: { mode: 'runOnceForAllItems', jsCode: 'return [{ json: { text: "Card: 4532 1111 2222 3333 CVV 891" } }];' },
        id: 'f2', name: 'Feeder', type: 'n8n-nodes-base.code', typeVersion: 2, position: [0, 0]
      },
      {
        parameters: {
          resource: 'guardrail', operation: 'piiRedactor',
          piiText: '={{ $json.text }}',
          options: { detectionEngine: 'LOCAL', branchOnRedaction: true }
        },
        id: 's2', name: 'Soter', type: 'n8n-nodes-soterai.soterGuard', typeVersion: 3, position: [200, 0]
      }
    ],
    connections: { Feeder: { main: [[{ node: 'Soter', type: 'main', index: 0 }]] } },
    settings: { executionOrder: 'v1' }
  };
  const exec5 = await runAdHoc(wf5, 'Soter');
  console.log('Status:', exec5.status);
  console.log('Branch 0 (Clean):', JSON.stringify(exec5.runData?.Soter?.[0]?.data?.main?.[0], null, 2));
  console.log('Branch 1 (Redacted):', JSON.stringify(exec5.runData?.Soter?.[0]?.data?.main?.[1], null, 2));

  // 3. Inspect OP-07-WF-AUDIT
  console.log('\n=== 3. Inspect OP-07-WF-AUDIT ===');
  const sampleWf = JSON.stringify({ nodes: [{ name: 'Cmd', type: 'n8n-nodes-base.executeCommand', parameters: { command: 'ls' } }] });
  const wf7 = {
    name: 'probe-audit-' + Date.now(),
    nodes: [
      {
        parameters: { mode: 'runOnceForAllItems', jsCode: `return [{ json: { wf: ${JSON.stringify(sampleWf)} } }];` },
        id: 'f3', name: 'Feeder', type: 'n8n-nodes-base.code', typeVersion: 2, position: [0, 0]
      },
      {
        parameters: {
          resource: 'workflow', operation: 'workflowAudit',
          workflowJson: '={{ $json.wf }}'
        },
        id: 's3', name: 'Soter', type: 'n8n-nodes-soterai.soterGuard', typeVersion: 3, position: [200, 0]
      }
    ],
    connections: { Feeder: { main: [[{ node: 'Soter', type: 'main', index: 0 }]] } },
    settings: { executionOrder: 'v1' }
  };
  const exec7 = await runAdHoc(wf7, 'Soter');
  console.log('Status:', exec7.status);
  console.log('Audit Result item:', JSON.stringify(exec7.runData?.Soter?.[0]?.data?.main?.[0]?.[0]?.json, null, 2));

  // 4. Inspect OP-12-REVOKE-PASS error
  console.log('\n=== 4. Inspect OP-12-REVOKE-PASS ===');
  const wf12 = {
    name: 'probe-revoke-' + Date.now(),
    nodes: [
      {
        parameters: { mode: 'runOnceForAllItems', jsCode: 'return [{ json: { sess: "sess-test-8899" } }];' },
        id: 'f4', name: 'Feeder', type: 'n8n-nodes-base.code', typeVersion: 2, position: [0, 0]
      },
      {
        parameters: {
          resource: 'agentPassport', operation: 'revokePassport',
          sessionId: '={{ $json.sess }}'
        },
        id: 's4', name: 'Soter', type: 'n8n-nodes-soterai.soterGuard', typeVersion: 3, position: [200, 0],
        credentials: { soterApi: { id: 'jp7mO4AKCUhn0TY2', name: 'SoterAI Production Cloud' } }
      }
    ],
    connections: { Feeder: { main: [[{ node: 'Soter', type: 'main', index: 0 }]] } },
    settings: { executionOrder: 'v1' }
  };
  const exec12 = await runAdHoc(wf12, 'Soter');
  console.log('Status:', exec12.status);
  console.log('Error:', JSON.stringify(exec12.error, null, 2));

  // 5. Inspect EDGE-03-IGNORED-ENTITIES
  console.log('\n=== 5. Inspect EDGE-03-IGNORED-ENTITIES ===');
  const wfE3 = {
    name: 'probe-e3-' + Date.now(),
    nodes: [
      {
        parameters: { mode: 'runOnceForAllItems', jsCode: 'return [{ json: { text: "Contact me at user@example.com or card 4111 2222 3333 4444" } }];' },
        id: 'fe3', name: 'Feeder', type: 'n8n-nodes-base.code', typeVersion: 2, position: [0, 0]
      },
      {
        parameters: {
          resource: 'guardrail', operation: 'piiRedactor',
          piiText: '={{ $json.text }}',
          options: { detectionEngine: 'LOCAL', ignoredEntities: 'EMAIL' }
        },
        id: 'se3', name: 'Soter', type: 'n8n-nodes-soterai.soterGuard', typeVersion: 3, position: [200, 0]
      }
    ],
    connections: { Feeder: { main: [[{ node: 'Soter', type: 'main', index: 0 }]] } },
    settings: { executionOrder: 'v1' }
  };
  const execE3 = await runAdHoc(wfE3, 'Soter');
  console.log('Item output:', JSON.stringify(execE3.runData?.Soter?.[0]?.data?.main?.[0]?.[0]?.json, null, 2));
}

main().catch(console.error);
