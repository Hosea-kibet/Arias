import { App } from '@slack/bolt';
import { z } from 'zod';
import type { Config } from '../../config.js';
import { AppError } from '../../errors.js';

export const slackMentionPayloadSchema = z.strictObject({
  text: z.string().min(1),
  channel: z.string().min(1),
  threadTs: z.string().min(1),
  user: z.string().optional(),
  team: z.string().optional(),
});

export interface SlackMention {
  idempotencyKey: string;
  text: string;
  channel: string;
  threadTs: string;
  user?: string;
  team?: string;
}

export function createSlackApp(config: Config, onMention: (mention: SlackMention) => Promise<void>) {
  if (!config.SLACK_BOT_TOKEN || !config.SLACK_APP_TOKEN) {
    throw new AppError(503, 'Slack is not configured');
  }
  const app = new App({
    token: config.SLACK_BOT_TOKEN,
    appToken: config.SLACK_APP_TOKEN,
    socketMode: true,
  });
  app.event('app_mention', async ({ event }) => {
    if (event.bot_id || !event.text.trim()) return;
    await onMention({
      idempotencyKey: `slack:${event.team ?? event.user_team ?? 'unknown'}:${event.event_ts}`,
      text: event.text.replace(/<@[^>]+>/g, '').trim(),
      channel: event.channel,
      threadTs: event.thread_ts ?? event.ts,
      user: event.user,
      team: event.team ?? event.user_team,
    });
  });
  return app;
}
