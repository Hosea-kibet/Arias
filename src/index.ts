import { buildApp } from './app.js';
import { OpenAIService, createOpenAIClient } from './agent/openai.service.js';
import { loadConfig } from './config.js';
import { createDb } from './db.js';
import { AppError } from './errors.js';
import { EventRouter } from './events/event-router.js';
import { EventWorker } from './events/event.worker.js';
import { createSlackApp, slackMentionPayloadSchema } from './integrations/slack/slack.app.js';
import { EventRepository } from './repositories/event.repository.js';
import { ToolCallRepository } from './repositories/tool-call.repository.js';
import { EventService } from './services/event.service.js';
import { ToolExecutor } from './tools/tool.executor.js';
import { createToolRegistry } from './tools/tool.registry.js';

const config = loadConfig();
const db = createDb(config.DATABASE_URL);
const app = buildApp(config, db);
const events = new EventRepository(db);
const eventService = new EventService(events);
const router = new EventRouter();
const worker = new EventWorker(events, router);

const slackConfigured = Boolean(config.SLACK_BOT_TOKEN || config.SLACK_APP_TOKEN);
let slack: ReturnType<typeof createSlackApp> | undefined;
let slackStarted = false;

if (slackConfigured) {
  if (!config.OPENAI_MODEL) throw new AppError(503, 'OPENAI_MODEL is required when Slack is configured');

  slack = createSlackApp(config, async mention => {
    try {
      await eventService.create({
        type: 'slack.app_mention',
        source: 'slack',
        idempotencyKey: mention.idempotencyKey,
        payload: {
          text: mention.text,
          channel: mention.channel,
          threadTs: mention.threadTs,
          ...(mention.user ? { user: mention.user } : {}),
          ...(mention.team ? { team: mention.team } : {}),
        },
      });
      worker.trigger();
    } catch (error) {
      if (!(error instanceof AppError && error.statusCode === 409)) throw error;
    }
  });

  const tools = createToolRegistry(config, slack.client);
  const executor = new ToolExecutor(tools, new ToolCallRepository(db));
  const openAI = new OpenAIService(createOpenAIClient(config), config.OPENAI_MODEL, tools, executor);
  router.register('slack.app_mention', async event => {
    const payload = slackMentionPayloadSchema.parse(event.payload);
    const text = await openAI.run(event.id, payload.text);
    const reply = await slack!.client.chat.postMessage({
      channel: payload.channel,
      thread_ts: payload.threadTs,
      text: text.slice(0, 40_000),
    });
    return { text, channel: payload.channel, threadTs: payload.threadTs, messageTs: reply.ts };
  });
} else {
  app.log.warn('Slack is not configured; app_mention processing is disabled');
}

app.addHook('onClose', async () => {
  worker.stop();
  if (slackStarted) await slack?.stop();
  await db.$disconnect();
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void app.close().catch(() => { process.exitCode = 1; });
  });
}

try {
  await db.$connect();
  worker.start();
  await app.listen({ host: config.HOST, port: config.PORT });
  if (slack) {
    await slack.start();
    slackStarted = true;
    app.log.info('Slack Socket Mode connected');
  }
} catch {
  app.log.error('Startup failed; check configuration, database migrations, and port availability');
  await app.close();
  process.exitCode = 1;
}
