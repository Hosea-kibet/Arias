import { CalendarService, createCalendarEventSchema } from '../integrations/calendar/calendar.service.js';
import { SheetsService, appendSheetRowsSchema } from '../integrations/sheets/sheets.service.js';
import { RemindersService, createReminderSchema } from '../integrations/reminders/reminders.service.js';
import type { AgentTool } from './tool.types.js';

// Add future integrations here. These services validate input, then explicitly
// report that execution is not implemented until we build their API adapters.
export function createToolRegistry(): AgentTool[] {
  const calendar = new CalendarService();
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
