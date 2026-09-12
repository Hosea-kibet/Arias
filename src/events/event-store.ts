import type { Event } from '../generated/prisma/client.js';

export interface EventClaim {
  event: Event;
  executionId: string;
  attempt: number;
}

export interface ToolCallRecord {
  id: string;
}

export interface EventExecutionStore {
  findById(id: string): Promise<Event | null>;
  findPending(limit: number): Promise<Event[]>;
  enqueue(id: string): Promise<boolean>;
  claimPending(id: string, executionId: string, startedAt: Date): Promise<EventClaim | null>;
  completeEvent(id: string, executionId: string, result: unknown, completedAt: Date): Promise<void>;
  failEvent(id: string, executionId: string, error: string, completedAt: Date): Promise<void>;
  createToolCall(input: {
    eventId: string;
    executionId: string;
    name: string;
    input: unknown;
    startedAt: Date;
  }): Promise<ToolCallRecord>;
  completeToolCall(id: string, output: unknown, completedAt: Date, durationMs: number): Promise<void>;
  failToolCall(id: string, error: string, completedAt: Date, durationMs: number): Promise<void>;
  recoverInterrupted(id: string, error: string, completedAt: Date): Promise<boolean>;
}
