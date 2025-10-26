import { IdImageType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  InvalidPreflightSessionError,
  buildIdImageKey,
  verifyPreflightSession
} from "@/lib/exam-sessions/service";
import { createSignedUpload } from "@/lib/storage/s3";

const MAX_UPLOAD_SIZE_BYTES = 8 * 1024 * 1024; // 8 MB

const bodySchema = z.object({
  sessionSecret: z.string().min(1, "sessionSecret is required"),
  type: z.nativeEnum(IdImageType),
  mimeType: z.string().min(1, "mimeType is required"),
  size: z.number().int().positive().max(MAX_UPLOAD_SIZE_BYTES, "Image exceeds upload size limit")
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

  const { sessionSecret, type, mimeType, size } = parsed.data;

  let session;
  try {
    session = await verifyPreflightSession(params.sessionId, sessionSecret, { selectExam: true });
  } catch (error) {
    if (error instanceof InvalidPreflightSessionError) {
      return NextResponse.json({ success: false, message: error.message }, { status: 401 });
    }

    console.error("Failed to verify exam session", error);
    return NextResponse.json({ success: false, message: "Unable to initialise upload" }, { status: 500 });
  }

  if (!session.exam?.requiresIdCapture) {
    return NextResponse.json({ success: false, message: "This exam does not require identity capture" }, { status: 400 });
  }

  try {
    const key = buildIdImageKey({ sessionId: params.sessionId, type });
    const signedUpload = await createSignedUpload({
      key,
      contentType: mimeType,
      metadata: {
        "session-id": params.sessionId,
        "image-type": type.toLowerCase(),
        "file-size": String(size)
      }
    });

    return NextResponse.json({
      success: true,
      uploadUrl: signedUpload.url,
      headers: signedUpload.headers,
      key
    });
  } catch (error) {
    console.error("Failed to generate signed upload", error);
    return NextResponse.json({ success: false, message: "Unable to prepare upload target" }, { status: 500 });
  }
}
