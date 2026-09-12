import { runAgent } from '../../agent/openai.js';

const sampleMessageCallback = async ({ event, say, logger, runAgentFn = runAgent }) => {
  if (!event || event.subtype || event.bot_id || !event.text) return;
  const threadTs = event.thread_ts || event.ts;

  let response;
  try {
    response = await runAgentFn(event.text);
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
    return;
  }

  try {
    await say({
      text: response,
      thread_ts: threadTs,
    });
  } catch (error) {
    logger.error(error);
  }
};

export { sampleMessageCallback };
