const res = await fetch('http://localhost:5678/rest/executions/1', {
  headers: {
    cookie: process.argv[2] || ''
  }
});
const json = await res.json();
console.log('Execution Status:', json.data?.status);
console.log('Error:', JSON.stringify(json.data?.data?.resultData?.error || json.data?.data?.executionData?.error || json.data?.data?.resultData?.runData, null, 2));
