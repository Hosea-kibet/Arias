import { AppError } from '../errors.js';
import type { EventExecutionStore } from '../events/event-store.js';
import { ToolRegistry } from './tool.registry.js';

export interface ToolExecutionRequest {
  eventId: string;
  executionId: string;
  name: string;
  input: unknown;
}

export class ToolInputValidationError extends Error {
  constructor(public readonly toolName: string, public readonly issues: unknown) {
    super(`Invalid arguments for tool: ${toolName}`);
    this.name = 'ToolInputValidationError';
  }
}

export class ToolOutputValidationError extends Error {
  constructor(public readonly toolName: string, public readonly issues: unknown) {
    super(`Invalid output from tool: ${toolName}`);
    this.name = 'ToolOutputValidationError';
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function durationSince(startedAt: number) {
  return Math.max(0, Date.now() - startedAt);
}

export class ToolExecutor {
  constructor(
    private readonly store: EventExecutionStore,
    private readonly registry: ToolRegistry,
  ) {}

  async execute(request: ToolExecutionRequest): Promise<unknown> {
    const startedAt = new Date();
    const startedAtMs = startedAt.getTime();
    const call = await this.store.createToolCall({ ...request, startedAt });
    const tool = this.registry.get(request.name);

    if (!tool) {
      const error = new AppError(404, `Unknown tool: ${request.name}`);
      await this.store.failToolCall(call.id, error.message, new Date(), durationSince(startedAtMs));
      throw error;
    }

    const parsedInput = tool.inputSchema.safeParse(request.input);
    if (!parsedInput.success) {
      const error = new ToolInputValidationError(request.name, parsedInput.error.issues);
      await this.store.failToolCall(call.id, error.message, new Date(), durationSince(startedAtMs));
      throw error;
    }

    try {
      const rawOutput = await tool.execute(parsedInput.data);
      const parsedOutput = tool.outputSchema?.safeParse(rawOutput);
      if (parsedOutput && !parsedOutput.success) {
        throw new ToolOutputValidationError(request.name, parsedOutput.error.issues);
      }
      const output = parsedOutput?.data ?? rawOutput;
      await this.store.completeToolCall(call.id, output, new Date(), durationSince(startedAtMs));
      return output;
    } catch (error) {
      await this.store.failToolCall(call.id, errorMessage(error), new Date(), durationSince(startedAtMs));
      throw error;
    }
  }
}
