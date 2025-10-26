import { NextResponse } from "next/server";
import { z } from "zod";

import { InvalidPreflightSessionError, markSessionReady } from "@/lib/exam-sessions/service";

const bodySchema = z.object({
  sessionSecret: z.string().min(1, "sessionSecret is required")
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

  const { sessionSecret } = parsed.data;

  try {
    await markSessionReady({ sessionId: params.sessionId, sessionSecret });
  } catch (error) {
    if (error instanceof InvalidPreflightSessionError) {
      return NextResponse.json({ success: false, message: error.message }, { status: 401 });
    }

    if (error instanceof Error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 400 });
    }

    console.error("Failed to mark session ready", error);
    return NextResponse.json({ success: false, message: "Unable to complete preflight" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
