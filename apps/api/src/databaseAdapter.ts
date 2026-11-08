import { readFileSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';

// Query parameters that only the old Prisma query engine understood.
const ENGINE_ONLY_PARAMS = ['connection_limit', 'pool_timeout', 'pgbouncer', 'schema'];
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export const createDatabaseAdapter = (connectionUrl = process.env.DATABASE_URL) => {
  if (!connectionUrl) throw new Error('DATABASE_URL is not set.');

  const url = new URL(connectionUrl);
  const max = Number(url.searchParams.get('connection_limit')) || 10;
  const timeoutSeconds = Number(url.searchParams.get('pool_timeout')) || 10;
  for (const name of ENGINE_ONLY_PARAMS) url.searchParams.delete(name);

  // Remote databases always use TLS with certificate verification. Set
  // DATABASE_SSL_CA to a CA file (e.g. Supabase's) when the server's chain
  // is not in Node's default trust store.
  const caPath = process.env.DATABASE_SSL_CA?.trim();
  const ssl = LOCAL_HOSTS.has(url.hostname) && !caPath
    ? undefined
    : { rejectUnauthorized: true, ...(caPath ? { ca: readFileSync(caPath, 'utf8') } : {}) };

  return new PrismaPg({
    connectionString: url.toString(),
    max,
    connectionTimeoutMillis: timeoutSeconds * 1000,
    ssl,
  });
};
