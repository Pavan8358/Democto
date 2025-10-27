import { z } from "zod";

export const flagTypeSchema = z.enum([
  "FACE_MISSING",
  "MULTIPLE_FACES",
  "SPEAKING",
  "TAB_SWITCH",
  "SCREEN_SHARE_ENDED",
]);

export type FlagType = z.infer<typeof flagTypeSchema>;

export const flagSeveritySchema = z.enum(["info", "warning", "critical"]);

export type FlagSeverity = z.infer<typeof flagSeveritySchema>;

export const flagMetadataSchema = z.record(z.unknown()).default({});

export type FlagMetadata = z.infer<typeof flagMetadataSchema>;

export const flagEventInputSchema = z.object({
  type: flagTypeSchema,
  severity: flagSeveritySchema,
  relativeMs: z.number().int().nonnegative(),
  metadata: flagMetadataSchema.optional(),
});

export type FlagEventInput = z.infer<typeof flagEventInputSchema>;

export interface FlagEvent extends FlagEventInput {
  id: string;
  sessionId: string;
  occurredAt: string;
}

export interface SessionFlagLog {
  sessionId: string;
  startedAt: string;
  events: FlagEvent[];
}
