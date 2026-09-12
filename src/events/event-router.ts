import { AppError } from '../errors.js';
import type { Event } from '../generated/prisma/client.js';
import { z } from 'zod';
import type { ToolExecutor } from '../tools/tool.executor.js';

export interface EventHandlerContext {
  executionId: string;
}

export type EventHandler = (event: Event, context: EventHandlerContext) => Promise<unknown>;

const toolEventPayloadSchema = z.strictObject({
  tool: z.string().trim().min(1),
  arguments: z.unknown(),
});

export class EventRouter {
  private readonly handlers = new Map<string, EventHandler>();

  register(type: string, handler: EventHandler) {
    if (this.handlers.has(type)) throw new Error(`Handler already registered: ${type}`);
    this.handlers.set(type, handler);
    return this;
  }

  registerToolEvent(type: string, executor: ToolExecutor) {
    return this.register(type, async (event, context) => {
      const payload = toolEventPayloadSchema.parse(event.payload);
      return executor.execute({
        eventId: event.id,
        executionId: context.executionId,
        name: payload.tool,
        input: payload.arguments,
      });
    });
  }

  async dispatch(event: Event, context: EventHandlerContext) {
    const handler = this.handlers.get(event.type);
    if (!handler) throw new AppError(501, `No handler implemented for event type: ${event.type}`);
    return handler(event, context);
  }
}
