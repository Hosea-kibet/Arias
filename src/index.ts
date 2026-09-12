import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createDb } from './db.js';

const config = loadConfig();
const db = createDb(config.DATABASE_URL);
const app = buildApp(config, db);

app.addHook('onClose', async () => { await db.$disconnect(); });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close().catch(() => { process.exitCode = 1; });
  });
}

try {
  await db.$connect();
  await app.listen({ host: config.HOST, port: config.PORT });
} catch {
  app.log.error('Startup failed; check configuration, database migrations, and port availability');
  await app.close();
  process.exitCode = 1;
}
