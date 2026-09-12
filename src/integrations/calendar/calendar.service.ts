import { z } from 'zod';
import { AppError } from '../../errors.js';

export interface GoogleRequestClient {
  request<T>(options: {
    url: string;
    method: 'POST';
    data: unknown;
  }): Promise<{ data: T }>;
}

export const createCalendarEventSchema = z.strictObject({
  calendarId: z.string().min(1).default('primary'),
  summary: z.string().min(1),
  start: z.iso.datetime({ offset: true }),
  end: z.iso.datetime({ offset: true }),
}).refine(input => Date.parse(input.end) > Date.parse(input.start), {
  message: 'End must be after start', path: ['end'],
});

export class CalendarService {
  constructor(private readonly googleClient: GoogleRequestClient) {}

  async createEvent(input: unknown): Promise<unknown> {
    const { calendarId, summary, start, end } = createCalendarEventSchema.parse(input);

    try {
      const response = await this.googleClient.request<{
        id?: string;
        htmlLink?: string;
        status?: string;
        summary?: string;
      }>({
        url: `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
        method: 'POST',
        data: {
          summary,
          start: { dateTime: start },
          end: { dateTime: end },
        },
      });

      return {
        eventId: response.data.id ?? null,
        htmlLink: response.data.htmlLink ?? null,
        status: response.data.status ?? null,
        summary: response.data.summary ?? summary,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(502, 'Google Calendar event creation failed');
    }
  }
}
