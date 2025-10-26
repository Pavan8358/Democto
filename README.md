# Exam Proctoring MVP

Greenfield Next.js 14 project that serves as the foundation for an automated exam proctoring platform. The app ships with TypeScript, Tailwind CSS, ESLint, Prettier, Husky, and lint-staged so the quality gate is ready on day one.

## Getting started

1. Duplicate `.env.example` to `.env.local` and supply environment-specific values.
2. Install dependencies with:
   ```bash
   pnpm install
   ```
3. Run the initial Prisma migration (requires a reachable PostgreSQL database):
   ```bash
   pnpm prisma:migrate
   ```
4. (Optional) Seed the database with demo data:
   ```bash
   pnpm db:seed
   ```
5. Start the development server:
   ```bash
   pnpm dev
   ```
6. Visit [http://localhost:3000](http://localhost:3000) to view the shell layout.

## Useful scripts

| Command                | Description                                                      |
| ---------------------- | ---------------------------------------------------------------- |
| `pnpm dev`             | Runs the Next.js development server.                             |
| `pnpm build`           | Creates an optimized production build.                           |
| `pnpm start`           | Starts the Next.js server in production mode.                    |
| `pnpm lint`            | Executes ESLint (App Router + TypeScript).                       |
| `pnpm type-check`      | Runs the TypeScript compiler in check mode.                      |
| `pnpm format`          | Formats the repository with Prettier.                            |
| `pnpm prisma:migrate`  | Applies the latest Prisma migrations to the configured database. |
| `pnpm prisma:generate` | Regenerates the Prisma Client after schema changes.              |
| `pnpm prisma:studio`   | Opens Prisma Studio to explore your data graphically.            |
| `pnpm db:seed`         | Runs the seed script to load demo users and exam data.           |

## Tooling highlights

- **Next.js 14 App Router** with TypeScript and `/src` directory structure.
- **Tailwind CSS v4** for styling via `@tailwindcss/postcss`.
- **ESLint + Prettier** for consistent code quality and formatting.
- **Husky + lint-staged** pre-commit workflow that runs linting and type checks before changes land in git.
- **GitHub Actions** workflow to run linting and type checks on every pull request.

## Database schema

This project uses Prisma with PostgreSQL (Neon/Railway compatible) for relational storage. The datamodel is defined in [`prisma/schema.prisma`](./prisma/schema.prisma) and versioned migrations live in [`prisma/migrations`](./prisma/migrations).

### Key models

- `User`, `Account`, `Session`, `VerificationToken` — NextAuth-compatible authentication tables with role support via `UserRole`.
- `Exam` and `ExamSession` — exam metadata, scheduling, and candidate/proctor assignments with status tracking.
- `Recording` and `MediaChunk` — capture artefacts for webcam, screen, audio, and manifest uploads with per-chunk processing status.
- `FlagEvent` — structured compliance events referencing sessions, recordings, or individual media chunks.
- `Consent` — granular opt-in records for terms, privacy, recording, and data sharing flows.
- `IdImage` — identity verification imagery (front/back/selfie) stored by S3 key with capture timestamps.
- `AuditLog` — immutable actor/action log for compliance and monitoring use cases.

The generated Prisma Client is exposed via [`src/lib/prisma.ts`](./src/lib/prisma.ts). Example usage:

```ts
import { prisma } from "@/lib/prisma";

const users = await prisma.user.findMany();
const exams = await prisma.exam.findMany();
```

After applying migrations you can validate the connection locally with `pnpm tsx scripts/prisma-sanity-check.ts`.

Happy shipping! 🚀
