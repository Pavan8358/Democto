import { NextResponse } from "next/server";

import packageJson from "../../../../package.json";
import { env } from "@/lib/env";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "proctoring-mvp",
    version: packageJson.version,
    environment: env.NODE_ENV,
    build: {
      commitSha: env.GIT_SHA ?? null,
      timestamp: env.BUILD_TIMESTAMP ?? null,
    },
    resources: {
      databaseConfigured: Boolean(env.DATABASE_URL),
      storage: {
        bucket: env.AWS_S3_BUCKET ?? null,
        region: env.AWS_REGION ?? null,
        allowedOrigins: env.S3_UPLOAD_ALLOWED_ORIGINS ?? [],
      },
      retention: {
        recordingsDays: env.RETENTION_DAYS_RECORDINGS,
        flagsDays: env.RETENTION_DAYS_FLAGS,
      },
    },
    uptimeSeconds: Number(process.uptime().toFixed(0)),
  });
}
