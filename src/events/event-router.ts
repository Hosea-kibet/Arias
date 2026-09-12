import { AppError } from '../errors.js';
import type { Event } from '../generated/prisma/client.js';

export type EventHandler = (event: Event) => Promise<unknown>;

// Routing extension point. A future worker will load PENDING events and dispatch
// them here, then save the outcome. No worker or handlers are wired up yet.
export class EventRouter {
  private readonly handlers = new Map<string, EventHandler>();

  register(type: string, handler: EventHandler) {
    if (this.handlers.has(type)) throw new Error(`Handler already registered: ${type}`);
    this.handlers.set(type, handler);
    return this;
  }

  async dispatch(event: Event) {
    const handler = this.handlers.get(event.type);
    if (!handler) throw new AppError(501, `No handler implemented for event type: ${event.type}`);
    return handler(event);
  }
}
