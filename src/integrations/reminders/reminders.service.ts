import { z } from 'zod';
import { AppError } from '../../errors.js';

export const createReminderSchema = z.strictObject({
  text: z.string().min(1),
  time: z.string().min(1).describe('Slack reminder time, such as tomorrow at 09:00'),
});

export class RemindersService {
  async createReminder(input: unknown): Promise<unknown> {
    createReminderSchema.parse(input);
    // TODO: implement Slack-native reminders and validate the required token
    // type/scopes for the chosen Slack method before enabling this integration.
    throw new AppError(501, 'Slack reminders integration is not implemented yet');
  }
}
