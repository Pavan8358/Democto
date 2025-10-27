import { NextResponse } from "next/server";

import { flagStore } from "@/lib/store/flag-store";
import { flagEventInputSchema } from "@/lib/types/flags";

type RouteContext = {
  params: {
    sessionId: string;
  };
};

export async function POST(request: Request, context: RouteContext) {
  const { sessionId } = context.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "Invalid JSON payload",
      },
      { status: 400 },
    );
  }

  const parsed = flagEventInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const event = flagStore.addEvent(sessionId, {
    ...parsed.data,
    metadata: parsed.data.metadata ?? {},
  });

  return NextResponse.json(event, { status: 201 });
}

export async function GET(_request: Request, context: RouteContext) {
  const { sessionId } = context.params;
  const session = flagStore.getSession(sessionId);

  if (!session) {
    return NextResponse.json(
      {
        session: {
          sessionId,
          startedAt: null,
          events: [],
        },
      },
      { status: 200 },
    );
  }

  return NextResponse.json({ session }, { status: 200 });
}
