import { PrismaClient, Role } from "@prisma/client";

import { env } from "../lib/env";

const prisma = new PrismaClient();

async function upsertUser(email: string, role: Role) {
  await prisma.user.upsert({
    where: { email },
    update: { role },
    create: {
      email,
      role,
      emailVerified: new Date()
    }
  });

  console.info(`Seeded ${role.toLowerCase()} user: ${email}`);
}

async function main() {
  if (env.SEED_ADMIN_EMAIL) {
    await upsertUser(env.SEED_ADMIN_EMAIL, Role.ADMIN);
  } else {
    console.warn("⚠️  No SEED_ADMIN_EMAIL provided. Set this environment variable to seed an admin user.");
  }

  if (env.SEED_PROCTOR_EMAIL) {
    await upsertUser(env.SEED_PROCTOR_EMAIL, Role.PROCTOR);
  }
}

main()
  .catch((error) => {
    console.error("Error while seeding database", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
