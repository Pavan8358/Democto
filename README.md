# Exam Proctoring MVP

Greenfield Next.js 14 project that serves as the foundation for an automated exam proctoring platform. The app ships with TypeScript, Tailwind CSS, ESLint, Prettier, Husky, and lint-staged so the quality gate is ready on day one.

## Getting started

1. Duplicate `.env.example` to `.env.local` and supply environment-specific values.
2. Install dependencies with:
   ```bash
   pnpm install
   ```
3. Start the development server:
   ```bash
   pnpm dev
   ```
4. Visit [http://localhost:3000](http://localhost:3000) to view the shell layout.

## Useful scripts

| Command           | Description                                 |
| ----------------- | ------------------------------------------- |
| `pnpm dev`        | Runs the Next.js development server.        |
| `pnpm build`      | Creates an optimized production build.      |
| `pnpm lint`       | Executes ESLint (App Router + TypeScript).  |
| `pnpm type-check` | Runs the TypeScript compiler in check mode. |
| `pnpm format`     | Formats the repository with Prettier.       |

## Tooling highlights

- **Next.js 14 App Router** with TypeScript and `/src` directory structure.
- **Tailwind CSS v4** for styling via `@tailwindcss/postcss`.
- **ESLint + Prettier** for consistent code quality and formatting.
- **Husky + lint-staged** pre-commit workflow that runs linting and type checks before changes land in git.
- **GitHub Actions** workflow to run linting and type checks on every pull request.

## Monitoring & QA

- Launch the home page to access the real-time session monitor that raises face, speaking, and
  attention flags.
- Follow `docs/manual-qa/detection-flags.md` for a step-by-step validation script covering the core
  flag scenarios.

Happy shipping! 🚀
