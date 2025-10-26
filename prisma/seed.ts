import { ExamSessionStatus, PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [admin, proctor] = await Promise.all([
    prisma.user.upsert({
      where: { email: "admin@example.com" },
      update: {
        role: UserRole.ADMIN,
      },
      create: {
        name: "Ada Admin",
        email: "admin@example.com",
        role: UserRole.ADMIN,
      },
    }),
    prisma.user.upsert({
      where: { email: "proctor@example.com" },
      update: {
        role: UserRole.PROCTOR,
      },
      create: {
        name: "Paul Proctor",
        email: "proctor@example.com",
        role: UserRole.PROCTOR,
      },
    }),
  ]);

  const exam = await prisma.exam.upsert({
    where: { id: "demo-exam" },
    update: {},
    create: {
      id: "demo-exam",
      title: "Remote Exam Compliance Demo",
      description:
        "A sample assessment showcasing question delivery, identity verification, behavioural analytics, and retention policies.",
      durationMinutes: 90,
      requirements:
        "Candidate must present a government-issued ID, maintain a stable internet connection, and allow webcam, screen, and audio recording.",
      retentionDays: 365,
    },
  });

  await prisma.examSession.upsert({
    where: { id: "demo-session" },
    update: {},
    create: {
      id: "demo-session",
      examId: exam.id,
      proctorId: proctor.id,
      status: ExamSessionStatus.SCHEDULED,
      scheduledStart: new Date(Date.now() + 1000 * 60 * 60 * 24),
      candidateName: "Casey Candidate",
      candidateEmail: "candidate@example.com",
      candidateExternalId: "ext-candidate-123",
      timezone: "America/New_York",
      notes: "Demo session generated from the Prisma seed script.",
    },
  });

  console.log("Seed data complete:", {
    admin: admin.email,
    proctor: proctor.email,
    exam: exam.title,
  });
}

main()
  .catch((error) => {
    console.error("Seeding failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
