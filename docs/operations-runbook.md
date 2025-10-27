# Operations Runbooks

## Table of contents
- [On-call expectations](#on-call-expectations)
- [Retention job maintenance](#retention-job-maintenance)
  - [Pre-flight checklist](#pre-flight-checklist)
  - [Manual execution](#manual-execution)
  - [Validating outcomes](#validating-outcomes)
- [Incident response procedure](#incident-response-procedure)
  - [Triage workflow](#triage-workflow)
  - [Communication guidelines](#communication-guidelines)
  - [Containment and recovery](#containment-and-recovery)
  - [Post-incident review](#post-incident-review)
- [S3 maintenance](#s3-maintenance)
  - [Bucket hygiene](#bucket-hygiene)
  - [Storage class lifecycle](#storage-class-lifecycle)
  - [Restoring archived assets](#restoring-archived-assets)
- [Useful dashboards & alerts](#useful-dashboards--alerts)

## On-call expectations
- On-call rotations are weekly; the primary responder must keep PagerDuty reachable and monitor the `#author-incidents` Slack channel.
- Acknowledge alerts within **5 minutes** and update incident timelines every **15 minutes** until resolution.
- Escalate to the incident commander (IC) if you cannot mitigate within **30 minutes** or if customer impact exceeds the SLA.
- Log all manual actions in the incident document located in Notion → _Operational Incidents_.

## Retention job maintenance
The retention job enforces contractual data deletion. It runs hourly in production and nightly in staging.

### Pre-flight checklist
1. Confirm there are no outstanding legal hold requests (Notion → _Legal Holds_).
2. Verify the job configuration in `jobs/retention/.env` has the correct `RETENTION_WINDOW_DAYS` per environment.
3. Validate IAM permissions for the retention role (`author-retention-role`) allow `s3:DeleteObject` and `glacier:DeleteArchive`.

### Manual execution
Run the job manually when backlog thresholds exceed **10k** stale objects or after configuration changes.

```bash
docker compose run --rm retention pnpm start
```

If running outside Docker:

```bash
cd jobs/retention
pnpm install --frozen-lockfile
RETENTION_WINDOW_DAYS=45 pnpm start
```

### Validating outcomes
1. Check the structured logs in CloudWatch (`/author/retention`). Ensure the run reports `deleted_count` > 0 with expected numbers.
2. Query PostgreSQL for dangling metadata:
   ```sql
   select count(*) from recordings where deleted_at is null and expires_at < now();
   ```
   The result should trend to zero after the job completes.
3. Review S3 metrics in the "Author Storage" dashboard. Spikes in 4xx/5xx errors require immediate follow-up.

## Incident response procedure

### Triage workflow
1. **Acknowledge alert** via PagerDuty.
2. **Identify scope** using the Datadog dashboards listed below.
3. **Stabilize** by failing over (e.g., toggle traffic to the warm replica, drain the queue, or throttle ingestion) as appropriate.
4. **Document** each step in the incident Slack thread and Notion doc.

### Communication guidelines
- IC posts public updates in `#author-status` every 15 minutes.
- Customer success is notified via email when exams in progress are affected.
- All external updates require approval from the IC or the engineering manager on-call.

### Containment and recovery
- Queue saturation: scale workers (`pnpm worker:scale --replicas 6`) and enable backpressure via the ingestion gateway toggle.
- Database connectivity: fail over using `aws rds failover-db-cluster --db-cluster-identifier author-prod`.
- Detector model regressions: pin previous model version by setting `DETECTOR_MODEL_VERSION` in SSM Parameter Store and redeploy workers.

### Post-incident review
- Schedule the post-mortem within 48 hours.
- Include root cause, contributing factors, actions taken, and follow-up tasks with owners.
- Update relevant documentation (runbooks, architecture doc) if gaps were discovered.

## S3 maintenance

### Bucket hygiene
- Run `scripts/storage/list_orphans.py` weekly to detect objects without metadata references.
- Empty the `author-temporary-uploads` bucket every 24 hours via the scheduled cleanup Lambda; trigger it manually if backlog > 1 GB.

### Storage class lifecycle
- Verify lifecycle rules quarterly:
  - `author-recordings-*`: Standard → Standard-IA after 7 days → Glacier Deep Archive after 30 days → Delete on retention expiry.
  - `author-exports-*`: Standard → Expire after 14 days.
- Use the AWS Console to confirm transition counts and failure metrics.

### Restoring archived assets
1. Locate the archived object key from PostgreSQL (`recordings.archive_key`).
2. Restore using:
   ```bash
   aws s3api restore-object --bucket author-recordings-prod --key <object-key> --restore-request Days=5,Tier=Standard
   ```
3. Monitor the restore status in the AWS Console; notify the requestor once the object is available.

## Useful dashboards & alerts
- **Datadog → Author / Platform Overview**: ingestion latency, API error rates, worker throughput.
- **Datadog → Author / Storage**: S3 4xx/5xx, lifecycle transitions, bucket inventory age.
- **Grafana → Author / Queue Depth**: Redis stream lag per shard with alert thresholds.
- **PagerDuty Services**: `author-api`, `author-detector`, `author-retention`. Ensure on-call schedules include backup engineers.
