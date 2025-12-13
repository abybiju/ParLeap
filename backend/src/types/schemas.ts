/**
 * Zod Schemas for WebSocket Message Validation
 * 
 * Validates incoming client messages before processing
 */

import { z } from 'zod';

// ============================================
// Client-to-Server Message Schemas
// ============================================

export const StartSessionSchema = z.object({
  type: z.literal('START_SESSION'),
  payload: z.object({
    eventId: z.string().uuid(),
  }),
});

export const AudioDataSchema = z.object({
  type: z.literal('AUDIO_DATA'),
  payload: z.object({
    data: z.string(), // Base64 encoded audio
    format: z
      .object({
        sampleRate: z.number().optional(),
        channels: z.number().optional(),
        encoding: z.string().optional(),
      })
      .optional(),
  }),
});

export const ManualOverrideSchema = z.object({
  type: z.literal('MANUAL_OVERRIDE'),
  payload: z.object({
    action: z.enum(['NEXT_SLIDE', 'PREV_SLIDE', 'GO_TO_SLIDE']),
    slideIndex: z.number().optional(),
    songId: z.string().uuid().optional(),
  }),
});

export const StopSessionSchema = z.object({
  type: z.literal('STOP_SESSION'),
});

export const PingSchema = z.object({
  type: z.literal('PING'),
});

/**
 * Combined schema for all client messages
 */
export const ClientMessageSchema = z.discriminatedUnion('type', [
  StartSessionSchema,
  AudioDataSchema,
  ManualOverrideSchema,
  StopSessionSchema,
  PingSchema,
]);

// ============================================
// Type inference from schemas
// ============================================

export type ValidatedStartSession = z.infer<typeof StartSessionSchema>;
export type ValidatedAudioData = z.infer<typeof AudioDataSchema>;
export type ValidatedManualOverride = z.infer<typeof ManualOverrideSchema>;
export type ValidatedStopSession = z.infer<typeof StopSessionSchema>;
export type ValidatedPing = z.infer<typeof PingSchema>;
export type ValidatedClientMessage = z.infer<typeof ClientMessageSchema>;

// ============================================
// Validation helper
// ============================================

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Validate a raw message against the client message schema
 */
export function validateClientMessage(raw: unknown): ValidationResult<ValidatedClientMessage> {
  const result = ClientMessageSchema.safeParse(raw);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return {
    success: false,
    error: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
  };
}

