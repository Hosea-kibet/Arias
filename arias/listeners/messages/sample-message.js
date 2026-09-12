import { runAgent } from '../../agent/openai.js';

const sampleMessageCallback = async ({ event, say, logger, runAgentFn = runAgent }) => {
  const threadTs = event?.thread_ts || event?.ts;
  try {
    if (!event || event.subtype || event.bot_id || !event.text) return;
    const response = await runAgentFn(event.text);
    await say({
      text: response,
      thread_ts: threadTs,
    });
  } catch (error) {
    logger.error(error);
    try {
      await say({
        text: 'I could not process that request right now. Please try again.',
        thread_ts: threadTs,
      });
    } catch (responseError) {
      logger.error(responseError);
    }
  }
};

export { sampleMessageCallback };
