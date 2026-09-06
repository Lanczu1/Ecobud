const jwt = require('jsonwebtoken');

async function test() {
  const token = jwt.sign({ sub: 'user-id-123', role: 'authenticated' }, 'ecobud-local-development-secret', { expiresIn: '1h' });
  
  console.log('Fetching with token...');
  const res = await fetch('http://localhost:3000/api/challenges/active', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Response:', text.substring(0, 500));
}

test();
