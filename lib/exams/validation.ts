import { ExamStatus } from "@prisma/client";
import { z } from "zod";

const MAX_DESCRIPTION_LENGTH = 600;
const MAX_INSTRUCTIONS_LENGTH = 4000;

const optionalTrimmedString = z
  .string()
  .trim()
  .transform((value) => (value.length === 0 ? undefined : value))
  .optional();

export const examFormSchema = z.object({
  title: z
    .string({ required_error: "Title is required" })
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(120, "Title must be 120 characters or less"),
  description: optionalTrimmedString.refine(
    (value) => (typeof value === "string" ? value.length <= MAX_DESCRIPTION_LENGTH : true),
    `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`
  ),
  status: z.nativeEnum(ExamStatus),
  durationMinutes: z
    .number({ invalid_type_error: "Duration is required" })
    .int("Duration must be a whole number")
    .min(5, "Duration must be at least 5 minutes")
    .max(480, "Duration must be 480 minutes or less"),
  requiresCamera: z.boolean().default(true),
  requiresMicrophone: z.boolean().default(true),
  requiresScreenShare: z.boolean().default(false),
  requiresIdCapture: z.boolean().default(false),
  retentionDays: z
    .number({ invalid_type_error: "Retention period is required" })
    .int("Retention days must be a whole number")
    .min(30, "Retention must be at least 30 days")
    .max(3650, "Retention cannot exceed 10 years"),
  instructions: optionalTrimmedString.refine(
    (value) => (typeof value === "string" ? value.length <= MAX_INSTRUCTIONS_LENGTH : true),
    `Instructions must be ${MAX_INSTRUCTIONS_LENGTH} characters or less`
  )
});

export const examUpdateSchema = examFormSchema.extend({
  id: z.string({ required_error: "Exam id is required" }).cuid("Exam id must be a valid CUID")
});

export type ExamFormValues = z.infer<typeof examFormSchema>;
export type ExamUpdateValues = z.infer<typeof examUpdateSchema>;

export const examDefaultValues: ExamFormValues = {
  title: "",
  description: undefined,
  status: ExamStatus.DRAFT,
  durationMinutes: 90,
  requiresCamera: true,
  requiresMicrophone: true,
  requiresScreenShare: true,
  requiresIdCapture: true,
  retentionDays: 365,
  instructions: undefined
};
