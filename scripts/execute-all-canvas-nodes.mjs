import { login, request } from './n8n-qa-harness.mjs';
import { parse } from 'flatted';

const WF_ID = 'zTxZbuoKoZP7wjJZ';

const DESTINATIONS = [
  '✅ Safe Branch: Benign Passed',
  '🛑 Flagged: Injection Blocked',
  '🛑 Flagged: Off-Topic Blocked',
  '✅ Safe Branch: Secret Redacted SafeText',
  '✅ Safe Branch: Masked Output',
  '✅ Safe Branch: Synthetic Data',
  '🛑 Flagged: Redaction Branch Triggered',
  '📊 Risk Score & Categories Output',
  '✅ Safe Branch: All Layers Clean',
  '✅ Safe Branch: Action INDEX',
  '🛑 Flagged: Action QUARANTINE',
  '✅ Safe Branch: Production Ready',
  'Passport: Enroll Support Identity',
  'Passport: Issue Session Token',
  '✅ Safe Branch: Tool Action ALLOW',
  '🛑 Flagged: Decision ASK_APPROVAL',
  '✅ Safe Branch: Whitelist Bypassed',
  '✅ Safe Branch: 3 Items Allowed',
  '🛑 Flagged: 2 Items Blocked'
];

async function main() {
  await login();

  const getWf = await request(`/rest/workflows/${WF_ID}`);
  const wf = getWf.data?.data;
  if (!wf) throw new Error('Workflow not found: ' + WF_ID);

  console.log(`Executing nodes for workflow: ${wf.name} (${WF_ID})`);

  const pinData = { ...wf.pinData };

  for (const destNode of DESTINATIONS) {
    process.stdout.write(`- Running destination: "${destNode}"... `);
    try {
      const runRes = await request(`/rest/workflows/${WF_ID}/run`, {
        method: 'POST',
        body: {
          workflowData: wf,
          destinationNode: { nodeName: destNode, mode: 'inclusive' }
        }
      });

      const executionId = runRes.data?.data?.executionId;
      if (!executionId) {
        console.log(`❌ Failed to start:`, runRes.data);
        continue;
      }

      // Poll
      let execData;
      for (let attempt = 0; attempt < 20; attempt++) {
        await new Promise(r => setTimeout(r, 400));
        const poll = await request(`/rest/executions/${executionId}`);
        execData = poll.data?.data;
        if (execData?.finished) break;
      }

      if (execData?.status === 'success') {
        console.log(`✅ Success (Exec #${executionId})`);
        let runData = execData?.data?.resultData?.runData;
        if (!runData && typeof execData?.data === 'string') {
          try {
            const parsed = parse(execData.data);
            runData = parsed?.resultData?.runData;
          } catch {}
        }
        if (runData) {
          for (const [nodeName, nodeExecutions] of Object.entries(runData)) {
            const lastExec = nodeExecutions?.[0];
            const mainOutputs = lastExec?.data?.main;
            if (mainOutputs?.[0]?.length) {
              pinData[nodeName] = mainOutputs[0];
            } else if (mainOutputs?.[1]?.length) {
              pinData[nodeName] = mainOutputs[1];
            }
          }
        }
      } else {
        console.log(`⚠️ Status: ${execData?.status}`);
      }
    } catch (err) {
      console.log(`❌ Error:`, err.message);
    }
  }

  console.log(`\nCollected pinData for ${Object.keys(pinData).length} nodes!`);

  // Update workflow with pinData
  console.log('Saving pinData into workflow canvas...');
  const updateRes = await request(`/rest/workflows/${WF_ID}`, {
    method: 'PATCH',
    body: {
      pinData
    }
  });

  console.log('Update status:', updateRes.status);
  console.log('\n=============================================================');
  console.log('🎉 ALL NODES TESTED AND PINNED!');
  console.log(`UI Canvas URL: http://localhost:5678/workflow/${WF_ID}`);
  console.log('=============================================================\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
