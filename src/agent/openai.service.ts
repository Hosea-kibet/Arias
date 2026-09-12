import OpenAI from 'openai';
import { z } from 'zod';
import type { Config } from '../config.js';
import { AppError } from '../errors.js';
import type { AgentTool } from '../tools/tool.types.js';
import type { ToolExecutor } from '../tools/tool.executor.js';

export function createOpenAIClient(config: Config) {
  if (!config.OPENAI_API_KEY) throw new AppError(503, 'OpenAI is not configured');
  return new OpenAI({ apiKey: config.OPENAI_API_KEY });
}

export class OpenAIService {
  private readonly definitions;

  constructor(
    private readonly client: OpenAI,
    private readonly model: string,
    tools: AgentTool[],
    private readonly executor: ToolExecutor,
  ) {
    this.definitions = tools.map(tool => ({
      type: 'function' as const,
      name: tool.name,
      description: tool.description,
      parameters: z.toJSONSchema(tool.inputSchema, { io: 'input' }),
      strict: false,
    }));
  }

  async run(eventId: string, prompt: string): Promise<string> {
    let response = await this.client.responses.create({
      model: this.model,
      instructions: 'Help the user complete the request. Use tools only when needed. Never invent missing identifiers or times; ask a concise follow-up question instead.',
      input: prompt,
      tools: this.definitions,
    }, { timeout: 30_000 });

    for (let round = 0; round < 8; round += 1) {
      const functionCalls = response.output.filter(item => item.type === 'function_call');
      if (functionCalls.length === 0) {
        if (!response.output_text) throw new AppError(502, 'OpenAI returned no response text');
        return response.output_text;
      }

      const outputs = [];
      for (const call of functionCalls) {
        const input = JSON.parse(call.arguments) as unknown;
        try {
          const output = await this.executor.execute(eventId, call.name, input);
          outputs.push({ type: 'function_call_output' as const, call_id: call.call_id, output: JSON.stringify(output ?? null) });
        } catch (error) {
          outputs.push({ type: 'function_call_output' as const, call_id: call.call_id, output: JSON.stringify({ error: error instanceof Error ? error.message : 'Tool execution failed' }) });
        }
      }

      response = await this.client.responses.create({
        model: this.model,
        previous_response_id: response.id,
        input: outputs,
        tools: this.definitions,
      }, { timeout: 30_000 });
    }

    throw new AppError(502, 'OpenAI exceeded the tool-call limit');
  }
}
