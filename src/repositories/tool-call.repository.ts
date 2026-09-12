import type { Db } from '../db.js';
import { Prisma } from '../generated/prisma/client.js';

export class ToolCallRepository {
  constructor(private readonly db: Db) {}

  create(eventId: string, name: string, input: Prisma.InputJsonValue) {
    return this.db.toolCall.create({ data: { eventId, name, input } });
  }

  complete(id: string, output: Prisma.InputJsonValue) {
    return this.db.toolCall.update({
      where: { id },
      data: { output, error: null, completedAt: new Date() },
    });
  }

  fail(id: string, error: string) {
    return this.db.toolCall.update({
      where: { id },
      data: { error, completedAt: new Date() },
    });
  }
}