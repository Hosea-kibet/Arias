import { z } from 'zod';
import { AppError } from '../../errors.js';

export const appendSheetRowsSchema = z.strictObject({
  spreadsheetId: z.string().min(1),
  range: z.string().min(1),
  values: z.array(z.array(z.union([z.string(), z.number(), z.boolean()])).min(1)).min(1),
});

export class SheetsService {
  async appendRows(input: unknown): Promise<unknown> {
    appendSheetRowsSchema.parse(input);
    // TODO: call Google Sheets spreadsheets.values.append.
    throw new AppError(501, 'Google Sheets integration is not implemented yet');
  }
}
