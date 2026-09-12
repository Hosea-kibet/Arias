import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import type { Event } from '../src/generated/prisma/client.js';
import type { EventExecutionStore, EventClaim, ToolCallRecord } from '../src/events/event-store.js';
import { EventRouter } from '../src/events/event-router.js';
import { EventWorker } from '../src/events/event-worker.js';
import { ToolExecutor } from '../src/tools/tool.executor.js';
import { ToolRegistry } from '../src/tools/tool.registry.js';
import type { AgentTool } from '../src/tools/tool.types.js';

interface MemoryRun {
  executionId: string;
  eventId: string;
  status: string;
  result?: unknown;
  error?: string;
}

interface MemoryCall extends ToolCallRecord {
  eventId: string;
  executionId: string;
  name: string;
  input: unknown;
  status: string;
  output?: unknown;
  error?: string;
  durationMs?: number;
}

class MemoryStore implements EventExecutionStore {
  readonly events = new Map<string, Event>();
  readonly runs: MemoryRun[] = [];
  readonly calls: MemoryCall[] = [];
  readonly transitions = new Map<string, string[]>();
  private nextCallId = 1;

  addEvent(event: { id: string; status?: 'NEW' | 'PENDING'; payload: unknown; type?: string }) {
    const stored = {
      id: event.id,
      type: event.type ?? 'tool.invoke',
      source: 'test',
      payload: event.payload,
      idempotencyKey: null,
      status: event.status ?? 'PENDING',
      result: null,
      error: null,
      executionId: null,
      attemptCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      startedAt: null,
      completedAt: null,
    } as unknown as Event;
    this.events.set(stored.id, stored);
    this.transitions.set(stored.id, [stored.status]);
    return stored;
  }

  findById(id: string) {
    return Promise.resolve(this.events.get(id) ?? null);
  }

  findPending(limit: number) {
    return Promise.resolve([...this.events.values()].filter(event => event.status === 'PENDING').slice(0, limit));
  }

  enqueue(id: string) {
    const event = this.events.get(id);
    if (!event || event.status !== 'NEW') return Promise.resolve(false);
    event.status = 'PENDING';
    this.transitions.get(id)?.push('PENDING');
    return Promise.resolve(true);
  }

  claimPending(id: string, executionId: string, startedAt: Date): Promise<EventClaim | null> {
    const event = this.events.get(id);
    if (!event || event.status !== 'PENDING') return Promise.resolve(null);
    event.status = 'PROCESSING';
    event.executionId = executionId;
    event.attemptCount += 1;
    event.startedAt = startedAt;
    this.transitions.get(id)?.push('PROCESSING');
    this.runs.push({ executionId, eventId: id, status: 'PROCESSING' });
    return Promise.resolve({ event, executionId, attempt: event.attemptCount });
  }

  completeEvent(id: string, executionId: string, result: unknown) {
    const event = this.events.get(id);
    assert(event && event.executionId === executionId);
    event.status = 'COMPLETED';
    event.result = result as never;
    event.completedAt = new Date();
    this.transitions.get(id)?.push('COMPLETED');
    const run = this.runs.find(item => item.executionId === executionId);
    assert(run);
    run.status = 'COMPLETED';
    run.result = result;
    return Promise.resolve();
  }

  failEvent(id: string, executionId: string, error: string) {
    const event = this.events.get(id);
    assert(event && event.executionId === executionId);
    event.status = 'FAILED';
    event.error = error;
    event.completedAt = new Date();
    this.transitions.get(id)?.push('FAILED');
    const run = this.runs.find(item => item.executionId === executionId);
    assert(run);
    run.status = 'FAILED';
    run.error = error;
    return Promise.resolve();
  }

  createToolCall(input: { eventId: string; executionId: string; name: string; input: unknown }) {
    const call: MemoryCall = {
      id: `call-${this.nextCallId++}`,
      ...input,
      status: 'PROCESSING',
    };
    this.calls.push(call);
    return Promise.resolve(call);
  }

  completeToolCall(id: string, output: unknown, _completedAt: Date, durationMs: number) {
    const call = this.calls.find(item => item.id === id);
    assert(call);
    call.status = 'COMPLETED';
    call.output = output;
    call.durationMs = durationMs;
    return Promise.resolve();
  }

  failToolCall(id: string, error: string, _completedAt: Date, durationMs: number) {
    const call = this.calls.find(item => item.id === id);
    assert(call);
    call.status = 'FAILED';
    call.error = error;
    call.durationMs = durationMs;
    return Promise.resolve();
  }

  recoverInterrupted(id: string, error: string) {
    const event = this.events.get(id);
    if (!event || event.status !== 'PROCESSING' || !event.executionId) return Promise.resolve(false);
    return this.failEvent(id, event.executionId, error).then(() => true);
  }
}

function createRuntime(store: MemoryStore, tool: AgentTool) {
  const executor = new ToolExecutor(store, new ToolRegistry([tool]));
  const router = new EventRouter().registerToolEvent('tool.invoke', executor);
  return new EventWorker(store, router);
}

function eventPayload(input: unknown) {
  return { tool: 'fake_tool', arguments: input };
}

test('processes an enqueued event through the router and records a successful tool call', async () => {
  const store = new MemoryStore();
  let executions = 0;
  const worker = createRuntime(store, {
    name: 'fake_tool',
    description: 'Doubles a number',
    inputSchema: z.strictObject({ value: z.number() }),
    outputSchema: z.strictObject({ doubled: z.number() }),
    execute: async input => {
      executions += 1;
      return { doubled: input.value * 2 };
    },
  });
  store.addEvent({ id: 'event-1', status: 'NEW', payload: eventPayload({ value: 21 }) });

  assert.equal(await worker.enqueue('event-1'), true);
  const result = await worker.process('event-1');

  assert.equal(result.outcome, 'completed');
  assert.equal(executions, 1);
  assert.deepEqual(store.transitions.get('event-1'), ['NEW', 'PENDING', 'PROCESSING', 'COMPLETED']);
  assert.equal(store.calls[0]?.status, 'COMPLETED');
  assert.deepEqual(store.calls[0]?.output, { doubled: 42 });
  assert.equal(typeof store.calls[0]?.durationMs, 'number');
  assert.equal(store.runs[0]?.status, 'COMPLETED');
});

test('rejects invalid arguments before the tool executes', async () => {
  const store = new MemoryStore();
  let executions = 0;
  const worker = createRuntime(store, {
    name: 'fake_tool',
    description: 'Requires a number',
    inputSchema: z.strictObject({ value: z.number() }),
    execute: async input => {
      executions += 1;
      return input;
    },
  });
  store.addEvent({ id: 'event-2', payload: eventPayload({ value: 'not-a-number' }) });

  const result = await worker.process('event-2');

  assert.equal(result.outcome, 'failed');
  assert.equal(executions, 0);
  assert.equal(store.events.get('event-2')?.status, 'FAILED');
  assert.equal(store.calls[0]?.status, 'FAILED');
  assert.match(store.calls[0]?.error ?? '', /Invalid arguments/);
});

test('validates tool output and records the failure', async () => {
  const store = new MemoryStore();
  const worker = createRuntime(store, {
    name: 'fake_tool',
    description: 'Returns an invalid shape',
    inputSchema: z.strictObject({ value: z.number() }),
    outputSchema: z.strictObject({ doubled: z.number() }),
    execute: async input => ({ wrong: input.value }),
  });
  store.addEvent({ id: 'event-3', payload: eventPayload({ value: 2 }) });

  const result = await worker.process('event-3');

  assert.equal(result.outcome, 'failed');
  assert.equal(store.calls[0]?.status, 'FAILED');
  assert.match(store.calls[0]?.error ?? '', /Invalid output/);
});

test('suppresses duplicate deliveries after completion', async () => {
  const store = new MemoryStore();
  let executions = 0;
  const worker = createRuntime(store, {
    name: 'fake_tool',
    description: 'Counts executions',
    inputSchema: z.strictObject({ value: z.number() }),
    execute: async input => {
      executions += 1;
      return input;
    },
  });
  store.addEvent({ id: 'event-4', payload: eventPayload({ value: 7 }) });

  const first = await worker.process('event-4');
  const second = await worker.process('event-4');

  assert.equal(first.outcome, 'completed');
  assert.equal(second.outcome, 'duplicate');
  assert.equal(executions, 1);
  assert.equal(store.runs.length, 1);
  assert.equal(store.calls.length, 1);
});

test('allows only one concurrent claim for an event', async () => {
  const store = new MemoryStore();
  let executions = 0;
  let release!: () => void;
  let started!: () => void;
  const toolStarted = new Promise<void>(resolve => { started = resolve; });
  const toolRelease = new Promise<void>(resolve => { release = resolve; });
  const worker = createRuntime(store, {
    name: 'fake_tool',
    description: 'Blocks until released',
    inputSchema: z.strictObject({ value: z.number() }),
    execute: async input => {
      executions += 1;
      started();
      await toolRelease;
      return input;
    },
  });
  store.addEvent({ id: 'event-5', payload: eventPayload({ value: 9 }) });

  const first = worker.process('event-5');
  await toolStarted;
  const second = await worker.process('event-5');
  release();
  const firstResult = await first;

  assert.equal(second.outcome, 'busy');
  assert.equal(firstResult.outcome, 'completed');
  assert.equal(executions, 1);
  assert.equal(store.runs.length, 1);
});
