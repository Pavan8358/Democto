import { NextResponse } from "next/server";
import { z } from "zod";

import { InvalidPreflightSessionError, storeHardwareReport } from "@/lib/exam-sessions/service";

const bodySchema = z.object({
  sessionSecret: z.string().min(1, "sessionSecret is required"),
  browserName: z.string().trim().max(120).optional(),
  browserVersion: z.string().trim().max(60).optional(),
  platform: z.string().trim().max(120).optional(),
  timezone: z.string().trim().max(120).optional(),
  hardwareReport: z.unknown(),
  permissionsReport: z.unknown(),
  diagnostics: z.unknown()
});

type RouteParams = {
  params: {
    sessionId: string;
  };
};

export async function POST(request: Request, { params }: RouteParams) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request payload";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }

  const { sessionSecret, ...rest } = parsed.data;

  try {
    await storeHardwareReport({
      sessionId: params.sessionId,
      sessionSecret,
      browserName: rest.browserName,
      browserVersion: rest.browserVersion,
      platform: rest.platform,
      timezone: rest.timezone,
      hardwareReport: rest.hardwareReport,
      permissionsReport: rest.permissionsReport,
      diagnostics: rest.diagnostics
    });
  } catch (error) {
    if (error instanceof InvalidPreflightSessionError) {
      return NextResponse.json({ success: false, message: error.message }, { status: 401 });
    }

    console.error("Failed to store hardware report", error);
    return NextResponse.json({ success: false, message: "Unable to store hardware report" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
