import { z } from "zod";

type RequiredInProduction =
  | "DATABASE_URL"
  | "NEXTAUTH_SECRET"
  | "EMAIL_FROM"
  | "SMTP_HOST"
  | "SMTP_PORT"
  | "SMTP_USER"
  | "SMTP_PASSWORD"
  | "AWS_ACCESS_KEY_ID"
  | "AWS_SECRET_ACCESS_KEY"
  | "AWS_REGION"
  | "AWS_S3_BUCKET";

const commaSeparatedList = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const serverSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required").optional(),
    NEXTAUTH_SECRET: z.string().min(1, "NEXTAUTH_SECRET is required").optional(),
    NEXTAUTH_URL: z.string().url().optional(),
    EMAIL_FROM: z.string().email("EMAIL_FROM must be a valid email address").optional(),
    SMTP_HOST: z.string().min(1, "SMTP_HOST is required").optional(),
    SMTP_PORT: z.coerce.number().int().positive("SMTP_PORT must be a positive integer").optional(),
    SMTP_USER: z.string().min(1, "SMTP_USER is required").optional(),
    SMTP_PASSWORD: z.string().min(1, "SMTP_PASSWORD is required").optional(),
    AWS_ACCESS_KEY_ID: z.string().min(1, "AWS_ACCESS_KEY_ID is required").optional(),
    AWS_SECRET_ACCESS_KEY: z.string().min(1, "AWS_SECRET_ACCESS_KEY is required").optional(),
    AWS_REGION: z.string().min(1, "AWS_REGION is required").optional(),
    AWS_S3_BUCKET: z.string().min(1, "AWS_S3_BUCKET is required").optional(),
    S3_UPLOAD_ALLOWED_ORIGINS: z
      .preprocess(
        commaSeparatedList,
        z.array(z.string().url("Each origin must be a valid URL")).optional(),
      ),
    RETENTION_DAYS_RECORDINGS: z.coerce.number().int().min(1).default(30),
    RETENTION_DAYS_FLAGS: z.coerce.number().int().min(1).default(90),
    GIT_SHA: z.string().optional(),
    BUILD_TIMESTAMP: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.NODE_ENV !== "production") {
      return;
    }

    const required: RequiredInProduction[] = [
      "DATABASE_URL",
      "NEXTAUTH_SECRET",
      "EMAIL_FROM",
      "SMTP_HOST",
      "SMTP_PORT",
      "SMTP_USER",
      "SMTP_PASSWORD",
      "AWS_ACCESS_KEY_ID",
      "AWS_SECRET_ACCESS_KEY",
      "AWS_REGION",
      "AWS_S3_BUCKET",
    ];

    required.forEach((key) => {
      const value = values[key];

      if (value === undefined || value === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${key} is required in production`,
          path: [key],
        });
        return;
      }

      if (typeof value === "string" && value.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${key} is required in production`,
          path: [key],
        });
      }
    });

    if (!values.S3_UPLOAD_ALLOWED_ORIGINS || values.S3_UPLOAD_ALLOWED_ORIGINS.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "S3_UPLOAD_ALLOWED_ORIGINS must include at least one origin in production",
        path: ["S3_UPLOAD_ALLOWED_ORIGINS"],
      });
    }
  });

const parsed = serverSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV ?? "development",
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  DATABASE_URL: process.env.DATABASE_URL,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  EMAIL_FROM: process.env.EMAIL_FROM,
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
  AWS_REGION: process.env.AWS_REGION,
  AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
  S3_UPLOAD_ALLOWED_ORIGINS: process.env.S3_UPLOAD_ALLOWED_ORIGINS,
  RETENTION_DAYS_RECORDINGS: process.env.RETENTION_DAYS_RECORDINGS,
  RETENTION_DAYS_FLAGS: process.env.RETENTION_DAYS_FLAGS,
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
