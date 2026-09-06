const jwt = require('jsonwebtoken');

async function test() {
  const token = jwt.sign({ userId: 'cmtlm8ivs0000d36a5b1a9lrs' }, 'ecobud-local-development-secret', { expiresIn: '1h' });
  
  console.time('ec2-latency');
  await fetch('https://ecobud.duckdns.org/api/challenges/active', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.timeEnd('ec2-latency');
}

test();
