# Staging Drill

## Required staging configuration
- `HEALTHCHECK_URL`
- `METRICS_URL`
- `ALERT_EMAIL_TO`
- `REQUIRE_IMPORT_APPROVAL=true`
- `MALWARE_SCAN_PROVIDER=clamav` with `CLAMAV_HOST` and `CLAMAV_PORT`
- `MODERATION_PROVIDER=sightengine` with `SIGHTENGINE_API_USER` and `SIGHTENGINE_API_SECRET`

## Browser test credentials
- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`

## Run order
1. Deploy current main branch to staging.
2. Verify `/api/health` and `/api/metrics`.
3. Run:
   - `SMOKE_BASE_URL=<staging-url> HEALTHCHECK_URL=<health-url> METRICS_URL=<metrics-url> PLAYWRIGHT_BASE_URL=<staging-url> npm run drill:staging`
4. In the staging UI:
   - approve one dataset from `/admin/ingestion`
   - queue one representative import from `/admin/jobs` or `/admin/corrections`
   - confirm the worker clears it
   - confirm dead-letter retry still works

## Pass criteria
- smoke checks pass
- Playwright suite passes
- `/api/metrics` returns `200`
- alert mailbox receives a test dead-letter alert when intentionally triggered
- dataset publish remains blocked until manual approval exists
