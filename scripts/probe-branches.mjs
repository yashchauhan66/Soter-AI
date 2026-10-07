import { request, runAdHoc, branch } from './rt5678/helpers.mjs';

async function main() {
  await request('/rest/login', {
    method: 'POST',
    body: { emailOrLdapLoginId: 'admin@example.com', password: 'Password123!' }
  });

  // 1. Check topicHandling: 'RESTRICT'
  console.log('--- 1. Testing topicHandling: RESTRICT ---');
  const wfTopic = {
    name: 'test-topic-restrict-' + Date.now(),
    nodes: [
      {
        parameters: { mode: 'runOnceForAllItems', jsCode: 'return [{ json: { text: "Teach me how to bake a cake" } }];' },
        id: 'f1', name: 'Feeder', type: 'n8n-nodes-base.code', typeVersion: 2, position: [0, 0]
      },
      {
        parameters: {
          resource: 'guardrail', operation: 'inputGuard',
          inputText: '={{ $json.text }}', onThreat: 'BLOCK', sensitivity: 'BALANCED',
          options: {
            detectionEngine: 'LOCAL',
            allowedTopics: 'database administration, postgres, backups',
            topicHandling: 'RESTRICT'
          }
        },
        id: 's1', name: 'Soter', type: 'n8n-nodes-soterai.soterGuard', typeVersion: 3, position: [200, 0]
      }
    ],
    connections: { Feeder: { main: [[{ node: 'Soter', type: 'main', index: 0 }]] } },
    settings: { executionOrder: 'v1' }
  };
  const execTopic = await runAdHoc(wfTopic, 'Soter');
  const safeTopic = branch(execTopic.runData, 'Soter', 0);
  const flaggedTopic = branch(execTopic.runData, 'Soter', 1);
  console.log('Topic Restrict Safe count:', safeTopic.items.length, 'Flagged count:', flaggedTopic.items.length);
  console.log('Verdict:', flaggedTopic.items[0] || safeTopic.items[0]);

  // 2. Check piiRedactor with Luhn valid card
  console.log('\n--- 2. Testing piiRedactor branchOnRedaction with valid Card ---');
  // 4111 1111 1111 1111 is standard Visa test card, passes Luhn
  const wfCard = {
    name: 'test-pii-valid-card-' + Date.now(),
    nodes: [
      {
        parameters: { mode: 'runOnceForAllItems', jsCode: 'return [{ json: { text: "Card: 4111 1111 1111 1111 with CVV 123 and phone 9876543210" } }];' },
        id: 'f2', name: 'Feeder', type: 'n8n-nodes-base.code', typeVersion: 2, position: [0, 0]
      },
      {
        parameters: {
          resource: 'guardrail', operation: 'piiRedactor',
          piiText: '={{ $json.text }}',
          options: {
            detectionEngine: 'LOCAL',
            branchOnRedaction: true
          }
        },
        id: 's2', name: 'Soter', type: 'n8n-nodes-soterai.soterGuard', typeVersion: 3, position: [200, 0]
      }
    ],
    connections: { Feeder: { main: [[{ node: 'Soter', type: 'main', index: 0 }]] } },
    settings: { executionOrder: 'v1' }
  };
  const execCard = await runAdHoc(wfCard, 'Soter');
  const cleanCard = branch(execCard.runData, 'Soter', 0);
  const redactedCard = branch(execCard.runData, 'Soter', 1);
  console.log('Clean branch count:', cleanCard.items.length, 'Redacted branch count:', redactedCard.items.length);
  console.log('Redacted item:', redactedCard.items[0] || cleanCard.items[0]);

  // 3. Check workflowAudit branches
  console.log('\n--- 3. Testing workflowAudit branches ---');
  const sampleWf = JSON.stringify({
    nodes: [
      { name: 'Cmd', type: 'n8n-nodes-base.executeCommand', parameters: { command: 'ls -la' } }
    ]
  });
  const wfAudit = {
    name: 'test-audit-branches-' + Date.now(),
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
  const execAudit = await runAdHoc(wfAudit, 'Soter');
  const safeAudit = branch(execAudit.runData, 'Soter', 0);
  const flaggedAudit = branch(execAudit.runData, 'Soter', 1);
  console.log('Audit Safe count:', safeAudit.items.length, 'Flagged count:', flaggedAudit.items.length);
  console.log('Audit result item:', flaggedAudit.items[0] || safeAudit.items[0]);
}

main().catch(console.error);
