import 'dotenv/config';
import { resolve } from 'node:path';
import { defineConfig } from 'prisma/config';

// Resolve relative SQLite URLs from the project root, matching the runtime
// adapter instead of letting the migration engine resolve beside the schema.
const databaseUrl = process.env.DATABASE_URL ?? 'file:./prisma/dev.db';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: `file:${resolve(databaseUrl.slice('file:'.length))}` },
});
