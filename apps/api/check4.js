const jwt = require('jsonwebtoken');

async function test() {
  const token = jwt.sign({ userId: 'cmtlm8ivs0000d36a5b1a9lrs' }, 'ecobud-local-development-secret', { expiresIn: '1h' });
  
  console.log('Fetching EC2 API with token...');
  try {
    const res = await fetch('https://ecobud.duckdns.org/api/challenges/active', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const text = await res.text();
    console.log('EC2 Status:', res.status);
    console.log('EC2 Response:', text.substring(0, 500));
  } catch (err) {
    console.log('EC2 Error:', err.message);
  }

  console.log('\nFetching Local API with token...');
  try {
    const res = await fetch('http://localhost:3000/api/challenges/active', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const text = await res.text();
    console.log('Local Status:', res.status);
    console.log('Local Response:', text.substring(0, 500));
  } catch (err) {
    console.log('Local Error:', err.message);
  }
}

test();
