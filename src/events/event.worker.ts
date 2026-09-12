import type { EventRepository } from '../repositories/event.repository.js';
import type { EventRouter } from './event-router.js';

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Event processing failed';
}

export class EventWorker {
  private timer?: NodeJS.Timeout;
  private polling = false;

  constructor(
    private readonly events: EventRepository,
    private readonly router: EventRouter,
    private readonly intervalMs = 1_000,
  ) {}

  start() {
    if (this.timer) return;
    void this.runOnce();
    this.timer = setInterval(() => { void this.runOnce(); }, this.intervalMs);
    this.timer.unref();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  trigger() {
    void this.runOnce();
  }

  async runOnce() {
    if (this.polling) return;
    this.polling = true;
    try {
      const pending = await this.events.findPending();
      for (const event of pending) await this.process(event.id);
    } finally {
      this.polling = false;
    }
  }

  private async process(id: string) {
    const event = await this.events.claim(id);
    if (!event) return;
    try {
      const result = await this.router.dispatch(event);
      const jsonResult = JSON.parse(JSON.stringify(result ?? null));
      await this.events.complete(event.id, jsonResult);
    } catch (error) {
      await this.events.fail(event.id, errorMessage(error));
    }
  }
}