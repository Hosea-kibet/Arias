import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createDb } from './db.js';
import { EventRepository } from './repositories/event.repository.js';
import { EventService } from './services/event.service.js';
import { createSlackApp } from './integrations/slack/slack.app.js';

const config = loadConfig();
const db = createDb(config.DATABASE_URL);
const events = new EventService(new EventRepository(db));
const app = buildApp(config, db, events);
const slack = config.SLACK_BOT_TOKEN && config.SLACK_APP_TOKEN
  ? createSlackApp(config, events)
  : undefined;

app.addHook('onClose', async () => {
  if (slack) await slack.stop();
  await db.$disconnect();
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close().catch(() => { process.exitCode = 1; });
  });
}

try {
  await db.$connect();
  if (slack) await slack.start();
  await app.listen({ host: config.HOST, port: config.PORT });
} catch {
  app.log.error('Startup failed; check configuration, database migrations, and port availability');
  await app.close();
  process.exitCode = 1;
}
