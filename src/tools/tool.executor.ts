import { AppError } from '../errors.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { ToolCallRepository } from '../repositories/tool-call.repository.js';
import type { AgentTool } from './tool.types.js';

function asJson(value: unknown): Prisma.InputJsonValue {
  if (value === undefined) return {};
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Tool execution failed';
}

export class ToolExecutor {
  private readonly toolsByName: Map<string, AgentTool>;

  constructor(
    tools: AgentTool[],
    private readonly toolCalls: ToolCallRepository,
  ) {
    this.toolsByName = new Map(tools.map(tool => [tool.name, tool]));
  }

  async execute(eventId: string, name: string, input: unknown) {
    const tool = this.toolsByName.get(name);
    if (!tool) throw new AppError(400, `Unknown tool: ${name}`);

    const parsedInput = tool.inputSchema.parse(input);
    const toolCall = await this.toolCalls.create(eventId, name, asJson(parsedInput));
    try {
      const output = await tool.execute(parsedInput);
      await this.toolCalls.complete(toolCall.id, asJson(output));
      return output;
    } catch (error) {
      await this.toolCalls.fail(toolCall.id, errorMessage(error));
      throw error;
    }
  }
}