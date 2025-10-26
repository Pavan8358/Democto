import { prisma } from "@/lib/prisma";

import { generateCandidateAccessToken, generateUniqueExamSlug } from "./utils";
import type { ExamFormValues, ExamUpdateValues } from "./validation";

type ChangedField = {
  previous: unknown;
  next: unknown;
};

type ChangedFields = Record<string, ChangedField>;

export async function createExam(values: ExamFormValues, actorId: string) {
  const slug = await generateUniqueExamSlug(values.title);
  const candidateAccessToken = generateCandidateAccessToken();

  const exam = await prisma.exam.create({
    data: {
      slug,
      title: values.title,
      description: values.description ?? null,
      status: values.status,
      durationMinutes: values.durationMinutes,
      requiresCamera: values.requiresCamera,
      requiresMicrophone: values.requiresMicrophone,
      requiresScreenShare: values.requiresScreenShare,
      requiresIdCapture: values.requiresIdCapture,
      retentionDays: values.retentionDays,
      instructions: values.instructions ?? null,
      candidateAccessToken
    }
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      examId: exam.id,
      targetType: "exam",
      targetId: exam.id,
      action: "exam.created",
      description: `Exam \"${exam.title}\" created`,
      metadata: {
        status: exam.status,
        retentionDays: exam.retentionDays
      }
    }
  });

  return exam;
}

export async function updateExam(values: ExamUpdateValues, actorId: string) {
  const existing = await prisma.exam.findUnique({ where: { id: values.id } });

  if (!existing) {
    throw new Error("Exam not found");
  }

  const changed: ChangedFields = {};

  const shouldUpdateSlug = existing.title !== values.title;
  const slug = shouldUpdateSlug ? await generateUniqueExamSlug(values.title, { excludeId: values.id }) : existing.slug;

  const data = {
    slug,
    title: values.title,
    description: values.description ?? null,
    status: values.status,
    durationMinutes: values.durationMinutes,
    requiresCamera: values.requiresCamera,
    requiresMicrophone: values.requiresMicrophone,
    requiresScreenShare: values.requiresScreenShare,
    requiresIdCapture: values.requiresIdCapture,
    retentionDays: values.retentionDays,
    instructions: values.instructions ?? null
  } as const;

  (Object.keys(data) as (keyof typeof data)[]).forEach((key) => {
    const existingKey = key as keyof typeof existing;
    if (data[key] !== existing[existingKey]) {
      changed[key as string] = {
        previous: existing[existingKey],
        next: data[key]
      };
    }
  });

  if (Object.keys(changed).length === 0) {
    return existing;
  }

  const exam = await prisma.exam.update({
    where: { id: values.id },
    data
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      examId: exam.id,
      targetType: "exam",
      targetId: exam.id,
      action: "exam.updated",
      description: `Exam \"${exam.title}\" updated`,
      metadata: {
        changedFields: changed
      }
    }
  });

  return exam;
}

export async function deleteExam(examId: string, actorId: string) {
  const exam = await prisma.exam.delete({
    where: { id: examId }
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      examId: exam.id,
      targetType: "exam",
      targetId: exam.id,
      action: "exam.deleted",
      description: `Exam \"${exam.title}\" deleted`
    }
  });

  return exam;
}
