import { CalendarService, createCalendarEventSchema } from '../integrations/calendar/calendar.service.js';
import { SheetsService, appendSheetRowsSchema } from '../integrations/sheets/sheets.service.js';
import { RemindersService, createReminderSchema } from '../integrations/reminders/reminders.service.js';
import type { Config } from '../config.js';
import type { AgentTool } from './tool.types.js';

interface ReminderClient {
  reminders: {
    add(input: { token: string; text: string; time: string }): Promise<{
      reminder?: { id?: string; text?: string; time?: number; complete_ts?: number };
    }>;
  };
}

export function createToolRegistry(config: Config, slackClient: ReminderClient): AgentTool[] {
  const calendar = new CalendarService(config);
  const sheets = new SheetsService(config);
  const reminders = new RemindersService(config, slackClient);
  return [
    {
      name: 'calendar_create_event',
      description: 'Create a Google Calendar event',
      inputSchema: createCalendarEventSchema,
      execute: input => calendar.createEvent(input),
    },
    {
      name: 'sheets_append_rows',
      description: 'Append rows to a Google spreadsheet',
      inputSchema: appendSheetRowsSchema,
      execute: input => sheets.appendRows(input),
    },
    {
      name: 'reminders_create',
      description: 'Create a native Slack reminder',
      inputSchema: createReminderSchema,
      execute: input => reminders.createReminder(input),
    },
  ];
}
