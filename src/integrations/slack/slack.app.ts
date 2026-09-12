import { App } from '@slack/bolt';
import type { Config } from '../../config.js';
import { AppError } from '../../errors.js';
import type { EventService } from '../../services/event.service.js';

type SlackMessage = {
  channel: string;
  ts: string;
  text?: string;
  user?: string;
  thread_ts?: string;
};

export function createSlackApp(config: Config, events: EventService) {
  if (!config.SLACK_BOT_TOKEN || !config.SLACK_APP_TOKEN) {
    throw new AppError(503, 'Slack is not configured');
  }
  const app = new App({
    token: config.SLACK_BOT_TOKEN,
    appToken: config.SLACK_APP_TOKEN,
    socketMode: true,
  });
  const persistMessage = async (message: SlackMessage, say: (message: { text: string; thread_ts?: string }) => Promise<unknown>) => {
    const event = await events.create({
      type: 'slack.message',
      source: 'slack',
      payload: {
        channel: message.channel,
        text: message.text ?? '',
        user: message.user ?? null,
        ts: message.ts,
        threadTs: message.thread_ts ?? null,
      },
      idempotencyKey: `slack:${message.channel}:${message.ts}`,
    });
    await say({
      text: `Received your request (${event.id}).`,
      ...(message.thread_ts ? { thread_ts: message.thread_ts } : { thread_ts: message.ts }),
    });
  };

  app.event('app_mention', async ({ event, say }) => {
    await persistMessage(event, say);
  });

  app.message(async ({ event, say }) => {
    if (event.channel_type !== 'im') return;
    await persistMessage(event, say);
  });

  return app;
}
