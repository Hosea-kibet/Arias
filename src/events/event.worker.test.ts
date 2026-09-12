import assert from 'node:assert/strict';
import test from 'node:test';
import type { Event } from '../generated/prisma/client.js';
import type { EventRepository } from '../repositories/event.repository.js';
import type { EventRouter } from './event-router.js';
import { EventWorker } from './event.worker.js';

const event = {
  id: 'event-1',
  type: 'test',
  source: 'api',
  payload: {},
  idempotencyKey: null,
  status: 'PENDING',
  result: null,
  error: null,
  createdAt: new Date(),
  startedAt: null,
  completedAt: null,
} as Event;

test('EventWorker claims and completes an event once', async () => {
  const calls: string[] = [];
  let available = true;
  const repository = {
    async findPending() { return available ? [event] : []; },
    async claim() {
      if (!available) return null;
      available = false;
      calls.push('claim');
      return { ...event, status: 'PROCESSING' };
    },
    async complete() { calls.push('complete'); },
    async fail() { calls.push('fail'); },
  } as unknown as EventRepository;
  const router = {
    async dispatch() { calls.push('dispatch'); return { ok: true }; },
  } as unknown as EventRouter;
  const worker = new EventWorker(repository, router);

  await Promise.all([worker.runOnce(), worker.runOnce()]);

  assert.deepEqual(calls, ['claim', 'dispatch', 'complete']);
});

test('EventWorker records handler failures', async () => {
  const calls: string[] = [];
  const repository = {
    async findPending() { return [event]; },
    async claim() { return { ...event, status: 'PROCESSING' }; },
    async complete() { calls.push('complete'); },
    async fail(_id: string, message: string) { calls.push(`fail:${message}`); },
  } as unknown as EventRepository;
  const router = {
    async dispatch() { throw new Error('handler failed'); },
  } as unknown as EventRouter;
  const worker = new EventWorker(repository, router);

  await worker.runOnce();

  assert.deepEqual(calls, ['fail:handler failed']);
});