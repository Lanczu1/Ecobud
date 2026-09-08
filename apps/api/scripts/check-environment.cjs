const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Client } = require('pg');

async function main() {
  const issues = [];
  const report = (name, passed) => { console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`); if (!passed) issues.push(name); };
  const secret = process.env.JWT_SECRET || '';
  report('JWT secret length and placeholder check', secret.length >= 32 && !/replace|your-|example|development/i.test(secret));
  const origins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  report('Explicit HTTPS frontend origins', origins.length > 0 && origins.every(origin => {
    try { const url = new URL(origin); return url.protocol === 'https:' && url.origin === origin && !origin.includes('*'); } catch { return false; }
  }));
  for (const name of ['DATABASE_URL', 'DIRECT_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GMAIL_USER', 'GMAIL_PASS']) report(`${name} configured`, Boolean(process.env[name]?.trim()));
  if (process.argv.includes('--database')) {
    const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000, statement_timeout: 10000 });
    try {
      await client.connect();
      await client.query('BEGIN READ ONLY');
      const history = await client.query("SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS exists");
      report('Prisma migration history exists', history.rows[0].exists);
      if (history.rows[0].exists) {
        const migration = await client.query("SELECT 1 FROM public._prisma_migrations WHERE migration_name = '20260908000000_security_sessions' AND finished_at IS NOT NULL AND rolled_back_at IS NULL");
        report('Security migration applied', migration.rowCount === 1);
      }
      const columns = await client.query("SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND ((table_name='users' AND column_name IN ('sessionVersion','googleIdentityId')) OR (table_name='OtpCode' AND column_name='attempts'))");
      report('All three security schema columns exist', columns.rows.length === 3);
      const role = await client.query('SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user');
      report('Application DB role is not superuser or RLS-bypass', role.rows.length === 1 && !role.rows[0].rolsuper && !role.rows[0].rolbypassrls);
      const tables = await client.query(`SELECT DISTINCT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        JOIN information_schema.role_table_grants g ON g.table_schema=n.nspname AND g.table_name=c.relname
        WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity AND g.grantee IN ('anon','authenticated','PUBLIC')`);
      report('No publicly granted tables without RLS', tables.rows.length === 0);
      if (tables.rows.length) console.log('Tables requiring policy review: ' + tables.rows.map(row => row.relname).join(', '));
      const tls = await client.query('SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()');
      report('Database connection uses TLS', tls.rows[0]?.ssl === true);
      await client.query('ROLLBACK');
    } catch (error) {
      report('Read-only database inspection completed', false);
      console.log('Database check failed; code: ' + (typeof error.code === 'string' ? error.code : 'unavailable'));
    } finally { await client.end().catch(() => {}); }
  }
  console.log('Live OAuth, SMTP, proxy, backup restore, alerting and policy behavior still require staging verification.');
  process.exitCode = issues.length ? 1 : 0;
}
main().catch(() => { console.error('Environment check failed.'); process.exitCode = 1; });
