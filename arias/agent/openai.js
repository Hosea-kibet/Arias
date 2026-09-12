import OpenAI from 'openai';

const model = process.env.OPENAI_MODEL || 'gpt-5-mini';
const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export async function runAgent(prompt) {
  if (!client) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const response = await client.responses.create({
    model,
    instructions: 'You are Arias, a concise and helpful workplace assistant inside Slack.',
    input: prompt,
  });

  return response.output_text || 'I could not produce a response.';
}