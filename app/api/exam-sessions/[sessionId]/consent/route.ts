import { NextResponse } from "next/server";
import { z } from "zod";

import { InvalidPreflightSessionError, recordConsent } from "@/lib/exam-sessions/service";

const acknowledgementSchema = z.object({
  examRulesAccepted: z.boolean(),
  monitoringAccepted: z.boolean(),
  privacyAccepted: z.boolean()
});

const bodySchema = z.object({
  sessionSecret: z.string().min(1, "sessionSecret is required"),
  acknowledgement: acknowledgementSchema
});

type RouteParams = {
  params: {
    sessionId: string;
  };
};

function extractIpAddress(request: Request): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const [first] = forwarded.split(",");
    if (first) {
      return first.trim();
    }
  }
  const realIp = request.headers.get("x-real-ip");
  return realIp ?? undefined;
}

export async function POST(request: Request, { params }: RouteParams) {
  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request payload";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }

  const { sessionSecret, acknowledgement } = parsed.data;

  if (!Object.values(acknowledgement).every(Boolean)) {
    return NextResponse.json({ success: false, message: "All acknowledgements must be accepted" }, { status: 400 });
  }

  const ipAddress = extractIpAddress(request);
  const userAgent = request.headers.get("user-agent") ?? undefined;

  try {
    await recordConsent({
      sessionId: params.sessionId,
      sessionSecret,
      acknowledgement,
      ipAddress,
      userAgent
    });
  } catch (error) {
    if (error instanceof InvalidPreflightSessionError) {
      return NextResponse.json({ success: false, message: error.message }, { status: 401 });
    }

    console.error("Failed to record consent", error);
    return NextResponse.json({ success: false, message: "Unable to record consent" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
