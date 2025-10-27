# Author — Remote Assessment Proctoring Platform

> A full-stack platform for secure remote assessments that captures candidate activity, detects high-risk behaviors in real time, and equips proctors and administrators with actionable insights.

## Table of contents
- [Project overview](#project-overview)
- [Architecture](#architecture)
  - [High-level diagram](#high-level-diagram)
- [Prerequisites](#prerequisites)
- [Local setup](#local-setup)
  - [1. Clone the repository](#1-clone-the-repository)
  - [2. Bootstrap dependencies](#2-bootstrap-dependencies)
  - [3. Configure environment variables](#3-configure-environment-variables)
  - [4. Start local services](#4-start-local-services)
  - [5. Run database migrations](#5-run-database-migrations)
  - [6. Seed sample data (optional)](#6-seed-sample-data-optional)
- [Environment variables](#environment-variables)
- [Common scripts](#common-scripts)
- [Deployment workflow](#deployment-workflow)
- [Documentation hub](#documentation-hub)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)
- [Manual QA checklist](#manual-qa-checklist)
- [Acceptance criteria verification](#acceptance-criteria-verification)

## Project overview
Author delivers end-to-end remote proctoring for high-stakes assessments. The system records screen, webcam, and audio streams, processes them through automated detection services, and exposes findings through a real-time dashboard. Key capabilities include:

- Multi-signal recording pipeline with regional data residency controls.
- Machine-learning powered detection of suspicious behaviors (multiface, device switches, forbidden resources).
- Case management workflows for proctors, including annotations and escalations.
- Automated retention, consent tracking, and GDPR-compliant data export/delete tooling.

## Architecture
The platform is composed of a TypeScript/React proctor dashboard, a Node.js/NestJS API, Python-based detection workers, and scheduled maintenance jobs. AWS S3 stores the raw recordings and derived artifacts, while PostgreSQL and Redis manage transactional state and queues. Read the [Architecture & Data Flow](docs/architecture.md) document for a deeper dive into each component and integration.

### High-level diagram
```mermaid
flowchart LR
    subgraph Candidate Device
        R[Screen & Webcam Recorder]
    end

    subgraph Cloud Ingestion
        G[Ingestion Gateway]
        Q((Redis Streams))
    end

    subgraph Processing
        D[Detection Workers]
        A[API Service]
        DB[(PostgreSQL)]
    end

    subgraph Storage
        S3[(S3 Recordings Bucket)]
        AR[(Analytics & Reports)]
    end

    subgraph Proctor Tools
        UI[Proctor Dashboard]
        Notif[Notifications]
    end

    R -->|TLS| G --> Q --> D
    D --> S3
    D -->|Flags & Scores| A
    A --> DB
    A --> AR
    UI -->|GraphQL| A
    A --> Notif
```

## Prerequisites
Make sure the following dependencies are installed before beginning local development:

- **Node.js 20.x** (via [nvm](https://github.com/nvm-sh/nvm) or your preferred installer)
- **pnpm 9.x** (`npm install -g pnpm`)
- **Python 3.11** with `pip`
- **Docker** and **Docker Compose** for running backing services
- **PostgreSQL 15** (optional locally if you prefer a native install over Docker)
- **Redis 7** (optional locally if you prefer a native install)
- **AWS CLI v2** with credentials for development S3 buckets

## Local setup
Follow the steps below to get the application running locally. A new developer should be able to complete the process, including migrations, in under 30 minutes.

### 1. Clone the repository
```bash
git clone git@github.com:your-org/author.git
cd author
```

### 2. Bootstrap dependencies
Install JavaScript dependencies and set up the Python virtual environment used by detection workers.

```bash
pnpm install
python -m venv .venv
source .venv/bin/activate
pip install -r services/detector/requirements.txt
```

### 3. Configure environment variables
Copy the example environment file and fill in the required values. See the [Environment variables](#environment-variables) section for descriptions.

```bash
cp .env.example .env
```

Populate secrets using your password manager. At a minimum, set database URLs, AWS credentials, and SMTP details.

### 4. Start local services
Use Docker Compose to launch PostgreSQL, Redis, and LocalStack-backed S3 buckets. The same command also starts the API and web applications in watch mode.

```bash
docker compose up api web worker db redis localstack
```

> **Tip:** If you run services separately, ensure the API has network access to Redis and PostgreSQL hosts defined in `.env`.

### 5. Run database migrations
Once services are up, execute the Prisma/NestJS migrations. This command is idempotent and safe to run after merges.

```bash
pnpm migrate:deploy
```

You can verify connectivity by opening the database inspector (`pnpm prisma studio`) or hitting `http://localhost:3000/healthz`.

### 6. Seed sample data (optional)
Seed fixture exams, candidates, and proctor accounts to explore the dashboard.

```bash
pnpm seed:demo
```

Log in with the generated proctor credentials displayed in the seed output.

## Environment variables
| Variable | Description | Required | Default |
| --- | --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string used by the API | ✅ | `postgresql://postgres:postgres@localhost:5432/author` |
| `REDIS_URL` | Redis URL for queues and caching | ✅ | `redis://localhost:6379/0` |
| `JWT_SECRET` | Secret key for signing session tokens | ✅ | _none_ |
| `AWS_ACCESS_KEY_ID` | IAM access key for S3 buckets | ✅ | _none_ |
| `AWS_SECRET_ACCESS_KEY` | IAM secret for S3 buckets | ✅ | _none_ |
| `AWS_REGION` | Region for S3 + KMS usage | ✅ | `us-east-1` |
| `S3_RECORDINGS_BUCKET` | Raw and processed recording storage | ✅ | `author-recordings-dev` |
| `S3_EXPORT_BUCKET` | Bucket for GDPR exports and report bundles | ✅ | `author-exports-dev` |
| `SMTP_HOST` | Outbound email host for notifications | ✅ | _none_ |
| `SMTP_PORT` | Outbound email port | ✅ | `587` |
| `SMTP_USERNAME` | SMTP username | ✅ | _none_ |
| `SMTP_PASSWORD` | SMTP password or app-specific token | ✅ | _none_ |
| `SLACK_WEBHOOK_URL` | Incoming webhook for incident alerts | ⚠️ | _none_ |
| `SEGMENT_WRITE_KEY` | Analytics write key | ⚠️ | _none_ |
| `SENTRY_DSN` | Error reporting endpoint | ⚠️ | _none_ |

_⚠️ Optional – supply for observability and analytics in non-production environments when needed._

## Common scripts
| Command | Purpose |
| --- | --- |
| `pnpm dev` | Starts the web client and API in development watch mode |
| `pnpm test` | Executes the full automated test suite (unit and integration) |
| `pnpm lint` | Runs TypeScript, ESLint, and style checks |
| `pnpm typecheck` | Validates TypeScript types |
| `pnpm migrate:dev` | Generates and applies new migrations in development |
| `pnpm migrate:deploy` | Applies committed migrations to the current environment |
| `pnpm seed:demo` | Seeds sample data for manual QA |
| `pnpm worker:start` | Launches detection workers locally |
| `pnpm report:generate` | Builds compliance and summary reports |

## Deployment workflow
1. Feature branches merge into `develop` via pull requests with passing checks.
2. CI builds Docker images, runs migrations, and pushes artifacts to the registry.
3. Staging deployments occur automatically from `develop`; use the runbooks for sanity checks.
4. Production releases are triggered with tags (`vX.Y.Z`). The release pipeline applies migrations, invalidates caches, and notifies #ops.
5. After deployment, confirm the [Manual QA checklist](#manual-qa-checklist) and file production notes in the release retro document.

## Documentation hub
- [Architecture & Data Flow](docs/architecture.md)
- [Operations Runbooks](docs/operations-runbook.md)
- [Proctor Handbook](docs/proctor-handbook.md)
- [Privacy & Consent Notes](docs/privacy-and-consent.md)
- [Troubleshooting Playbook](docs/troubleshooting.md)
- [QA & Acceptance Checklists](docs/qa-checklists.md)

## Troubleshooting
Quick answers are collected in the [Troubleshooting Playbook](docs/troubleshooting.md). Start there for:

- Database and permission errors (migrations, role mismatch).
- Email delivery and SMTP configuration hiccups.
- S3 bucket failures, lagging uploads, or retention jobs that fall behind.

Escalate via Slack `#author-incidents` once you reach "Step 4" in the incident response runbook.

## FAQ
**How do I load test the detector service?**
Use `pnpm worker:benchmark --input data/fixtures/*.mp4` to replay sanitized recordings against the detection models. Results are written to `reports/benchmarks` for analysis.

**Can I disable recording for specific jurisdictions?**
Yes. Update the `jurisdiction_policies` table (or use the Admin UI) to toggle signals per region. The API enforces consent rules before issuing capture tokens.

**Where do exam organizers upload rosters?**
CSV uploads are handled in the Admin portal under **Exam Cohorts → Import**. Files are validated asynchronously and status is exposed in the activity feed.

**How are detection models versioned?**
Models are stored in S3 with semantic version tags. The worker reads `DETECTOR_MODEL_VERSION` at startup and fetches the corresponding bundle.

## Manual QA checklist
The living QA checklist is tracked in [docs/qa-checklists.md](docs/qa-checklists.md). It covers end-to-end validation for:

- Candidate registration and consent capture
- Live session monitoring and flag resolution
- Recording retention, export, and delete flows
- Administrative alerts, notifications, and audit logging

Update the checklist after each release or significant feature change.

## Acceptance criteria verification
Before closing a ticket, verify:

1. Local setup succeeds using the steps above (fresh clone, migrations applied).
2. Runbooks and the proctor handbook reflect the shipped behavior.
3. Manual QA checklist items relevant to the change were executed, captured, and linked in the ticket.
4. Privacy implications were reviewed and, if necessary, updated in [Privacy & Consent Notes](docs/privacy-and-consent.md).

Document evidence (screenshots, logs, or CLI output) directly in the ticket or release notes.
