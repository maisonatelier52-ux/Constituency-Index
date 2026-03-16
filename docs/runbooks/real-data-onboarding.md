# Real Data Onboarding (India Political Offices)

This runbook is the implementation checklist for production onboarding of real office-holder data.

## 1. Scope Freeze (Required)
- Office levels supported:
  - `union_minister`
  - `mp_lok_sabha`
  - `mp_rajya_sabha`
  - `mla`
  - `panchayat_member`
  - `municipal_councillor`
  - `other_local_representative`
- Mandatory fields per representative:
  - `full_name`
  - `office_level`
  - `office_title`
  - `jurisdiction_type`
  - `jurisdiction_code`
  - `state`
  - `party`
  - `term_start`
  - `term_end`
  - `source_url`
  - `source_last_updated`
  - `status`
- Jurisdiction hierarchy:
  - `country -> state -> district -> block -> panchayat/ward`
- Canonical ID strategy:
  - `country:office_level:jurisdiction_code:person_slug`

Reference: `lib/politicsScope.js`

## 2. Data Model
- Extended `models/Representative.js` with:
  - `officeLevel`, `officeTitle`, `jurisdictionType`, `jurisdictionCode`
  - `district`, `block`, `ward`
  - `sourceUrl`, `sourceLastUpdated`, `status`
  - `canonicalId`
- Backward compatibility preserved:
  - legacy `type` and `constituency` remain.
- Indexes:
  - `officeLevel + state + jurisdictionCode`
  - `status`
  - `sourceLastUpdated`

## 3. Real Data Pipeline (No Manual DB Edits)
- Folder contract implemented:
  - `data/raw/<YYYY-MM-DD>/<source_name>/`
  - `data/normalized/<YYYY-MM-DD>/`
  - `data/published/current/`
- Representative pipeline:
  - `extract -> normalize -> validate -> upsert -> qa report`
  - checksum (`sha256`) written to manifest
  - QA gate rejects if:
    - required-field null rate > 1%
    - duplicate canonical IDs > 0
    - invalid date ranges exist
    - jurisdiction mapping missing
    - source URL check fails
- Idempotent upserts keyed by `canonicalId`.

Run:
- `npm run import:representatives -- data/representatives/official_representatives.csv`

## 4. Source Registry (Official First)
- Machine-readable registry: `data/source_registry.json`
- Policy:
  - primary official/public institutional sources for baseline
  - secondary sources only for enrichment
  - `source_url` required on records

## 5. Queue-Based Ingestion and Refresh
- Job types in queue:
  - `import.official_constituencies`
  - `import.boundaries`
  - `import.representatives`
- Worker tick:
  - `.github/workflows/queue-worker.yml` (every 5 minutes)
- Nightly scheduling:
  - `.github/workflows/nightly-ingest.yml` calls `POST /api/jobs/schedule`
- Imports run as jobs only; avoid synchronous API import logic.

## 6. Hosting Setup (Staging then Production)
Configure GitHub environments:
- `staging`
- `production` with required reviewers enabled

Required secrets:
- Deploy automation:
  - `STAGING_DEPLOY_CMD`
  - `PRODUCTION_DEPLOY_CMD`
  - `STAGING_HEALTHCHECK_URL` (optional)
  - `PRODUCTION_HEALTHCHECK_URL` (optional)
- Worker/scheduler:
  - `WORKER_URL`
  - `SCHEDULER_URL`
  - `JOB_WORKER_SECRET`
- Runtime/platform:
  - `MONGODB_URI`
  - `NEXTAUTH_SECRET`
  - `NEXTAUTH_URL`
  - `ALLOWED_ORIGINS`
  - `CLOUDINARY_*`
  - `SENTRY_*`
  - `SMTP_*`
  - `EMAIL_FROM`
  - `QA_SIGNING_SECRET`

## 7. Production Guardrails
- Deploy only when CI passes:
  - `lint`
  - `test:ci`
  - `check:migrations`
  - `build`
- Health gate:
  - `GET /api/health == 200`
- Queue guardrail:
  - dead-letter count must not increase post-deploy
- Rollback procedure:
  - `docs/runbooks/rollback.md`

## 8. Data QA Before Publish
- Enforced in representative pipeline:
  - canonical ID uniqueness
  - date range validity
  - jurisdiction mapping presence
  - source URL non-empty + reachable
  - signed QA report when `QA_SIGNING_SECRET` is present

## 9. Smoke + Go-Live
- Run public smoke:
  - `SMOKE_BASE_URL=<staging-url> JOB_WORKER_SECRET=<secret> npm run smoke:staging`
- Run authenticated smoke by adding:
  - `SMOKE_TEST_EMAIL`
  - `SMOKE_TEST_PASSWORD`
  - `SMOKE_ADMIN_EMAIL`
  - `SMOKE_ADMIN_PASSWORD`
- Deploy production with manual approval in GitHub environment.
- Execute one rollback drill during non-peak window.

## 10. Acceptance Criteria
- All target office levels visible via `/mps` filter (`officeLevel`).
- At least one full state loaded with real officials across MP/MLA/local tiers.
- Nightly ingestion jobs run and generate QA + audit artifacts.
- No critical Sentry errors for 72 hours after launch.
