import { z } from 'zod';
import type { Config } from '../../config.js';
import { createGoogleClient } from '../google/google.client.js';

export const appendSheetRowsSchema = z.strictObject({
  spreadsheetId: z.string().min(1),
  range: z.string().min(1),
  values: z.array(z.array(z.union([z.string(), z.number(), z.boolean()])).min(1)).min(1),
});

export class SheetsService {
  constructor(private readonly config: Config) {}

  async appendRows(input: unknown): Promise<unknown> {
    const append = appendSheetRowsSchema.parse(input);
    const client = createGoogleClient(this.config);
    const response = await client.request<{
      spreadsheetId?: string;
      tableRange?: string;
      updates?: { updatedRange?: string; updatedRows?: number };
    }>({
      url: `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(append.spreadsheetId)}/values/${encodeURIComponent(append.range)}:append`,
      method: 'POST',
      params: { valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS' },
      data: { values: append.values },
    });
    return {
      spreadsheetId: response.data.spreadsheetId,
      tableRange: response.data.tableRange,
      updatedRange: response.data.updates?.updatedRange,
      updatedRows: response.data.updates?.updatedRows,
    };
  }
}
