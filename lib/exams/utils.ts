import { randomBytes } from "crypto";

import { prisma } from "@/lib/prisma";

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export async function generateUniqueExamSlug(title: string, options: { excludeId?: string } = {}) {
  const base = slugify(title);
  const fallback = `exam-${randomBytes(4).toString("hex")}`;
  const cleanBase = base.length > 0 ? base : fallback;

  let candidate = cleanBase;
  let suffix = 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.exam.findFirst({
      where: {
        slug: candidate,
        ...(options.excludeId ? { NOT: { id: options.excludeId } } : {})
      },
      select: { id: true }
    });

    if (!existing) {
      return candidate;
    }

    candidate = `${cleanBase}-${suffix}`;
    suffix += 1;
  }
}

export function generateCandidateAccessToken() {
  return randomBytes(16).toString("hex");
}

export function buildCandidateLink(
  baseUrl: string,
  exam: { slug: string; candidateAccessToken: string }
): string {
  const trimmedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return `${trimmedBase}/exam/${exam.slug}/start?token=${encodeURIComponent(exam.candidateAccessToken)}`;
}
