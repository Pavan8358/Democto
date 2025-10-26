import { headers } from "next/headers";

import { env } from "@/lib/env";
import { createPreflightSession } from "@/lib/exam-sessions/service";
import { prisma } from "@/lib/prisma";

import { PreflightFlow } from "./preflight-flow";

type PageProps = {
  params: {
    examSlug: string;
  };
  searchParams?: Record<string, string | string[] | undefined>;
};

function getSingleParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return undefined;
}

export default async function ExamPreflightPage({ params, searchParams = {} }: PageProps) {
  const token = getSingleParam(searchParams.token);

  if (!token) {
    return <InvalidExamLink />;
  }

  const exam = await prisma.exam.findUnique({
    where: { slug: params.examSlug },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      instructions: true,
      durationMinutes: true,
      requiresCamera: true,
      requiresMicrophone: true,
      requiresScreenShare: true,
      requiresIdCapture: true,
      candidateAccessToken: true
    }
  });

  if (!exam || exam.candidateAccessToken !== token) {
    return <InvalidExamLink />;
  }

  const requestHeaders = headers();
  const forwarded = requestHeaders.get("x-forwarded-for");
  const ipAddress = forwarded?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || undefined;
  const userAgent = requestHeaders.get("user-agent") || undefined;

  const candidateName = getSingleParam(searchParams.name);
  const candidateEmail = getSingleParam(searchParams.email);

  const { session, sessionSecret } = await createPreflightSession({
    examId: exam.id,
    candidateName,
    candidateEmail,
    userAgent,
    ipAddress
  });

  return (
    <PreflightFlow
      exam={{
        id: exam.id,
        slug: exam.slug,
        title: exam.title,
        description: exam.description ?? undefined,
        instructions: exam.instructions ?? undefined,
        durationMinutes: exam.durationMinutes,
        requiresCamera: exam.requiresCamera,
        requiresMicrophone: exam.requiresMicrophone,
        requiresScreenShare: exam.requiresScreenShare,
        requiresIdCapture: exam.requiresIdCapture
      }}
      session={{
        id: session.id,
        candidateName: session.candidateName ?? undefined,
        candidateEmail: session.candidateEmail ?? undefined
      }}
      sessionSecret={sessionSecret}
      policyVersion={env.CONSENT_POLICY_VERSION}
    />
  );
}

function InvalidExamLink() {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h1>Invalid exam link</h1>
        <p>The preflight link you used is no longer valid. Request a new secure link from your exam organiser.</p>
      </div>
      <div>
        <p style={{ color: "#4b5563" }}>If you believe this is an error, contact your support representative with the exam details.</p>
      </div>
    </section>
  );
}
