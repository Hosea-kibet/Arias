import type { Db } from '../db.js';
import type { EventExecutionStore, EventClaim, ToolCallRecord } from '../events/event-store.js';
import type { CreateEventInput } from '../validators/event.validator.js';
import { Prisma } from '../generated/prisma/client.js';

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error('Value cannot be persisted as JSON');
  return JSON.parse(serialized) as Prisma.InputJsonValue;
}

export class EventRepository implements EventExecutionStore {
  constructor(private readonly db: Db) {}

  create(input: CreateEventInput) {
    return this.db.event.create({ data: input });
  }

  findById(id: string) {
    return this.db.event.findUnique({ where: { id } });
  }

  findPending(limit: number) {
    return this.db.event.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async enqueue(id: string) {
    const updated = await this.db.event.updateMany({
      where: { id, status: 'NEW' },
      data: { status: 'PENDING', error: null },
    });
    return updated.count === 1;
  }

  async claimPending(id: string, executionId: string, startedAt: Date): Promise<EventClaim | null> {
    return this.db.$transaction(async tx => {
      const updated = await tx.event.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          status: 'PROCESSING',
          executionId,
          attemptCount: { increment: 1 },
          startedAt,
          completedAt: null,
          error: null,
          result: Prisma.JsonNull,
        },
      });
      if (updated.count !== 1) return null;

      const event = await tx.event.findUnique({ where: { id } });
      if (!event) return null;

      const run = await tx.eventRun.create({
        data: {
          eventId: id,
          executionId,
          attempt: event.attemptCount,
          status: 'PROCESSING',
          startedAt,
        },
      });
      return { event, executionId, attempt: run.attempt };
    });
  }

  async completeEvent(id: string, executionId: string, result: unknown, completedAt: Date) {
    await this.db.$transaction(async tx => {
      const updated = await tx.event.updateMany({
        where: { id, executionId, status: 'PROCESSING' },
        data: {
          status: 'COMPLETED',
          result: toJsonValue(result),
          error: null,
          completedAt,
        },
      });
      if (updated.count !== 1) return;
      await tx.eventRun.update({
        where: { executionId },
        data: {
          status: 'COMPLETED',
          result: toJsonValue(result),
          error: null,
          completedAt,
        },
      });
    });
  }

  async failEvent(id: string, executionId: string, error: string, completedAt: Date) {
    await this.db.$transaction(async tx => {
      const updated = await tx.event.updateMany({
        where: { id, executionId, status: 'PROCESSING' },
        data: {
          status: 'FAILED',
          error,
          completedAt,
        },
      });
      if (updated.count !== 1) return;
      await tx.eventRun.update({
        where: { executionId },
        data: {
          status: 'FAILED',
          error,
          completedAt,
        },
      });
    });
  }

  async createToolCall(input: {
    eventId: string;
    executionId: string;
    name: string;
    input: unknown;
    startedAt: Date;
  }): Promise<ToolCallRecord> {
    const run = await this.db.eventRun.findUnique({
      where: { executionId: input.executionId },
      select: { id: true },
    });
    if (!run) throw new Error(`Execution run not found: ${input.executionId}`);

    return this.db.toolCall.create({
      data: {
        eventId: input.eventId,
        runId: run.id,
        executionId: input.executionId,
        name: input.name,
        status: 'PROCESSING',
        input: toJsonValue(input.input),
        startedAt: input.startedAt,
      },
      select: { id: true },
    });
  }

  async completeToolCall(id: string, output: unknown, completedAt: Date, durationMs: number) {
    await this.db.toolCall.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        output: toJsonValue(output),
        error: null,
        completedAt,
        durationMs,
      },
    });
  }

  async failToolCall(id: string, error: string, completedAt: Date, durationMs: number) {
    await this.db.toolCall.update({
      where: { id },
      data: {
        status: 'FAILED',
        error,
        completedAt,
        durationMs,
      },
    });
  }

  async recoverInterrupted(id: string, error: string, completedAt: Date) {
    return this.db.$transaction(async tx => {
      const event = await tx.event.findUnique({ where: { id } });
      if (!event || event.status !== 'PROCESSING' || !event.executionId) return false;
      const updated = await tx.event.updateMany({
        where: { id, executionId: event.executionId, status: 'PROCESSING' },
        data: { status: 'FAILED', error, completedAt },
      });
      if (updated.count !== 1) return false;
      await tx.eventRun.update({
        where: { executionId: event.executionId },
        data: { status: 'FAILED', error, completedAt },
      });
      return true;
    });
  }
}
