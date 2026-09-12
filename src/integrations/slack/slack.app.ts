import { App } from '@slack/bolt';
import type { Config } from '../../config.js';
import { AppError } from '../../errors.js';

export function createSlackApp(config: Config) {
  if (!config.SLACK_BOT_TOKEN || !config.SLACK_APP_TOKEN) {
    throw new AppError(503, 'Slack is not configured');
  }
  const app = new App({
    token: config.SLACK_BOT_TOKEN,
    appToken: config.SLACK_APP_TOKEN,
    socketMode: true,
  });
  // TODO: register app_mention and direct-message listeners, persist events
  // through EventService, then post the agent's final response in the same thread.
  // Start/stop this app from index.ts when those handlers are implemented.
  return app;
}
