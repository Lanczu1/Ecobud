const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function loadService(fetchRewards) {
  const source = ts.transpileModule(fs.readFileSync(`${__dirname}/homeService.ts`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    require: () => ({ ecobudApi: { fetchRewards } }),
  });
  return exports.homeService;
}

test('simultaneous rewards readers share one request and later refresh fetches again', async () => {
  let calls = 0;
  let resolve;
  const response = new Promise(done => { resolve = done; });
  const service = loadService(() => { calls++; return response; });
  const first = service.getRewards('account-a');
  assert.equal(service.getRewards('account-a'), first);
  assert.equal(calls, 1);
  const data = { points: 10, badges: [{ id: 'one' }], achievements: [] };
  resolve(data);
  assert.equal(await first, data);
  await service.getRewards('account-a');
  assert.equal(calls, 2);
});

test('failed rewards requests can retry and accounts do not share responses', async () => {
  let calls = 0;
  const service = loadService(token => {
    calls++;
    return calls === 1 ? Promise.reject(new Error('offline')) : Promise.resolve({ token });
  });
  await assert.rejects(service.getRewards('account-a'), /offline/);
  assert.equal((await service.getRewards('account-a')).token, 'account-a');
  const [a, b] = await Promise.all([service.getRewards('account-a'), service.getRewards('account-b')]);
  assert.equal(a.token, 'account-a');
  assert.equal(b.token, 'account-b');
  assert.equal(calls, 4);
});
