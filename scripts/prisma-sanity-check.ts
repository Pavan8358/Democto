import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    take: 5,
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  const exams = await prisma.exam.findMany({
    take: 5,
    select: {
      id: true,
      title: true,
      durationMinutes: true,
    },
  });

  console.log("Sample users:", users);
  console.log("Sample exams:", exams);
}

main()
  .catch((error) => {
    console.error("Prisma sanity check failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
