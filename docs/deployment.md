# Deployment guide

This document describes how to provision and operate the Exam Proctoring MVP in staging and production. It covers infrastructure components (Vercel, PostgreSQL, AWS S3), required secrets, CI/CD alignment, validation steps, and rollback procedures.

## Architecture overview

The application runs as a server-rendered Next.js 16 project hosted on Vercel. Runtime dependencies:

- **PostgreSQL (Neon or Railway):** primary data store managed via Prisma migrations.
- **AWS S3:** durable storage for candidate media uploads (webcam, screen, audio chunks) and derived artefacts.
- **SMTP provider:** transactional email for passwordless logins and notifications.
- **Vercel build pipeline:** installs dependencies with `pnpm install --frozen-lockfile` and builds via `pnpm build` before serving traffic.

```
client → Vercel Edge → Next.js API Routes ─┬─> PostgreSQL (Neon/Railway)
                                          └─> AWS S3 (signed uploads + retrieval)
```

## Environment matrix

| Environment | Deploy trigger | Base URL (example) | Database branch | S3 bucket (example) | Notes |
|-------------|----------------|--------------------|-----------------|---------------------|-------|
| Staging     | Vercel preview deployment from `main` (or `staging`) | `https://proctoring-mvp-staging.vercel.app` | Neon branch `staging` | `proctoring-mvp-recordings-staging` | Used for QA smoke tests and benchmark uploads. |
| Production  | Vercel production deployment from `main` | `https://app.proctoring.example.com` | Neon branch `production` | `proctoring-mvp-recordings-prod` | Customer-facing workload and retention enforcement. |

> **Tip:** Adjust the base URLs, database branch names, and bucket identifiers to match the actual resources that are provisioned. Update this table once concrete values are known.

## 1. Provision PostgreSQL (Neon or Railway)

_Prerequisite: ensure the Prisma schema and migrations exist under the `prisma/` directory before running the commands below._

1. Create a new project (e.g. `proctoring-mvp`) in Neon or Railway.
2. Create two database branches:
   - `staging` (default branch for preview/staging deployments)
   - `production`
3. Generate connection strings for each branch with SSL enforced (`?sslmode=require`).
4. Create an application role (e.g. `app_user`) with least privilege access; store credentials securely.
5. Configure connection pooling (pipelining helps with serverless workloads on Vercel).
6. After provisioning, apply the schema using Prisma:

   ```bash
   # Uses the DATABASE_URL from the current shell
   pnpm prisma migrate deploy
   pnpm prisma generate
   ```

   If you need to seed local data:

   ```bash
   pnpm tsx prisma/seed.ts
   ```

7. Record the resulting `DATABASE_URL` values in your secrets manager (1Password, Vault, Doppler, etc.) and in Vercel Environment Variables (see below).

## 2. AWS S3 bucket & IAM configuration

1. Create two buckets (example names below) in the same AWS region that provides low latency for your users:

   - `proctoring-mvp-recordings-staging`
   - `proctoring-mvp-recordings-prod`

   Enable versioning if you need extra safety, and block all public access.

2. (Optional but recommended) add a lifecycle rule to auto-expire chunks older than your retention window to reduce storage costs.

3. Configure bucket-level **CORS** to allow the web application to upload browser chunks directly:

   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["GET", "PUT", "POST"],
       "AllowedOrigins": [
         "https://proctoring-mvp-staging.vercel.app",
         "https://app.proctoring.example.com"
       ],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3000
     }
   ]
   ```

   Mirror the origins with the values you place in `S3_UPLOAD_ALLOWED_ORIGINS`.

4. Create a dedicated IAM user (e.g. `proctoring-mvp-uploader`) with programmatic access only. Attach a policy scoped to the bucket:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "AllowBucketAccess",
         "Effect": "Allow",
         "Action": [
           "s3:PutObject",
           "s3:PutObjectAcl",
           "s3:GetObject",
           "s3:ListBucket",
           "s3:AbortMultipartUpload"
         ],
         "Resource": [
           "arn:aws:s3:::proctoring-mvp-recordings-staging",
           "arn:aws:s3:::proctoring-mvp-recordings-staging/*"
         ]
       }
     ]
   }
   ```

   Create a second policy for the production bucket. Store the generated `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` securely. Rotate keys on a regular cadence.

5. Share the bucket name, region, and access keys with the application via environment variables.

## 3. Vercel project configuration

1. Create (or reuse) the Vercel project `proctoring-mvp` and connect it to this GitHub repository.
2. In the **Build & Development Settings**, set:
   - Install Command: `pnpm install --frozen-lockfile`
   - Build Command: `pnpm build`
   - Output Directory: leave blank (Next.js handles this automatically)
3. Configure automatic deployments:
   - Production: deploy from `main`
   - Preview/Staging: deploy from pull requests or a dedicated `staging` branch
4. Define the environment variables listed below (duplicate for **Preview** and **Production** scopes):

| Key | Description | Example |
|-----|-------------|---------|
| `NEXT_PUBLIC_APP_URL` | Base URL for the environment (used in links, callbacks). | `https://proctoring-mvp-staging.vercel.app` |
| `DATABASE_URL` | Postgres connection string (include `?sslmode=require`). | `postgresql://app_user:...@ep-staging.us-east-1.aws.neon.tech/neondb?sslmode=require` |
| `NEXTAUTH_SECRET` | 32+ byte secret for NextAuth JWT encryption. Generate with `openssl rand -base64 32`. | _(secret)_ |
| `NEXTAUTH_URL` | Absolute URL to NextAuth callbacks. | `https://proctoring-mvp-staging.vercel.app/api/auth` |
| `EMAIL_FROM` | Default "from" address for transactional mail. | `proctoring@example.com` |
| `SMTP_HOST` | SMTP server hostname. | `smtp.resend.com` |
| `SMTP_PORT` | SMTP port (usually 587). | `587` |
| `SMTP_USER` | SMTP username or API key. | `resendapikey` |
| `SMTP_PASSWORD` | SMTP password / secret. | _(secret)_ |
| `AWS_ACCESS_KEY_ID` | IAM user access key for uploads. | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key. | _(secret)_ |
| `AWS_REGION` | AWS region hosting the bucket. | `us-east-1` |
| `AWS_S3_BUCKET` | Bucket name for the environment. | `proctoring-mvp-recordings-staging` |
| `S3_UPLOAD_ALLOWED_ORIGINS` | Comma-separated list of origins allowed to request signed URLs. | `https://proctoring-mvp-staging.vercel.app,https://app.proctoring.example.com` |
| `RETENTION_DAYS_RECORDINGS` | Days to keep uploaded recordings before archival/deletion. | `30` |
| `RETENTION_DAYS_FLAGS` | Days to keep flag/event metadata. | `90` |
| `GIT_SHA` | (Set by CI) commit SHA deployed. | `${GITHUB_SHA}` |
| `BUILD_TIMESTAMP` | (Set by CI) ISO timestamp of the build. | `2025-11-02T18:30:00Z` |

5. Use `vercel env pull` to sync local development env files when needed.

## 4. Secrets management

- Store canonical secrets in a shared vault (1Password, Doppler, HashiCorp Vault). Treat Vercel as a deployment target—not the single source of truth.
- Record the rotation history for IAM keys, SMTP credentials, and database passwords.
- When rotating secrets, update the vault first, then Vercel, and finally redeploy.

## 5. CI/CD alignment

- GitHub Actions (`.github/workflows/ci.yml`) already runs lint, type-check, and build on every PR and on pushes to `main`.
- Before promoting a build to production, ensure the staging deployment passes the smoke tests below.
- To automate migrations during deploy, add a protected workflow or Vercel deploy hook that runs:

  ```bash
  pnpm prisma migrate deploy
  pnpm prisma generate
  ```

  against the appropriate database branch.

- Inject `GIT_SHA` and `BUILD_TIMESTAMP` during CI to surface build metadata in the `/api/health` endpoint:

  ```yaml
  - name: Export build metadata
    run: |
      echo "GIT_SHA=${GITHUB_SHA}" >> $GITHUB_ENV
      echo "BUILD_TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> $GITHUB_ENV
  ```

## 6. Scheduled retention jobs

- **S3 lifecycle rules**: configure expiration in the bucket to match `RETENTION_DAYS_RECORDINGS` as the first line of defence.
- **Application-level cleanup** (optional): once the API includes a retention endpoint, create a Vercel Cron job (daily at 02:00 UTC) pointing to `/api/retention/cleanup` to prune database rows and orphaned S3 keys.
- Ensure the cron job uses a tokenized URL or internal auth guard to prevent abuse.

## 7. Deployment validation (smoke tests)

Run the following after each staging or production deploy:

1. **Health check** – `GET https://<environment>/api/health` should return HTTP 200 with the current `version`, `environment`, and build metadata.
2. **Authentication flow** – Request a magic link/passwordless sign-in, ensure email is delivered, and session persists across refreshes.
3. **Admin dashboard** – Create a new exam and confirm it appears in the list view and persists after refresh (validates DB write/read).
4. **Candidate onboarding** – Walk through the pre-flight checks, start an exam session, and validate that session state updates.
5. **Media upload** – Upload a short-test recording; confirm the upload succeeds, is visible in S3, and the UI reflects completion.
6. **Flagging pipeline** – Trigger a compliance flag (manual or automated) and check visibility in the review queue.

Document the results in the release checklist before promoting to production.

## 8. Rollback & recovery

- **Vercel**: open the Deployments tab, select a previously healthy build, and promote it to production. Record the rollback in the changelog.
- **Database**: if a migration fails, run `pnpm prisma migrate resolve --applied <migration_name>` to mark it and redeploy, or restore from a Neon/Railway snapshot. Follow up with a hotfix migration if data needs to be repaired.
- **S3 uploads**: disable offending access keys in IAM if uploads must be paused. Re-enable or rotate after remediation.
- **Secrets**: if credentials leak, rotate them immediately, update Vercel/vault, and redeploy.

## 9. Useful commands

```bash
# Generate a NextAuth secret
openssl rand -base64 32

# Run database migrations (staging / production)
DATABASE_URL="postgresql://..." pnpm prisma migrate deploy

# Generate Prisma client after schema changes
pnpm prisma generate

# (Optional) Inspect database via Prisma Studio
pnpm prisma studio
```

## 10. Runbook ownership

- **Primary**: Platform/Infra team (deployment automation, environment health)
- **Secondary**: Backend team (Prisma schema evolution, retention job)
- **Audit cadence**: Review this document quarterly or after major infrastructure changes.

Keep this guide updated as new services (e.g. Redis, WebRTC signalling) are introduced.
