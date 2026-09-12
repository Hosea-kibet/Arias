import { AppError } from '../errors.js';
import { Prisma } from '../generated/prisma/client.js';
import type { EventRepository } from '../repositories/event.repository.js';
import type { CreateEventInput } from '../validators/event.validator.js';
import type { EventWorker } from '../events/event-worker.js';

export class EventService {
  constructor(
    private readonly events: EventRepository,
    private readonly worker: EventWorker,
  ) {}

  async create(input: CreateEventInput) {
    try {
      // Persist only. Background processing and routing will be added next.
      return await this.events.create(input);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(409, 'An event with this idempotency key already exists');
      }
      throw error;
    }
  }

  async getById(id: string) {
    const event = await this.events.findById(id);
    if (!event) throw new AppError(404, 'Event not found');
    return event;
  }

  process(id: string) {
    return this.worker.process(id);
  }
}
