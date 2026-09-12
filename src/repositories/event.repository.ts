import type { Db } from '../db.js';
import type { CreateEventInput } from '../validators/event.validator.js';

export class EventRepository {
  constructor(private readonly db: Db) {}

  create(input: CreateEventInput) {
    return this.db.event.create({ data: input });
  }

  findById(id: string) {
    return this.db.event.findUnique({ where: { id } });
  }
}
