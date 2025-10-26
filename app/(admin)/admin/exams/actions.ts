"use server";

import { Prisma, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";

import { requireRole } from "@/lib/auth";
import { createExam, deleteExam, updateExam } from "@/lib/exams/service";
import {
  examFormSchema,
  examUpdateSchema,
  type ExamFormValues,
  type ExamUpdateValues
} from "@/lib/exams/validation";

type FieldErrors = Record<string, string[]>;

type ActionFailure = {
  success: false;
  message: string;
  fieldErrors?: FieldErrors;
};

type ActionSuccess<T> = {
  success: true;
  data: T;
};

export type ActionResult<T> = ActionSuccess<T> | ActionFailure;

function toFieldErrors(error: FieldErrors | undefined) {
  return error && Object.values(error).some((messages) => messages.length > 0) ? error : undefined;
}

function formatZodError(error: ZodError<unknown>): ActionFailure {
  const { fieldErrors, formErrors } = error.flatten();
  const message = formErrors[0] ?? "Please correct the highlighted fields";

  return {
    success: false,
    message,
    fieldErrors: toFieldErrors(fieldErrors)
  };
}

function handlePrismaError(error: unknown): ActionFailure {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return {
        success: false,
        message: "An exam with similar details already exists. Adjust the title or try again."
      };
    }

    if (error.code === "P2025") {
      return {
        success: false,
        message: "The requested exam could not be found."
      };
    }
  }

  return {
    success: false,
    message: "Something went wrong. Please try again."
  };
}

export async function createExamAction(input: ExamFormValues): Promise<ActionResult<{ id: string }>> {
  const session = await requireRole(Role.ADMIN, { redirectTo: "/admin/exams" });

  const parsed = examFormSchema.safeParse(input);

  if (!parsed.success) {
    return formatZodError(parsed.error);
  }

  try {
    const exam = await createExam(parsed.data, session.user.id);
    revalidatePath("/admin/exams");

    return {
      success: true,
      data: { id: exam.id }
    };
  } catch (error) {
    return handlePrismaError(error);
  }
}

export async function updateExamAction(input: ExamUpdateValues): Promise<ActionResult<{ id: string }>> {
  const session = await requireRole(Role.ADMIN, { redirectTo: "/admin/exams" });

  const parsed = examUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return formatZodError(parsed.error);
  }

  try {
    const exam = await updateExam(parsed.data, session.user.id);
    revalidatePath("/admin/exams");

    return {
      success: true,
      data: { id: exam.id }
    };
  } catch (error) {
    return handlePrismaError(error);
  }
}

export async function deleteExamAction(examId: string): Promise<ActionResult<{ id: string }>> {
  const session = await requireRole(Role.ADMIN, { redirectTo: "/admin/exams" });

  if (!examId) {
    return {
      success: false,
      message: "Exam id is required"
    };
  }

  try {
    const exam = await deleteExam(examId, session.user.id);
    revalidatePath("/admin/exams");

    return {
      success: true,
      data: { id: exam.id }
    };
  } catch (error) {
    return handlePrismaError(error);
  }
}
