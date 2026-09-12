import type { z } from 'zod';

export interface AgentTool {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  execute(input: unknown): Promise<unknown>;
}
