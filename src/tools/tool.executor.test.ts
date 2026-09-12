import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import type { ToolCallRepository } from '../repositories/tool-call.repository.js';
import { ToolExecutor } from './tool.executor.js';

test('ToolExecutor records successful execution', async () => {
  const calls: string[] = [];
  const repository = {
    async create() { calls.push('create'); return { id: 'call-1' }; },
    async complete() { calls.push('complete'); },
    async fail() { calls.push('fail'); },
  } as unknown as ToolCallRepository;
  const executor = new ToolExecutor([{
    name: 'echo',
    description: 'Echo input',
    inputSchema: z.object({ text: z.string() }),
    async execute(input) { calls.push('execute'); return input; },
  }], repository);

  const result = await executor.execute('event-1', 'echo', { text: 'hello' });

  assert.deepEqual(result, { text: 'hello' });
  assert.deepEqual(calls, ['create', 'execute', 'complete']);
});

test('ToolExecutor records provider failures', async () => {
  const calls: string[] = [];
  const repository = {
    async create() { calls.push('create'); return { id: 'call-1' }; },
    async complete() { calls.push('complete'); },
    async fail() { calls.push('fail'); },
  } as unknown as ToolCallRepository;
  const executor = new ToolExecutor([{
    name: 'fail',
    description: 'Fail',
    inputSchema: z.object({ value: z.number() }),
    async execute() { calls.push('execute'); throw new Error('provider failed'); },
  }], repository);

  await assert.rejects(executor.execute('event-1', 'fail', { value: 1 }), /provider failed/);
  assert.deepEqual(calls, ['create', 'execute', 'fail']);
});

test('ToolExecutor rejects invalid input before persistence or execution', async () => {
  let called = false;
  const repository = {
    async create() { called = true; return { id: 'call-1' }; },
  } as unknown as ToolCallRepository;
  const executor = new ToolExecutor([{
    name: 'number',
    description: 'Accept a number',
    inputSchema: z.object({ value: z.number() }),
    async execute() { called = true; },
  }], repository);

  await assert.rejects(executor.execute('event-1', 'number', { value: 'invalid' }));
  assert.equal(called, false);
});