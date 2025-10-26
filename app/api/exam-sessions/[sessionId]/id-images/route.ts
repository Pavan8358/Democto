import { IdImageType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { InvalidPreflightSessionError, recordIdImage } from "@/lib/exam-sessions/service";

const bodySchema = z.object({
  sessionSecret: z.string().min(1, "sessionSecret is required"),
  type: z.nativeEnum(IdImageType),
  s3Key: z.string().min(1, "s3Key is required"),
  mimeType: z.string().min(1, "mimeType is required"),
  size: z.number().int().positive(),
  capturedAt: z.string().datetime().optional()
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

  const { sessionSecret, type, s3Key, mimeType, size, capturedAt } = parsed.data;

  if (!s3Key.startsWith(`exam-sessions/${params.sessionId}/id/`)) {
    return NextResponse.json({ success: false, message: "Invalid storage key" }, { status: 400 });
  }

  try {
    await recordIdImage({
      sessionId: params.sessionId,
      sessionSecret,
      type,
      s3Key,
      mimeType,
      fileSize: size,
      capturedAt: capturedAt ? new Date(capturedAt) : undefined
    });
  } catch (error) {
    if (error instanceof InvalidPreflightSessionError) {
      return NextResponse.json({ success: false, message: error.message }, { status: 401 });
    }

    console.error("Failed to record ID image", error);
    return NextResponse.json({ success: false, message: "Unable to store identity capture" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
