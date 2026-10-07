import { request, runAdHoc, branch } from './rt5678/helpers.mjs';

async function main() {
  await request('/rest/login', {
    method: 'POST',
    body: { emailOrLdapLoginId: 'admin@example.com', password: 'Password123!' }
  });

  const sess = 'sess-chain-' + Date.now();
  console.log('Testing session:', sess);

  // 1. Enroll
  const wfEnroll = {
    name: 'test-enroll-' + Date.now(),
    nodes: [
      {
        parameters: { mode: 'runOnceForAllItems', jsCode: 'return [{ json: { name: "Agent-Chain" } }];' },
        id: 'f1', name: 'Feeder', type: 'n8n-nodes-base.code', typeVersion: 2, position: [0, 0]
      },
      {
        parameters: {
          resource: 'agentPassport', operation: 'enrollIdentity',
          agentName: '={{ $json.name }}', agentType: 'CUSTOMER_SUPPORT', passportPolicyPreset: 'READ_ONLY'
        },
        id: 's1', name: 'Soter', type: 'n8n-nodes-soterai.soterGuard', typeVersion: 3, position: [200, 0],
        credentials: { soterApi: { id: 'jp7mO4AKCUhn0TY2', name: 'SoterAI Production Cloud' } }
      }
    ],
    connections: { Feeder: { main: [[{ node: 'Soter', type: 'main', index: 0 }]] } },
    settings: { executionOrder: 'v1' }
  };
  const execEnroll = await runAdHoc(wfEnroll, 'Soter');
  const enrollItem = branch(execEnroll.runData, 'Soter', 0).items[0];
  console.log('Enroll result:', enrollItem);
  const agentId = enrollItem?.agentIdentityId || enrollItem?.id;

  // 2. Issue
  const wfIssue = {
    name: 'test-issue-' + Date.now(),
    nodes: [
      {
        parameters: { mode: 'runOnceForAllItems', jsCode: `return [{ json: { id: ${JSON.stringify(agentId)}, sess: ${JSON.stringify(sess)} } }];` },
        id: 'f2', name: 'Feeder', type: 'n8n-nodes-base.code', typeVersion: 2, position: [0, 0]
      },
      {
        parameters: {
          resource: 'agentPassport', operation: 'issuePassport',
          agentIdentityId: '={{ $json.id }}', sessionId: '={{ $json.sess }}', passportTtlSeconds: 300
        },
        id: 's2', name: 'Soter', type: 'n8n-nodes-soterai.soterGuard', typeVersion: 3, position: [200, 0],
        credentials: { soterApi: { id: 'jp7mO4AKCUhn0TY2', name: 'SoterAI Production Cloud' } }
      }
    ],
    connections: { Feeder: { main: [[{ node: 'Soter', type: 'main', index: 0 }]] } },
    settings: { executionOrder: 'v1' }
  };
  const execIssue = await runAdHoc(wfIssue, 'Soter');
  const issueItem = branch(execIssue.runData, 'Soter', 0).items[0];
  console.log('Issue result:', issueItem);

  // 3. Revoke
  const pId = issueItem?.passportId || '';
  const wfRevoke = {
    name: 'test-revoke-' + Date.now(),
    nodes: [
      {
        parameters: { mode: 'runOnceForAllItems', jsCode: `return [{ json: { sess: ${JSON.stringify(sess)}, pid: ${JSON.stringify(pId)} } }];` },
        id: 'f3', name: 'Feeder', type: 'n8n-nodes-base.code', typeVersion: 2, position: [0, 0]
      },
      {
        parameters: {
          resource: 'agentPassport', operation: 'revokePassport',
          sessionId: '={{ $json.sess }}', passportId: '={{ $json.pid }}', revokeReason: 'Test completion'
        },
        id: 's3', name: 'Soter', type: 'n8n-nodes-soterai.soterGuard', typeVersion: 3, position: [200, 0],
        credentials: { soterApi: { id: 'jp7mO4AKCUhn0TY2', name: 'SoterAI Production Cloud' } }
      }
    ],
    connections: { Feeder: { main: [[{ node: 'Soter', type: 'main', index: 0 }]] } },
    settings: { executionOrder: 'v1' }
  };
  const execRevoke = await runAdHoc(wfRevoke, 'Soter');
  console.log('Revoke status:', execRevoke.status);
  console.log('Revoke output:', branch(execRevoke.runData, 'Soter', 0).items[0] || execRevoke.error);
}

main().catch(console.error);
