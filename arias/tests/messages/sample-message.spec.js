import assert from 'node:assert';
import { beforeEach, describe, it, mock } from 'node:test';
import { sampleMessageCallback } from '../../listeners/messages/sample-message.js';

describe('messages', () => {
  let fakeEvent;
  let fakeSay;
  let fakeLogger;

  beforeEach(() => {
    fakeEvent = {
      text: 'Schedule a meeting tomorrow',
      channel: 'D123',
      ts: '123.456',
    };
    fakeSay = mock.fn();
    fakeLogger = {
      error: mock.fn(),
    };
  });

  it('should call the agent and reply in the message thread', async () => {
    await sampleMessageCallback({
      event: fakeEvent,
      say: fakeSay,
      logger: fakeLogger,
      runAgentFn: async prompt => `Agent response to: ${prompt}`,
    });

    assert.strictEqual(fakeSay.mock.callCount(), 1);
    const callArgs = fakeSay.mock.calls[0].arguments[0];
    assert.deepEqual(callArgs, {
      text: 'Agent response to: Schedule a meeting tomorrow',
      thread_ts: '123.456',
    });
  });

  it('should log both errors when say throws in reply and fallback', async () => {
    const testError = new Error('test exception');
    fakeSay = mock.fn(() => {
      throw testError;
    });
    await sampleMessageCallback({
      event: fakeEvent,
      say: fakeSay,
      logger: fakeLogger,
      runAgentFn: async prompt => `Agent response to: ${prompt}`,
    });

    assert.strictEqual(fakeSay.mock.callCount(), 2);
    assert.deepEqual(fakeLogger.error.mock.calls[0].arguments, [testError]);
    assert.deepEqual(fakeLogger.error.mock.calls[1].arguments, [testError]);
  });

  it('should send fallback message when the agent throws', async () => {
    const testError = new Error('agent failure');
    await sampleMessageCallback({
      event: fakeEvent,
      say: fakeSay,
      logger: fakeLogger,
      runAgentFn: async () => {
        throw testError;
      },
    });

    assert.strictEqual(fakeSay.mock.callCount(), 1);
    const callArgs = fakeSay.mock.calls[0].arguments[0];
    assert.deepEqual(callArgs, {
      text: 'I could not process that request right now. Please try again.',
      thread_ts: '123.456',
    });
    assert.deepEqual(fakeLogger.error.mock.calls[0].arguments, [testError]);
  });
});
