import { CalendarService, createCalendarEventSchema } from '../integrations/calendar/calendar.service.js';
import { createGoogleClient } from '../integrations/google/google.client.js';
import { SheetsService, appendSheetRowsSchema } from '../integrations/sheets/sheets.service.js';
import { RemindersService, createReminderSchema } from '../integrations/reminders/reminders.service.js';
import { z } from 'zod';
import type { AgentTool } from './tool.types.js';

export class ToolRegistry {
  private readonly tools = new Map<string, AgentTool>();

  constructor(tools: AgentTool[] = []) {
    for (const tool of tools) this.register(tool);
  }

  register(tool: AgentTool) {
    if (this.tools.has(tool.name)) throw new Error(`Tool already registered: ${tool.name}`);
    this.tools.set(tool.name, tool);
    return this;
  }

  get(name: string) {
    return this.tools.get(name);
  }

  list() {
    return [...this.tools.values()];
  }
}

export function createToolRegistry(): ToolRegistry {
  const calendar = new CalendarService();
  const sheets = new SheetsService();
  const reminders = new RemindersService();
  return new ToolRegistry([
    {
      name: 'calendar_create_event',
      description: 'Create a Google Calendar event',
      inputSchema: createCalendarEventSchema,
      outputSchema: z.unknown(),
      execute: input => calendar.createEvent(input),
    },
    {
      name: 'sheets_append_rows',
      description: 'Append rows to a Google spreadsheet',
      inputSchema: appendSheetRowsSchema,
      outputSchema: z.unknown(),
      execute: input => sheets.appendRows(input),
    },
    {
      name: 'reminders_create',
      description: 'Create a native Slack reminder',
      inputSchema: createReminderSchema,
      outputSchema: z.unknown(),
      execute: input => reminders.createReminder(input),
    },
  ]);
}
