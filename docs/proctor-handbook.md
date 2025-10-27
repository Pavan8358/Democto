# Proctor Handbook

## Table of contents
- [Access & roles](#access--roles)
- [Dashboard tour](#dashboard-tour)
  - [Live monitor](#live-monitor)
  - [Flag queue](#flag-queue)
  - [Session playback](#session-playback)
- [Flag interpretation](#flag-interpretation)
  - [Low severity](#low-severity)
  - [Medium severity](#medium-severity)
  - [High severity](#high-severity)
- [Escalation workflow](#escalation-workflow)
- [Communication templates](#communication-templates)
- [Daily opening & closing tasks](#daily-opening--closing-tasks)
- [Quality expectations](#quality-expectations)

## Access & roles
- Proctor accounts are created by administrators via **Admin Portal → Team → Invite proctor**.
- MFA is mandatory; enroll via email link on first login.
- Roles:
  - **Proctor** – full access to live monitor and flag queue.
  - **Lead proctor** – can escalate to institutions and override flags.
  - **Observer** – read-only access for audit or training purposes.

## Dashboard tour

### Live monitor
- Shows active sessions with latency, bandwidth, and consent status.
- Status pills: `On Track`, `Requires Attention`, `Disconnected`, `Awaiting Candidate`.
- Hover over a candidate to view live thumbnails and recent flags.
- Use filters to segment by exam, location, or proctor team.

### Flag queue
- Displays unresolved flags sorted by severity and submission time.
- `My Queue` shows items assigned to you; `Team Queue` includes unassigned work.
- Bulk assign up to 10 items for batching. Ensure queue is < 30 unresolved before breaks.

### Session playback
- The **Playback** tab combines synchronized webcam, screen, and audio tracks.
- Playback controls include 2× speed, frame-by-frame navigation, and annotation markers.
- Press `M` to drop a marker at the current timestamp; markers appear in the shared case timeline.

## Flag interpretation

### Low severity
- Examples: candidate briefly looks away, background noise, minor lighting changes.
- Action: monitor and document with a neutral note. No escalation required.

### Medium severity
- Examples: second face appears briefly, candidate leaves desk for < 2 minutes, unapproved materials visible.
- Action: contact candidate using the in-app chat, remind of policy, and note the interaction. Continue monitoring.

### High severity
- Examples: persistent second face, device or network tampering, confirmed use of forbidden resources.
- Action: pause the exam if policy allows, capture detailed notes, and escalate to the lead proctor immediately.

## Escalation workflow
1. Add a summary note with timestamp, observed behavior, and policy reference.
2. Change flag status to `Pending Lead Review` and assign to the lead proctor on duty.
3. If immediate intervention is required, call the exam coordinator using the contact list provided in the daily briefing.
4. Leads will determine if the case is reported to the institution or resolved with a warning.

## Communication templates
- **Initial outreach:**
  > "Hi {{candidate_name}}, we noticed something on your feed. Please confirm you're alone and remove any unauthorized materials."

- **Warning notice:**
  > "This is a final warning. Continued violation will end the session and may trigger an academic review."

- **Session termination:**
  > "We are ending this session due to repeated policy violations. Your institution will follow up with next steps."

Store customized templates in the dashboard under **Settings → Message Templates** for reuse.

## Daily opening & closing tasks
- **Opening**
  1. Join stand-up and review exam schedule in the proctor calendar.
  2. Check `#author-ops` for overnight incidents or outstanding guidance.
  3. Verify audio/video equipment, sign into the dashboard, and open the live monitor.
  4. Review the "High Risk" list for candidates requiring heightened attention.

- **Closing**
  1. Clear personal queue items and reassign anything unresolved to the lead proctor.
  2. Submit daily summary in `#author-ops`, highlighting escalations and noteworthy observations.
  3. Log out of all systems and lock workstations per security policy.

## Quality expectations
- Response to new high-severity flags within **2 minutes**.
- Detailed, neutral-language notes with timestamps and policy references.
- Use the manual QA checklist for proctor flows (see [QA & Acceptance Checklists](qa-checklists.md)) during training and periodic audits.
- Participate in weekly calibration sessions to align on flag interpretation and tone.
