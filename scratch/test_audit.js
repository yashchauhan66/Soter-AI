const test = async () => {
  try {
    const res = await fetch('https://soterai.in/api/workflow/audit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'ck_live_01234567890123456789'
      },
      body: JSON.stringify({ workflowJson: '{"nodes":[],"connections":{}}' })
    });
    console.log('Status:', res.status, res.statusText);
    const text = await res.text();
    console.log('Body:', text.slice(0, 500));
  } catch (err) {
    console.error('Fetch error:', err);
  }
};
test();
