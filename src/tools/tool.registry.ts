import { CalendarService, createCalendarEventSchema } from '../integrations/calendar/calendar.service.js';
import { createGoogleClient } from '../integrations/google/google.client.js';
import { SheetsService, appendSheetRowsSchema } from '../integrations/sheets/sheets.service.js';
import { RemindersService, createReminderSchema } from '../integrations/reminders/reminders.service.js';
import type { Config } from '../config.js';
import type { AgentTool } from './tool.types.js';

// Add future integrations here. Services validate their own inputs before execution.
export function createToolRegistry(config: Config): AgentTool[] {
  const calendar = new CalendarService(createGoogleClient(config));
  const sheets = new SheetsService();
  const reminders = new RemindersService();
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
