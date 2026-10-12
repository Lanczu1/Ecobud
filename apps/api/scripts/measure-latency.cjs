// Read-only latency check for the API. Sends GET requests only.
//
//   npm run measure -- --url https://api.example.com --paths /api/health,/api/home --concurrency 20 --duration 15
//
// Set ECOBUD_TOKEN to a bearer token to measure signed-in routes. Each path is measured twice:
// plain reads, then conditional reads that should come back as 304 with almost no body.
// Run it against staging first; high concurrency is real load on the server and database.

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const baseUrl = option('url', 'http://localhost:3000').replace(/\/$/, '');
const paths = option('paths', '/api/health').split(',').map(value => value.trim()).filter(Boolean);
const concurrency = Math.max(1, Number(option('concurrency', '10')));
const durationMs = Math.max(1, Number(option('duration', '10'))) * 1000;
const token = process.env.ECOBUD_TOKEN || '';

const percentile = (sorted, p) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] : 0;

async function measure(path, conditional) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  let tag = '';
  if (conditional) {
    const first = await fetch(baseUrl + path, { headers });
    await first.arrayBuffer();
    tag = first.headers.get('etag') || '';
    if (!tag) return null;
  }
  const times = [];
  const statuses = {};
  let bytes = 0;
  let failed = 0;
  const stopAt = Date.now() + durationMs;
  const worker = async () => {
    while (Date.now() < stopAt) {
      const startedAt = performance.now();
      try {
        const response = await fetch(baseUrl + path, {
          headers: tag ? { ...headers, 'If-None-Match': tag } : headers,
          signal: AbortSignal.timeout(30000),
        });
        const size = (await response.arrayBuffer()).byteLength;
        bytes += size;
        statuses[response.status] = (statuses[response.status] || 0) + 1;
        times.push(performance.now() - startedAt);
      } catch {
        failed += 1;
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  times.sort((a, b) => a - b);
  return {
    requests: times.length,
    failed,
    perSecond: Math.round(times.length / (durationMs / 1000)),
    p50: Math.round(percentile(times, 0.5)),
    p95: Math.round(percentile(times, 0.95)),
    p99: Math.round(percentile(times, 0.99)),
    avgBytes: times.length ? Math.round(bytes / times.length) : 0,
    statuses: Object.entries(statuses).map(([status, count]) => `${status}x${count}`).join(' '),
  };
}

async function main() {
  console.log(`Target ${baseUrl} | ${concurrency} concurrent | ${durationMs / 1000}s per run | ${token ? 'signed in' : 'no token'}`);
  let problems = 0;
  for (const path of paths) {
    for (const conditional of [false, true]) {
      const label = `${path} ${conditional ? '(conditional)' : '(full)'}`;
      const result = await measure(path, conditional);
      if (!result) { console.log(`${label}: the server sent no ETag, skipped`); continue; }
      if (result.failed || !result.requests) problems += 1;
      console.log(`${label}: ${result.requests} requests, ${result.perSecond}/s, p50 ${result.p50}ms, p95 ${result.p95}ms, p99 ${result.p99}ms, ` +
        `avg ${result.avgBytes} bytes, statuses ${result.statuses || 'none'}, failed ${result.failed}`);
    }
  }
  process.exitCode = problems ? 1 : 0;
}

main().catch(error => { console.error('Measurement failed:', error.message); process.exitCode = 1; });
