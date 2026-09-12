import OpenAI from 'openai';
import type { Config } from '../config.js';
import { AppError } from '../errors.js';

export function createOpenAIClient(config: Config) {
  if (!config.OPENAI_API_KEY) throw new AppError(503, 'OpenAI is not configured');
  return new OpenAI({ apiKey: config.OPENAI_API_KEY });
}

export class OpenAIService {
  async run(_prompt: string): Promise<unknown> {
    // TODO: call client.responses.create with OPENAI_MODEL and tool schemas,
    // execute function_call items, send function_call_output items, persist
    // ToolCall records, and return the final response text.
    throw new AppError(501, 'OpenAI orchestration is not implemented yet');
  }
}
