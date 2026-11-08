import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma 7 reads connection URLs here instead of schema.prisma.
// Migrate needs the direct (session) connection, not the pooled one.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || '',
  },
});
