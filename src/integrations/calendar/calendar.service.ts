import { z } from 'zod';
import { AppError } from '../../errors.js';

export const createCalendarEventSchema = z.strictObject({
  calendarId: z.string().min(1).default('primary'),
  summary: z.string().min(1),
  start: z.iso.datetime({ offset: true }),
  end: z.iso.datetime({ offset: true }),
}).refine(input => Date.parse(input.end) > Date.parse(input.start), {
  message: 'End must be after start', path: ['end'],
});

export class CalendarService {
  async createEvent(input: unknown): Promise<unknown> {
    createCalendarEventSchema.parse(input);
    // TODO: call Google Calendar events.insert using the Google OAuth client.
    throw new AppError(501, 'Google Calendar integration is not implemented yet');
  }
}
