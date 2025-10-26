import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string({ required_error: "NEXTAUTH_SECRET is required" }).min(1),
  DATABASE_URL: z.string({ required_error: "DATABASE_URL is required" }).min(1),
  EMAIL_FROM: z.string({ required_error: "EMAIL_FROM is required" }).email(),
  EMAIL_SERVER_HOST: z.string({ required_error: "EMAIL_SERVER_HOST is required" }).min(1),
  EMAIL_SERVER_PORT: z.coerce.number({ required_error: "EMAIL_SERVER_PORT is required" }).int().positive(),
  EMAIL_SERVER_USER: z.string().optional(),
  EMAIL_SERVER_PASSWORD: z.string().optional(),
  EMAIL_SERVER_SECURE: z.enum(["true", "false"]).optional(),
  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_PROCTOR_EMAIL: z.string().email().optional()
});

type RawEnv = z.infer<typeof envSchema>;
type AppEnv = Omit<RawEnv, "EMAIL_SERVER_SECURE"> & { EMAIL_SERVER_SECURE: boolean };

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}

const { EMAIL_SERVER_SECURE: rawSecure, ...rest } = parsed.data;

if ((rest.EMAIL_SERVER_USER && !rest.EMAIL_SERVER_PASSWORD) || (!rest.EMAIL_SERVER_USER && rest.EMAIL_SERVER_PASSWORD)) {
  throw new Error("EMAIL_SERVER_USER and EMAIL_SERVER_PASSWORD must both be provided when using SMTP authentication");
}

const env: AppEnv = {
  ...rest,
  EMAIL_SERVER_SECURE: rawSecure ? rawSecure === "true" : rest.EMAIL_SERVER_PORT === 465
};

type NonEmptyStringKeys = "NEXTAUTH_SECRET" | "DATABASE_URL" | "EMAIL_FROM" | "EMAIL_SERVER_HOST";

const requiredKeys: NonEmptyStringKeys[] = [
  "NEXTAUTH_SECRET",
  "DATABASE_URL",
  "EMAIL_FROM",
  "EMAIL_SERVER_HOST"
];

for (const key of requiredKeys) {
  if (!env[key] || env[key].length === 0) {
    throw new Error(`${key} must be defined`);
  }
}

export { env };
