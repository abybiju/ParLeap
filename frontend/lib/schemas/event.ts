import { z } from 'zod';

export const eventSchema = z.object({
  name: z.string().min(1, 'Event name is required').max(200),
  event_date: z.string().optional().or(z.literal('')),
  status: z.enum(['draft', 'live', 'ended']).optional(),
});

export type EventFormData = z.infer<typeof eventSchema>;
