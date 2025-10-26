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
    uptimeSeconds: Number(process.uptime().toFixed(0)),
  });
}
