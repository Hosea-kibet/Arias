import { z } from 'zod';
import type { Config } from '../../config.js';
import { createGoogleClient } from '../google/google.client.js';

export const createCalendarEventSchema = z.strictObject({
  calendarId: z.string().min(1).default('primary'),
  summary: z.string().min(1),
  start: z.iso.datetime({ offset: true }),
  end: z.iso.datetime({ offset: true }),
}).refine(input => Date.parse(input.end) > Date.parse(input.start), {
  message: 'End must be after start', path: ['end'],
});

export class CalendarService {
  constructor(private readonly config: Config) {}

  async createEvent(input: unknown): Promise<unknown> {
    const event = createCalendarEventSchema.parse(input);
    const client = createGoogleClient(this.config);
    const response = await client.request<{ id?: string; htmlLink?: string; status?: string }>({
      url: `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(event.calendarId)}/events`,
      method: 'POST',
      data: {
        summary: event.summary,
        start: { dateTime: event.start },
        end: { dateTime: event.end },
      },
    });
    return {
      id: response.data.id,
      link: response.data.htmlLink,
      status: response.data.status,
      start: event.start,
      end: event.end,
    };
  }
}
