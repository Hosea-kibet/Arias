import assert from 'node:assert/strict';
import test from 'node:test';
import type OpenAI from 'openai';
import { z } from 'zod';
import type { ToolExecutor } from '../tools/tool.executor.js';
import { OpenAIService } from './openai.service.js';

test('OpenAIService executes function calls and returns final text', async () => {
  const requests: unknown[] = [];
  const responses = [
    {
      id: 'response-1',
      output_text: '',
      output: [{ type: 'function_call', call_id: 'call-1', name: 'echo', arguments: '{"text":"hello"}' }],
    },
    { id: 'response-2', output_text: 'Done', output: [] },
  ];
  const client = {
    responses: {
      async create(request: unknown) {
        requests.push(request);
        return responses.shift();
      },
    },
  } as unknown as OpenAI;
  const executor = {
    async execute(eventId: string, name: string, input: unknown) {
      assert.equal(eventId, 'event-1');
      assert.equal(name, 'echo');
      assert.deepEqual(input, { text: 'hello' });
      return { echoed: true };
    },
  } as ToolExecutor;
  const service = new OpenAIService(client, 'test-model', [{
    name: 'echo',
    description: 'Echo input',
    inputSchema: z.object({ text: z.string() }),
    async execute() { return {}; },
  }], executor);

  assert.equal(await service.run('event-1', 'hello'), 'Done');
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[1], {
    model: 'test-model',
    previous_response_id: 'response-1',
    input: [{ type: 'function_call_output', call_id: 'call-1', output: '{"echoed":true}' }],
    tools: [{
      type: 'function',
      name: 'echo',
      description: 'Echo input',
      parameters: {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: { text: { type: 'string' } },
        required: ['text'],
      },
      strict: false,
    }],
  });
});