import { OAuth2Client } from 'google-auth-library';
import type { Config } from '../../config.js';
import { AppError } from '../../errors.js';

export function createGoogleClient(config: Config) {
  if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET || !config.GOOGLE_REFRESH_TOKEN) {
    throw new AppError(503, 'Google APIs are not configured');
  }
  const client = new OAuth2Client(config.GOOGLE_CLIENT_ID, config.GOOGLE_CLIENT_SECRET);
  client.setCredentials({ refresh_token: config.GOOGLE_REFRESH_TOKEN });
  return client;
}
