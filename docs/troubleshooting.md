# Troubleshooting Playbook

## Table of contents
- [Permissions & access](#permissions--access)
  - [Database migrations](#database-migrations)
  - [API authentication](#api-authentication)
- [Email delivery issues](#email-delivery-issues)
- [S3 & storage problems](#s3--storage-problems)
- [Worker & detection anomalies](#worker--detection-anomalies)
- [Support escalation paths](#support-escalation-paths)

## Permissions & access

### Database migrations
**Symptoms:** `permission denied for table`, migration script exits with `SQLSTATE 42501`, Prisma fails to connect.

**Fix:**
1. Confirm connection string uses the migration role (`author_migrator`).
2. Re-run migrations with elevated role:
   ```bash
   DATABASE_URL=postgresql://author_migrator:<password>@localhost:5432/author pnpm migrate:deploy
   ```
3. If using Docker, exec into the API container and verify `.env` values are mounted.
4. Check Postgres roles:
   ```sql
   \du
   select grantee, privilege_type from information_schema.role_table_grants where table_name = 'migrations';
   ```
5. If grants are missing, apply the SQL from `infrastructure/postgres/grants.sql` and rerun the migration.

### API authentication
**Symptoms:** Local dev requests return `401 Unauthorized` or `Invalid session token`.

**Fix:**
1. Ensure `JWT_SECRET` matches across API and web apps.
2. Clear cookies or run `pnpm session:reset` to invalidate stale tokens.
3. Verify Redis is running; session lookups rely on `REDIS_URL`.

## Email delivery issues
**Symptoms:** No verification emails, high bounce rates, `Connection refused` from SMTP.

**Fix:**
1. Run the health check:
   ```bash
   pnpm notify:check
   ```
2. Validate SMTP credentials in `.env` and confirm they match the provider dashboard.
3. Check the provider status page; outages are common root causes.
4. Use the sandbox mode by setting `SMTP_HOST=mailhog` and `SMTP_PORT=1025` to test locally.
5. Inspect Postmark/Mailgun logs for suppression or spam-blocking events and remediate.

## S3 & storage problems
**Symptoms:** Recording uploads stalled, `AccessDenied`, retention job failures.

**Fix:**
1. Verify AWS credentials with `aws sts get-caller-identity`.
2. Confirm bucket policies allow the IAM principal (`arn:aws:iam::<account>:role/author-app`).
3. Check multipart upload limits; abort in-progress upload IDs with `scripts/storage/abort_multipart.py`.
4. Ensure LocalStack is running locally (`docker compose ps localstack`). Restart if endpoints return 500s.
5. Review CloudWatch metrics for `4xxErrors` spikes; if present, rotate access keys and reapply bucket ACLs.

## Worker & detection anomalies
**Symptoms:** Flag backlog, processing lag, sudden drop in detection rates.

**Fix:**
1. Inspect worker logs: `docker compose logs -f worker`.
2. Confirm `DETECTOR_MODEL_VERSION` matches the deployed bundle and that S3 contains the referenced artifact.
3. Measure queue depth with `pnpm worker:queue:stats`; anything > 1,000 requires scaling or backpressure.
4. If model performance regressed, roll back using `pnpm worker:model:set --version <previous>` and redeploy.

## Support escalation paths
- **Tier 1:** On-call engineer (Slack `@on-call-author`).
- **Tier 2:** Platform team lead, reachable via PagerDuty escalation.
- **Tier 3:** Security & Privacy for data incidents (`security@author.com`).
- **Vendors:** AWS Support (Business plan), Mailgun, Twilio. Reference vendor account IDs in the internal wiki.
