// Metadata-only review. Never reads application records or changes DB state.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Client } = require('pg');

async function main() {
  const url = new URL(process.env.DATABASE_URL);
  const caPath = process.env.SUPABASE_DB_CA_FILE;
  const ca = caPath ? require('fs').readFileSync(path.resolve(caPath), 'utf8') : undefined;
  // Require verified TLS for this inspection regardless of development defaults.
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) url.searchParams.delete(key);
  const client = new Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) }, connectionTimeoutMillis: 10000, statement_timeout: 10000 });
  const output = {};
  try {
    await client.connect();
    await client.query('BEGIN READ ONLY');
    output.connection = (await client.query(`SELECT current_setting('transaction_read_only') AS read_only,
      (SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()) AS inspection_tls,
      rolsuper, rolbypassrls, rolinherit FROM pg_roles WHERE rolname=current_user`)).rows;
    output.tables = (await client.query(`SELECT c.relname AS table_name, c.relrowsecurity AS rls,
      c.relforcerowsecurity AS force_rls, pg_get_userbyid(c.relowner)=current_user AS owned_by_runtime,
      has_table_privilege(current_user,c.oid,'SELECT') AS runtime_select,
      has_table_privilege(current_user,c.oid,'INSERT') AS runtime_insert,
      has_table_privilege(current_user,c.oid,'UPDATE') AS runtime_update,
      has_table_privilege(current_user,c.oid,'DELETE') AS runtime_delete
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY c.relname`)).rows;
    output.policies = (await client.query(`SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies WHERE schemaname IN ('public','storage','realtime') ORDER BY schemaname,tablename,policyname`)).rows;
    output.effective_client_grants = (await client.query(`SELECT c.relname AS table_name, r.rolname,
      has_table_privilege(r.oid,c.oid,'SELECT') AS sel, has_table_privilege(r.oid,c.oid,'INSERT') AS ins,
      has_table_privilege(r.oid,c.oid,'UPDATE') AS upd, has_table_privilege(r.oid,c.oid,'DELETE') AS del,
      has_table_privilege(r.oid,c.oid,'TRUNCATE') AS trunc, has_table_privilege(r.oid,c.oid,'REFERENCES') AS refs,
      has_table_privilege(r.oid,c.oid,'TRIGGER') AS trig
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN pg_roles r
      WHERE n.nspname='public' AND c.relkind IN ('r','p') AND r.rolname IN ('anon','authenticated')
      ORDER BY c.relname,r.rolname`)).rows;
    output.schema_privileges = (await client.query(`SELECT r.rolname, has_schema_privilege(r.oid,'public','USAGE') AS usage,
      has_schema_privilege(r.oid,'public','CREATE') AS create_objects FROM pg_roles r WHERE r.rolname IN ('anon','authenticated')`)).rows;
    output.views = (await client.query(`SELECT c.relname, c.reloptions FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('v','m') ORDER BY c.relname`)).rows;
    output.functions = (await client.query(`SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
      p.prosecdef AS security_definer, p.proconfig,
      has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
      has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY p.proname`)).rows;
    output.default_grants = (await client.query(`SELECT pg_get_userbyid(d.defaclrole)=current_user AS runtime_owner,
      COALESCE(n.nspname,'all') AS schema_name,d.defaclobjtype AS object_type,
      CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,a.privilege_type
      FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace,
      LATERAL aclexplode(d.defaclacl) a
      WHERE (n.nspname='public' OR d.defaclnamespace=0) AND (a.grantee=0 OR pg_get_userbyid(a.grantee) IN ('anon','authenticated'))`)).rows;
    output.columns = (await client.query(`SELECT table_name,column_name,data_type,is_nullable,column_default FROM information_schema.columns
      WHERE table_schema='public' ORDER BY table_name,ordinal_position`)).rows;
    output.constraints = (await client.query(`SELECT t.relname AS table_name,c.conname,c.contype,pg_get_constraintdef(c.oid) AS definition
      FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
      WHERE n.nspname='public' ORDER BY t.relname,c.conname`)).rows;
    const history = (await client.query("SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS present")).rows[0].present;
    output.migration_history_present = history;
    if (history) output.migrations = (await client.query('SELECT migration_name,finished_at IS NOT NULL AS finished,rolled_back_at IS NOT NULL AS rolled_back FROM public._prisma_migrations ORDER BY started_at')).rows;
    await client.query('ROLLBACK');
    // Restrict stored output to metadata. No names, emails, records, credentials or URLs.
    require('fs').writeFileSync(path.join(__dirname,'../../../docs/database-review-metadata.json'), JSON.stringify(output,null,2));
    const columns = output.columns.filter(c=>['sessionVersion','googleIdentityId','attempts'].includes(c.column_name));
    console.log(JSON.stringify({connection:output.connection,tables:output.tables,policies:output.policies,
      effective_client_grants:output.effective_client_grants,schema_privileges:output.schema_privileges,
      views:output.views,functions:output.functions,default_grants:output.default_grants,
      security_columns:columns,migration_history_present:history},null,2));
  } catch (error) { console.error('Read-only review failed; code: '+(error.code || 'unavailable')); process.exitCode=1; }
  finally { await client.end().catch(()=>{}); }
}
main().catch(()=>{console.error('Review configuration is unavailable.');process.exitCode=1;});
