import { login, executeWorkflow } from './n8n-qa-harness.mjs';

async function main() {
  await login();
  const testWf = {
    name: 'test-v086-probe',
    nodes: [
      {
        parameters: {
          mode: 'runOnceForAllItems',
          jsCode: 'return [{ json: { inputText: "Hello world, I need help checking my subscription." } }];'
        },
        id: 'feeder',
        name: 'Feeder',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [0, 0]
      },
      {
        parameters: {
          resource: 'guardrail',
          operation: 'inputGuard',
          inputText: '={{ $json.inputText }}',
          onThreat: 'BLOCK',
          sensitivity: 'BALANCED',
          options: {
            detectionEngine: 'LOCAL'
          }
        },
        id: 'soter_node',
        name: 'SoterGuard',
        type: 'n8n-nodes-soterai.soterGuard',
        typeVersion: 3,
        position: [250, 0]
      }
    ],
    connections: {
      Feeder: { main: [[{ node: 'SoterGuard', type: 'main', index: 0 }]] }
    },
    settings: { executionOrder: 'v1' }
  };
  const res = await executeWorkflow(testWf, 'SoterGuard');
  console.log('Exec status:', res.status, 'Error:', res.error);
  const runs = res.runData?.['SoterGuard'];
  if (runs && runs[0]) {
    console.log('Output main 0 (Safe):', JSON.stringify(runs[0].data?.main?.[0]?.map(i => i.json), null, 2));
    console.log('Output main 1 (Flagged):', JSON.stringify(runs[0].data?.main?.[1]?.map(i => i.json), null, 2));
  }
}

main().catch(console.error);
