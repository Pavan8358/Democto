# QA & Acceptance Checklists

## Table of contents
- [How to use this document](#how-to-use-this-document)
- [Release acceptance criteria](#release-acceptance-criteria)
- [Manual QA scenarios](#manual-qa-scenarios)
  - [Candidate journey](#candidate-journey)
  - [Proctor workflow](#proctor-workflow)
  - [Detection & retention](#detection--retention)
  - [Privacy & compliance](#privacy--compliance)
- [Sign-off log](#sign-off-log)

## How to use this document
- Clone this template into the release ticket or feature PR description.
- Check off each item during validation; attach evidence (screenshots, logs, URLs) where noted.
- Update regression suites when new edge cases are discovered.
- Keep a rolling history in the [Sign-off log](#sign-off-log).

## Release acceptance criteria
- [ ] Local environment bootstrap completed using the steps in the [README](../README.md#local-setup).
- [ ] Database migrations applied and verified in PostgreSQL.
- [ ] Relevant runbook(s) and handbook sections reviewed and updated.
- [ ] Automated test suite (`pnpm test`) passed or failures triaged with owners.
- [ ] Manual QA scenarios below executed with results recorded.
- [ ] Privacy considerations reviewed; DSAR paths unaffected or documented.
- [ ] Observability alerts monitored for 1 hour post-deploy; anomalies addressed.

## Manual QA scenarios

### Candidate journey
- [ ] Registration form validates required fields and consent checkbox blocks submission when unchecked.
- [ ] Identity verification captures and stores photo ID in the correct regional bucket.
- [ ] Client successfully establishes recording session; health indicator remains green for 5+ minutes.
- [ ] Candidate submission gracefully handles network blips (simulate by toggling offline mode).

### Proctor workflow
- [ ] Live monitor displays new candidates within 30 seconds of session start.
- [ ] High-severity flag triggers audible + visual alerts.
- [ ] Proctor can annotate playback, save notes, and change flag status.
- [ ] Escalation reassigns the case to a lead proctor and sends Slack notification.

### Detection & retention
- [ ] Detector workers pick up new segments within 10 seconds (check queue depth dashboard).
- [ ] Retention job removes expired recordings and updates metadata.
- [ ] Manual override (`pnpm retention:dry-run --user-id <id>`) generates expected report without side effects.
- [ ] Export bundle generated via `pnpm dsar:export` contains profile, consent, and recordings snapshots.

### Privacy & compliance
- [ ] Consent log entries created for new candidates with correct policy version.
- [ ] DSAR deletion flows remove user data and revoke tokens.
- [ ] Audit log entries appear when proctors access playback.
- [ ] Regional routing ensures EU candidates remain in EU infrastructure (verify via headers or logs).

## Sign-off log
| Date | Release / Ticket | Owner | Notes |
| --- | --- | --- | --- |
| YYYY-MM-DD | release-x.y.z | Jane Doe | _Passed: attach link to supporting evidence_ |
| YYYY-MM-DD | | | |
