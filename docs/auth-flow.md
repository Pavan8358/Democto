# Passwordless email authentication flow

This document outlines the expected behaviour for the passwordless email authentication system.

## Pre-requisites

- Configure the following environment variables before running the application:
  - `DATABASE_URL`
  - `NEXTAUTH_SECRET`
  - `EMAIL_FROM`
  - `EMAIL_SERVER_HOST`
  - `EMAIL_SERVER_PORT`
  - Optional: `EMAIL_SERVER_USER` and `EMAIL_SERVER_PASSWORD` (required together when SMTP authentication is needed)
  - `SEED_ADMIN_EMAIL` (and optional `SEED_PROCTOR_EMAIL`) for the seed users
- Run `npm install`
- Push the Prisma schema to the database with `npm run db:push`
- Generate the Prisma client with `npm run prisma:generate`
- Seed the database with `npm run db:seed`

## Happy path walkthrough

1. Start the development server with `npm run dev`.
2. Visit `/sign-in` and enter a valid email address.
3. The console running the dev server will log the issued magic link (e.g. `🔐 Magic link sent to user@example.com: https://...`).
4. Open the logged link in a browser. The user is redirected back to the app and authenticated.
5. Navigate to `/admin`:
   - If the signed-in email matches the seeded admin address, the page loads successfully.
   - Otherwise, the user is redirected to `/unauthorized`.
6. Navigate to `/proctor`:
   - Admin and proctor users can access the page.
   - Candidates are redirected to `/unauthorized`.
7. Click “Sign out” from the header to destroy the session.

This flow provides manual verification of the passwordless login. For local Mailhog or Mailtrap instances, the SMTP credentials can be configured through the environment variables above.
