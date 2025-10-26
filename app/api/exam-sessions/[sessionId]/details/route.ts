import { NextResponse } from "next/server";
import { z } from "zod";

import { InvalidPreflightSessionError, updateCandidateDetails } from "@/lib/exam-sessions/service";

const bodySchema = z.object({
  sessionSecret: z.string().min(1, "sessionSecret is required"),
  candidateName: z
    .string()
    .trim()
    .max(120, "Name must be 120 characters or fewer")
    .transform((value) => (value.length === 0 ? undefined : value))
    .optional(),
  candidateEmail: z
    .string()
    .trim()
    .email("Please enter a valid email address")
    .transform((value) => (value.length === 0 ? undefined : value))
    .optional()
});

type RouteParams = {
  params: {
    sessionId: string;
  };
};

export async function PATCH(request: Request, { params }: RouteParams) {
  const json = await request.json().catch(() => null);

  const parsed = bodySchema.safeParse(json);

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request payload";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }

  const { sessionSecret, candidateEmail, candidateName } = parsed.data;

  try {
    await updateCandidateDetails({
      sessionId: params.sessionId,
      sessionSecret,
      candidateEmail,
      candidateName
    });
  } catch (error) {
    if (error instanceof InvalidPreflightSessionError) {
      return NextResponse.json({ success: false, message: error.message }, { status: 401 });
    }

    console.error("Failed to update candidate details", error);
    return NextResponse.json({ success: false, message: "Unable to update candidate details" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
