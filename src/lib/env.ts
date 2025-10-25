import { z } from "zod";

type RequiredInProduction =
  | "DATABASE_URL"
  | "AUTH_SECRET"
  | "EMAIL_FROM"
  | "EMAIL_SERVER"
  | "AWS_ACCESS_KEY_ID"
  | "AWS_SECRET_ACCESS_KEY"
  | "AWS_REGION"
  | "AWS_S3_BUCKET";

const serverSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required").optional(),
    AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required").optional(),
    AUTH_URL: z.string().url().optional(),
    EMAIL_FROM: z.string().email("EMAIL_FROM must be a valid email address").optional(),
    EMAIL_SERVER: z.string().min(1, "EMAIL_SERVER is required").optional(),
    AWS_ACCESS_KEY_ID: z.string().min(1, "AWS_ACCESS_KEY_ID is required").optional(),
    AWS_SECRET_ACCESS_KEY: z.string().min(1, "AWS_SECRET_ACCESS_KEY is required").optional(),
    AWS_REGION: z.string().min(1, "AWS_REGION is required").optional(),
    AWS_S3_BUCKET: z.string().min(1, "AWS_S3_BUCKET is required").optional(),
    GIT_SHA: z.string().optional(),
    BUILD_TIMESTAMP: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.NODE_ENV !== "production") {
      return;
    }

    const required: RequiredInProduction[] = [
      "DATABASE_URL",
      "AUTH_SECRET",
      "EMAIL_FROM",
      "EMAIL_SERVER",
      "AWS_ACCESS_KEY_ID",
      "AWS_SECRET_ACCESS_KEY",
      "AWS_REGION",
      "AWS_S3_BUCKET",
    ];

    required.forEach((key) => {
      if (!values[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${key} is required in production`,
          path: [key],
        });
      }
    });
  });

const parsed = serverSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV ?? "development",
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  AUTH_URL: process.env.AUTH_URL,
  EMAIL_FROM: process.env.EMAIL_FROM,
  EMAIL_SERVER: process.env.EMAIL_SERVER,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_REGION: process.env.AWS_REGION,
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
  GIT_SHA: process.env.GIT_SHA,
  BUILD_TIMESTAMP: process.env.BUILD_TIMESTAMP,
});

if (!parsed.success) {
  const { fieldErrors, formErrors } = parsed.error.flatten();
  const aggregatedErrors = [
    ...formErrors,
    ...Object.entries(fieldErrors).flatMap(([field, errors]) =>
      errors ? errors.map((error) => `${field}: ${error}`) : [],
    ),
  ];

  throw new Error(
    `Invalid environment variables:\n${aggregatedErrors.map((error) => `  - ${error}`).join("\n")}`,
  );
}

export const env = parsed.data;
export type Env = typeof env;
