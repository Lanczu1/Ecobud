const FormData = require('form-data');
const fetch = require('node-fetch');
const fs = require('fs');

async function run() {
  const form = new FormData();
  form.append('qrData', '6f45a8e904ee9db45625c92cbd69196b');
  form.append('image', fs.createReadStream(__filename)); // dummy image

  try {
    const res = await fetch('http://localhost:3000/events/cms1kh0qm000553vsco6yng2x/submissions', {
      method: 'POST',
      headers: {
        // I need a valid token. Let's just bypass auth for a moment or use an invalid token and see if auth fails.
        // If auth fails, I won't reach the log.
      },
      body: form
    });
    console.log(await res.text());
  } catch(e) { console.error(e) }
}
run();
