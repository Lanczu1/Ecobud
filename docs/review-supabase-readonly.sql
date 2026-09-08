-- Metadata only: no application records, credentials or database changes.
-- Run in the Supabase SQL Editor and share the result JSON.
-- The SQL Editor's role is not necessarily the Express runtime's role.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';
SELECT jsonb_build_object(
  'tables', (SELECT jsonb_agg(jsonb_build_object(
    'table', c.relname, 'rls_enabled', c.relrowsecurity, 'force_rls', c.relforcerowsecurity
  ) ORDER BY c.relname) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')),
  'policies', (SELECT jsonb_agg(to_jsonb(p)) FROM (
    SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
    FROM pg_policies WHERE schemaname IN ('public','storage','realtime')
    ORDER BY schemaname,tablename,policyname
  ) p),
  'client_grants', (SELECT jsonb_agg(to_jsonb(g)) FROM (
    SELECT c.relname AS table_name,r.rolname,
      has_table_privilege(r.oid,c.oid,'SELECT') AS sel,
      has_table_privilege(r.oid,c.oid,'INSERT') AS ins,
      has_table_privilege(r.oid,c.oid,'UPDATE') AS upd,
      has_table_privilege(r.oid,c.oid,'DELETE') AS del,
      has_table_privilege(r.oid,c.oid,'TRUNCATE') AS trunc
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN pg_roles r
    WHERE n.nspname='public' AND c.relkind IN ('r','p') AND r.rolname IN ('anon','authenticated')
    ORDER BY c.relname,r.rolname
  ) g),
  'default_grants', (SELECT jsonb_agg(to_jsonb(dg)) FROM (
    SELECT COALESCE(n.nspname,'all') AS schema_name,d.defaclobjtype AS object_type,
      CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,a.privilege_type
    FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace,
      LATERAL aclexplode(d.defaclacl) a
    WHERE (n.nspname='public' OR d.defaclnamespace=0)
      AND (a.grantee=0 OR pg_get_userbyid(a.grantee) IN ('anon','authenticated'))
  ) dg),
  'views', (SELECT jsonb_agg(jsonb_build_object('name',c.relname,'options',c.reloptions))
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('v','m')),
  'functions', (SELECT jsonb_agg(jsonb_build_object(
      'name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),
      'security_definer',p.prosecdef,'config',p.proconfig,
      'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),
      'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE')
    )) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'),
  'columns', (SELECT jsonb_agg(to_jsonb(c)) FROM (
    SELECT table_name,column_name,data_type,is_nullable,column_default
    FROM information_schema.columns WHERE table_schema='public'
    ORDER BY table_name,ordinal_position
  ) c),
  'constraints', (SELECT jsonb_agg(jsonb_build_object(
    'table',t.relname,'name',c.conname,'type',c.contype,'definition',pg_get_constraintdef(c.oid)
  )) FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public'),
  'migration_history_present', to_regclass('public._prisma_migrations') IS NOT NULL
) AS review_metadata;
ROLLBACK;
