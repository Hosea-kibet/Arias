import { z } from 'zod';
import type { Config } from '../../config.js';
import { AppError } from '../../errors.js';

interface ReminderClient {
  reminders: {
    add(input: { token: string; text: string; time: string }): Promise<{
      reminder?: { id?: string; text?: string; time?: number; complete_ts?: number };
    }>;
  };
}

export const createReminderSchema = z.strictObject({
  text: z.string().min(1),
  time: z.string().min(1).describe('Slack reminder time, such as tomorrow at 09:00'),
});

export class RemindersService {
  constructor(
    private readonly config: Config,
    private readonly client: ReminderClient,
  ) {}

  async createReminder(input: unknown): Promise<unknown> {
    const reminder = createReminderSchema.parse(input);
    if (!this.config.SLACK_USER_TOKEN) {
      throw new AppError(503, 'SLACK_USER_TOKEN is required to create reminders');
    }
    const response = await this.client.reminders.add({
      token: this.config.SLACK_USER_TOKEN,
      text: reminder.text,
      time: reminder.time,
    });
    return {
      id: response.reminder?.id,
      text: response.reminder?.text,
      time: response.reminder?.time,
      completeTs: response.reminder?.complete_ts,
    };
  }
}
