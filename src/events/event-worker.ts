import { randomUUID } from 'node:crypto';
import { AppError } from '../errors.js';
import type { EventStatus } from '../generated/prisma/enums.js';
import type { EventExecutionStore } from './event-store.js';
import type { EventRouter } from './event-router.js';

export type EventProcessResult =
  | { outcome: 'completed'; eventId: string; executionId: string; result: unknown }
  | { outcome: 'failed'; eventId: string; executionId: string; error: string }
  | { outcome: 'duplicate' | 'busy' | 'not_pending'; eventId: string; status: EventStatus };

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export class EventWorker {
  constructor(
    private readonly store: EventExecutionStore,
    private readonly router: EventRouter,
  ) {}

  async enqueue(eventId: string) {
    return this.store.enqueue(eventId);
  }

  async process(eventId: string): Promise<EventProcessResult> {
    const executionId = randomUUID();
    const claim = await this.store.claimPending(eventId, executionId, new Date());

    if (!claim) {
      const event = await this.store.findById(eventId);
      if (!event) throw new AppError(404, 'Event not found');
      const outcome = event.status === 'COMPLETED' ? 'duplicate' : event.status === 'PROCESSING' ? 'busy' : 'not_pending';
      return { outcome, eventId, status: event.status };
    }

    try {
      const result = await this.router.dispatch(claim.event, { executionId });
      await this.store.completeEvent(eventId, executionId, result, new Date());
      return { outcome: 'completed', eventId, executionId, result };
    } catch (error) {
      const message = errorMessage(error);
      await this.store.failEvent(eventId, executionId, message, new Date());
      return { outcome: 'failed', eventId, executionId, error: message };
    }
  }

  async processPending(limit = 10) {
    const pending = await this.store.findPending(limit);
    const results: EventProcessResult[] = [];
    for (const event of pending) results.push(await this.process(event.id));
    return results;
  }

  async recoverInterrupted(eventId: string) {
    return this.store.recoverInterrupted(
      eventId,
      'Execution was interrupted and was not retried automatically; review provider side effects before retrying.',
      new Date(),
    );
  }
}
