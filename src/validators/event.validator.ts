import { z } from 'zod';

export const createEventSchema = z.strictObject({
  type: z.string().trim().min(1).max(100),
  source: z.enum(['api', 'slack']).default('api'),
  payload: z.record(z.string(), z.json()),
  idempotencyKey: z.string().trim().min(1).max(200).optional(),
});

export const eventParamsSchema = z.object({ id: z.string().min(1) });
export type CreateEventInput = z.infer<typeof createEventSchema>;
