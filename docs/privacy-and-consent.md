# Privacy & Consent Notes

## Table of contents
- [Principles](#principles)
- [Consent capture lifecycle](#consent-capture-lifecycle)
- [Data inventory](#data-inventory)
- [GDPR data subject requests](#gdpr-data-subject-requests)
  - [Verification](#verification)
  - [Export procedure](#export-procedure)
  - [Deletion procedure](#deletion-procedure)
- [Regional residency](#regional-residency)
- [Audit & logging](#audit--logging)
- [Retention policy](#retention-policy)
- [Frequently referenced documents](#frequently-referenced-documents)

## Principles
- Collect only signals required to ensure exam integrity (screen, webcam, audio, system telemetry).
- Provide clear notice and consent prompts before any capture begins.
- Respect jurisdiction-specific rules (GDPR, FERPA, LGPD) and institutional agreements.
- Maintain data minimization by enforcing retention windows and anonymizing analytics data.

## Consent capture lifecycle
1. Candidate is routed to the consent screen prior to exam entry.
2. The API records the consent response (`consents` table) with timestamp, locale, and policy version.
3. Consent acceptance issues a short-lived capture token; rejection denies access and alerts the proctor channel.
4. Consent revocation triggers automatic session termination and the retention workflow for collected data.

## Data inventory
| Data type | Purpose | Storage | Retention |
| --- | --- | --- | --- |
| Webcam & screen recordings | Review, investigations | S3 `author-recordings-*` | Configurable (default 180 days) |
| Audio transcripts | Searchable review, analytics | PostgreSQL `transcripts`, OpenSearch | 90 days |
| Candidate profile | Authentication, contact | PostgreSQL `users` | Duration of relationship |
| Detector scores | Automated risk assessment | PostgreSQL `flags`, Redis cache | 180 days |
| System logs | Audit, security | CloudWatch, S3 logs | 365 days |

## GDPR data subject requests
All DSARs must be acknowledged within **72 hours** and fulfilled within **30 days**. Track status in the Trust & Safety board.

### Verification
1. Confirm the identity of the requester (match verified email/phone on file).
2. Validate institutional approval if the request comes through a university contact.
3. Document the request in the DSAR register (Notion template) before proceeding.

### Export procedure
1. Create a secure working directory:
   ```bash
   mkdir -p tmp/dsar/<user-id>
   export DSAR_DIR=$(pwd)/tmp/dsar/<user-id>
   ```
2. Generate structured data (JSON + CSV):
   ```bash
   pnpm dsar:export --user-id <user-id> --output "$DSAR_DIR"
   ```
   The command fetches profile data, exam participation, consent records, and detector flags.
3. Collect recordings:
   ```bash
   aws s3 sync s3://author-recordings-prod/<user-id>/ "$DSAR_DIR/recordings" --expires 7
   ```
4. Bundle and encrypt:
   ```bash
   tar -czf "$DSAR_DIR.tar.gz" -C tmp/dsar <user-id>
   gpg --recipient privacy-team@author.com --encrypt "$DSAR_DIR.tar.gz"
   ```
5. Upload the encrypted bundle to the `author-exports-prod` bucket and generate a pre-signed URL valid for 7 days.
6. Share the link securely with the requester and note delivery in the DSAR register.

### Deletion procedure
1. Verify there are no legal holds or active investigations for the candidate.
2. Run the deletion command:
   ```bash
   pnpm dsar:delete --user-id <user-id>
   ```
   This performs a soft delete and queues background jobs to purge S3 assets.
3. Confirm PostgreSQL cleanup:
   ```sql
   select * from deletions where user_id = '<user-id>' order by created_at desc limit 1;
   ```
   Ensure `status = 'completed'`.
4. Trigger retention backfill to ensure recordings are removed:
   ```bash
docker compose run --rm retention pnpm start -- --force-user <user-id>
   ```
5. Issue a confirmation email using the DSAR closure template and record completion.

## Regional residency
- EU candidates default to the `eu-central-1` stack; APAC to `ap-southeast-2`; Americas to `us-east-1`.
- Cross-region replication is disabled for raw recordings. Aggregated analytics replicate only anonymized data.
- Regional S3 buckets have separate IAM policies. Do not mix credentials across environments.

## Audit & logging
- Consent events feed into the `audit_log` table with immutable append-only entries.
- All DSAR actions trigger audit log events tagged with the request ID.
- Proctor actions (flag updates, playback access) are recorded and available for compliance reviews.

## Retention policy
- Default contractual retention: **180 days** for recordings, **365 days** for audit logs, **90 days** for transcripts.
- Institutions may request custom retention; update `retention_policies` table and confirm with Legal.
- Automatic deletion scripts respect legal hold flags (`legal_holds` table). Remove holds only with written approval.

## Frequently referenced documents
- [Operations Runbooks](operations-runbook.md)
- [Architecture & Data Flow](architecture.md)
- Privacy policy (Notion → _Legal / Privacy Policy_)
- Data Processing Agreement templates (Google Drive → _Legal/DPAs_)
