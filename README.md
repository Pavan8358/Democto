# Assessment Portal

Passwordless email authentication with NextAuth, Prisma, and role-based access for administrators, proctors, and candidates.

## Tech stack

- [Next.js 14](https://nextjs.org/)
- [NextAuth.js](https://next-auth.js.org/)
- [Prisma](https://www.prisma.io/)
- Nodemailer SMTP email delivery
- SQLite (default) or any Prisma-supported database

## Getting started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables by creating an `.env` file.

   ```env
   DATABASE_URL="file:./dev.db"
   NEXTAUTH_SECRET="generate-a-random-string"
   NEXTAUTH_URL="http://localhost:3000"

   EMAIL_FROM="noreply@example.com"
   EMAIL_SERVER_HOST="localhost"
   EMAIL_SERVER_PORT="1025"
   # Optional if your SMTP server requires credentials
   # EMAIL_SERVER_USER=""
   # EMAIL_SERVER_PASSWORD=""

   SEED_ADMIN_EMAIL="admin@example.com"
   SEED_PROCTOR_EMAIL="proctor@example.com" # optional

   AWS_ACCESS_KEY_ID="development-access-key"
   AWS_SECRET_ACCESS_KEY="development-secret-key"
   # AWS_SESSION_TOKEN="" # optional for temporary credentials
   S3_BUCKET_NAME="local-preflight-uploads"
   S3_BUCKET_REGION="us-east-1"
   # Optional overrides for local object storage such as MinIO
   # S3_ENDPOINT="http://127.0.0.1:9000"
   # S3_SIGNED_URL_TTL="300"

   CONSENT_POLICY_VERSION="1.0"
   ```

   - Mailhog (default port `1025`) and Mailtrap are supported. When the SMTP server does not require authentication, omit `EMAIL_SERVER_USER` and `EMAIL_SERVER_PASSWORD`.
   - The S3 values above default to development-friendly settings. Provide production credentials and buckets when deploying the identity capture workflow.
3. Apply the Prisma schema and generate the client:
   ```bash
   npm run db:push
   npm run prisma:generate
   ```
4. Seed the database:
   ```bash
   npm run db:seed
   ```
   - The seed script upserts the admin and optional proctor users based on the `SEED_ADMIN_EMAIL` and `SEED_PROCTOR_EMAIL` variables. Update these values to onboard new privileged users.
5. Start the development server:
   ```bash
   npm run dev
   ```
6. Visit [`http://localhost:3000/sign-in`](http://localhost:3000/sign-in) and request a magic link. In development the link is logged to the terminal.

## Role-based access

- `/admin` is restricted to users with the `ADMIN` role.
- `/proctor` allows `ADMIN` and `PROCTOR` roles.
- All other routes are accessible to any authenticated user.

Unauthorized requests are redirected to `/unauthorized`. Unauthenticated users are redirected to `/sign-in` with a callback URL.

## Candidate preflight flow

- `/exam/[examSlug]/start?token=...` opens the candidate preflight checklist. The link validates the shared access token, creates a pending `ExamSession`, stores demographic details, and walks the candidate through device checks, consent, and optional ID capture.
- When all required steps pass, the session transitions to `READY` and the candidate is redirected to `/exam/[examSlug]/monitor` to await the live exam start.

## Related documentation

- [`docs/auth-flow.md`](docs/auth-flow.md) — manual walkthrough of the email authentication flow.
