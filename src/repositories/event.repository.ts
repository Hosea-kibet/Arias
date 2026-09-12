import type { Db } from '../db.js';
import { Prisma } from '../generated/prisma/client.js';
import type { CreateEventInput } from '../validators/event.validator.js';

export class EventRepository {
  constructor(private readonly db: Db) {}

  create(input: CreateEventInput) {
    return this.db.event.create({ data: input });
  }

  findById(id: string) {
    return this.db.event.findUnique({ where: { id } });
  }

  findPending(limit = 10) {
    return this.db.event.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async claim(id: string) {
    const claimed = await this.db.event.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'PROCESSING', startedAt: new Date(), error: null },
    });
    return claimed.count === 1 ? this.findById(id) : null;
  }

  complete(id: string, result: Prisma.InputJsonValue) {
    return this.db.event.update({
      where: { id },
      data: { status: 'COMPLETED', result, error: null, completedAt: new Date() },
    });
  }

  fail(id: string, error: string) {
    return this.db.event.update({
      where: { id },
      data: { status: 'FAILED', error, completedAt: new Date() },
    });
  }
}
