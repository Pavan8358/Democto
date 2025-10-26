import { ExamSessionStatus, IdImageType } from "@prisma/client";

import { hashString, generateSessionSecret } from "@/lib/crypto";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export class InvalidPreflightSessionError extends Error {
  constructor(message = "Invalid or expired exam session") {
    super(message);
    this.name = "InvalidPreflightSessionError";
  }
}

type CreatePreflightSessionInput = {
  examId: string;
  candidateName?: string;
  candidateEmail?: string;
  userAgent?: string;
  ipAddress?: string;
};

export async function createPreflightSession(input: CreatePreflightSessionInput) {
  const { secret, hash } = generateSessionSecret();

  const session = await prisma.examSession.create({
    data: {
      examId: input.examId,
      sessionKey: hash,
      status: ExamSessionStatus.PREPARING,
      candidateName: input.candidateName ?? null,
      candidateEmail: input.candidateEmail ?? null,
      userAgent: input.userAgent ?? null,
      ipAddress: input.ipAddress ?? null
    },
    select: {
      id: true,
      examId: true,
      status: true,
      candidateName: true,
      candidateEmail: true
    }
  });

  await prisma.auditLog.create({
    data: {
      examId: session.examId,
      examSessionId: session.id,
      targetType: "examSession",
      targetId: session.id,
      action: "candidate.preflight.created",
      description: "Candidate preflight session initialized",
      metadata: {
        candidateName: input.candidateName ?? null,
        candidateEmail: input.candidateEmail ?? null,
        userAgent: input.userAgent ?? null,
        ipAddress: input.ipAddress ?? null
      }
    }
  });

  return {
    session,
    sessionSecret: secret
  };
}

type VerifySessionOptions = {
  selectExam?: boolean;
};

async function requireSession(sessionId: string, sessionSecret: string, options: VerifySessionOptions = {}) {
  const hashedSecret = hashString(sessionSecret);

  const session = await prisma.examSession.findFirst({
    where: {
      id: sessionId,
      sessionKey: hashedSecret
    },
    select: {
      id: true,
      examId: true,
      status: true,
      candidateName: true,
      candidateEmail: true,
      hardwareReport: true,
      permissionsReport: true,
      diagnostics: true,
      browserName: true,
      browserVersion: true,
      platform: true,
      timezone: true,
      exam: options.selectExam
        ? {
            select: {
              id: true,
              requiresCamera: true,
              requiresMicrophone: true,
              requiresScreenShare: true,
              requiresIdCapture: true
            }
          }
        : undefined
    }
  });

  if (!session) {
    throw new InvalidPreflightSessionError();
  }

  return session;
}

export async function verifyPreflightSession(sessionId: string, sessionSecret: string, options: VerifySessionOptions = {}) {
  return requireSession(sessionId, sessionSecret, options);
}

type UpdateCandidateDetailsInput = {
  sessionId: string;
  sessionSecret: string;
  candidateName?: string;
  candidateEmail?: string;
};

export async function updateCandidateDetails(input: UpdateCandidateDetailsInput) {
  const session = await requireSession(input.sessionId, input.sessionSecret);

  await prisma.examSession.update({
    where: { id: session.id },
    data: {
      candidateName: input.candidateName ?? null,
      candidateEmail: input.candidateEmail ?? null
    }
  });
}

type HardwareReportInput = {
  sessionId: string;
  sessionSecret: string;
  browserName?: string;
  browserVersion?: string;
  platform?: string;
  timezone?: string;
  hardwareReport: unknown;
  permissionsReport: unknown;
  diagnostics: unknown;
};

export async function storeHardwareReport(input: HardwareReportInput) {
  const session = await requireSession(input.sessionId, input.sessionSecret);

  await prisma.examSession.update({
    where: { id: session.id },
    data: {
      browserName: input.browserName ?? null,
      browserVersion: input.browserVersion ?? null,
      platform: input.platform ?? null,
      timezone: input.timezone ?? null,
      hardwareReport: input.hardwareReport,
      permissionsReport: input.permissionsReport,
      diagnostics: input.diagnostics
    }
  });
}

type ConsentInput = {
  sessionId: string;
  sessionSecret: string;
  ipAddress?: string;
  userAgent?: string;
  acknowledgement: Record<string, boolean>;
};

export async function recordConsent(input: ConsentInput) {
  const session = await requireSession(input.sessionId, input.sessionSecret, { selectExam: true });

  await prisma.consent.create({
    data: {
      examSessionId: session.id,
      policyVersion: env.CONSENT_POLICY_VERSION,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      metadata: input.acknowledgement
    }
  });

  await prisma.auditLog.create({
    data: {
      examId: session.examId,
      examSessionId: session.id,
      targetType: "examSession",
      targetId: session.id,
      action: "candidate.consent.recorded",
      description: `Candidate consent captured (policy v${env.CONSENT_POLICY_VERSION})`,
      metadata: {
        acknowledgement: input.acknowledgement
      }
    }
  });
}

type IdImageRecordInput = {
  sessionId: string;
  sessionSecret: string;
  type: IdImageType;
  s3Key: string;
  mimeType: string;
  fileSize: number;
  capturedAt?: Date;
  metadata?: Record<string, unknown>;
};

export async function recordIdImage(input: IdImageRecordInput) {
  const session = await requireSession(input.sessionId, input.sessionSecret, { selectExam: true });

  await prisma.idImage.create({
    data: {
      examSessionId: session.id,
      type: input.type,
      s3Key: input.s3Key,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      capturedAt: input.capturedAt ?? null,
      metadata: input.metadata ?? null
    }
  });

  await prisma.auditLog.create({
    data: {
      examId: session.examId,
      examSessionId: session.id,
      targetType: "examSession",
      targetId: session.id,
      action: "candidate.id_image.captured",
      description: `Candidate ID image captured (${input.type.toLowerCase()})`,
      metadata: {
        mimeType: input.mimeType,
        fileSize: input.fileSize,
        s3Key: input.s3Key
      }
    }
  });
}

type SignedUploadConfig = {
  sessionId: string;
  type: IdImageType;
};

export function buildIdImageKey(config: SignedUploadConfig): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `exam-sessions/${config.sessionId}/id/${config.type.toLowerCase()}-${timestamp}.jpg`;
}

type CompletionInput = {
  sessionId: string;
  sessionSecret: string;
};

export async function markSessionReady(input: CompletionInput) {
  const session = await requireSession(input.sessionId, input.sessionSecret, { selectExam: true });

  const [consentAggregate, idImageAggregate] = await prisma.$transaction([
    prisma.consent.aggregate({
      where: { examSessionId: session.id },
      _count: { _all: true }
    }),
    prisma.idImage.aggregate({
      where: { examSessionId: session.id },
      _count: { _all: true }
    })
  ]);

  const consentCount = consentAggregate._count?._all ?? 0;
  const idImageCount = idImageAggregate._count?._all ?? 0;

  if (consentCount === 0) {
    throw new Error("Consent acknowledgement is required before starting the exam.");
  }

  if (session.exam?.requiresIdCapture) {
    const requiredTypes: IdImageType[] = [IdImageType.FRONT, IdImageType.BACK, IdImageType.SELFIE];
    const existingTypes = await prisma.idImage.findMany({
      where: { examSessionId: session.id },
      select: { type: true }
    });
    const typeSet = new Set(existingTypes.map((entry) => entry.type));
    const missing = requiredTypes.filter((type) => !typeSet.has(type));

    if (missing.length > 0) {
      throw new Error("All required identity images must be captured before continuing.");
    }
  } else if (idImageCount > 0) {
    // Optional ID capture - already captured images are fine
  }

  if (!session.hardwareReport || !session.permissionsReport) {
    throw new Error("Device permissions must be verified before continuing.");
  }

  await prisma.examSession.update({
    where: { id: session.id },
    data: {
      status: ExamSessionStatus.READY,
      preflightCompletedAt: new Date()
    }
  });

  await prisma.auditLog.create({
    data: {
      examId: session.examId,
      examSessionId: session.id,
      targetType: "examSession",
      targetId: session.id,
      action: "candidate.preflight.ready",
      description: "Candidate preflight completed and session marked READY"
    }
  });
}
