# Deployment Runbook

## Environments
- `staging`: pre-prod validation, mirrors prod config and region.
- `production`: user-facing deployment.
- Automation:
  - `.github/workflows/deploy.yml` deploys `staging` on every `main` push.
  - `.github/workflows/browser-e2e.yml` runs the staging drill and Playwright browser suite after successful staging deploys.
  - production deploy runs only via manual workflow dispatch (`target=production`) and should use GitHub environment approval rules.
  - `.github/workflows/queue-worker.yml` runs every 5 minutes and triggers `/api/jobs/worker`.

## Pre-Deploy Checklist
1. Confirm CI is green (`lint`, `test:ci`, `check:migrations`, `build`).
2. Confirm `.env` secrets are set in platform secret manager (not committed).
3. Confirm MongoDB backup snapshot exists for today.
4. Confirm `JOB_WORKER_SECRET` is configured.
5. Confirm SMTP secrets are configured (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`).

## Staging Deploy
1. Triggered automatically by push to `main`.
2. Run smoke checks:
   - `GET /api/health` should return `200`.
   - `GET /api/metrics` should return `200`.
   - `POST /api/jobs/worker` with worker secret should process at least one test job.
   - Auth flow: register -> reset request.
   - Run `npm run drill:staging` with staging env vars.
3. Run admin diagnostics checks:
   - `/admin/jobs` renders queue state.
   - no growing `dead_letter` jobs.

## Production Deploy (Zero-Downtime Pattern)
1. Trigger deploy workflow manually with `target=production`.
2. Build immutable artifact from the same commit validated in staging.
3. Deploy as a new revision alongside current revision.
4. Shift traffic gradually (10% -> 50% -> 100%) while monitoring:
   - error rate
   - p95 latency
   - queue failures/dead-letter count
5. Keep previous revision warm for rollback window.

## Post-Deploy Verification
1. Verify `/api/health`.
2. Verify one queue cycle succeeds.
3. Verify auth sign-in works.
4. Verify issues submit/update and admin jobs page.

## Required GitHub Secrets
- For `.github/workflows/deploy.yml`:
  - `STAGING_DEPLOY_CMD`
  - `PRODUCTION_DEPLOY_CMD`
  - `STAGING_HEALTHCHECK_URL` (optional)
  - `PRODUCTION_HEALTHCHECK_URL` (optional)
- For `.github/workflows/browser-e2e.yml`:
  - `STAGING_BASE_URL`
  - `STAGING_HEALTHCHECK_URL`
  - `STAGING_METRICS_URL`
  - `E2E_ADMIN_EMAIL` (optional but needed for admin browser flows)
  - `E2E_ADMIN_PASSWORD` (optional but needed for admin browser flows)
- For `.github/workflows/queue-worker.yml`:
  - `WORKER_URL` (full URL to `/api/jobs/worker`)
  - `JOB_WORKER_SECRET`
- For `.github/workflows/nightly-ingest.yml`:
  - `SCHEDULER_URL` (full URL to `/api/jobs/schedule`)
  - `JOB_WORKER_SECRET`
