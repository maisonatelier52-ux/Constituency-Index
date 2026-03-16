# Hosting Handoff

This document is the handoff guide for getting the app hosted safely, validating staging, and promoting to production.

## Project
- Repo root: `/Users/sam/Documents/JMHV/Trasnocho/Journalism Society/Constituency Index`

## Read these first
- `docs/runbooks/deployment.md`
- `docs/runbooks/staging-drill.md`
- `docs/runbooks/backup-restore.md`
- `docs/runbooks/monitoring.md`

## 1. Before hosting
1. Clone the repo.
2. Install dependencies:
   ```bash
   npm ci
   ```
3. Install Playwright browser:
   ```bash
   npm run test:e2e:install
   ```
4. Confirm local checks pass:
   ```bash
   npm run lint
   npm run test:unit
   npm run test:ci
   npm run check:migrations
   npm run build
   ```
5. Review `.env.example`.

## 2. Choose hosting
Recommended:
1. App host: Vercel, Render, or Fly.io
2. Database: MongoDB Atlas
3. File storage: Cloudinary
4. Malware scan service: ClamAV daemon reachable from app
5. Content moderation: Sightengine
6. Error tracking: Sentry

## 3. Create environments
Create:
1. `staging`
2. `production`

Production must require manual approval before deploy.

## 4. Set application runtime secrets
Set these in both staging and production unless noted.

### Required core
- `MONGODB_URI`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `ALLOWED_ORIGINS`
- `JOB_WORKER_SECRET`
- `QA_SIGNING_SECRET`

### Auth
- `REQUIRE_EMAIL_VERIFICATION=true`

### Uploads
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `UPLOAD_ALLOWED_FORMATS`
- `UPLOAD_MAX_FILE_SIZE_BYTES`
- `UPLOAD_MAX_FILES`

### Email
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `EMAIL_FROM`
- `ALERT_EMAIL_TO`

### Monitoring
- `SENTRY_DSN`
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`
- `SENTRY_TRACES_SAMPLE_RATE`

### Import publish gate
- `REQUIRE_IMPORT_APPROVAL=true`

### Malware scan
- `MALWARE_SCAN_PROVIDER=clamav`
- `CLAMAV_HOST`
- `CLAMAV_PORT`
- `MALWARE_SCAN_MAX_BYTES`
- `DISABLE_MALWARE_SCAN=false`

### Content moderation
- `MODERATION_PROVIDER=sightengine`
- `SIGHTENGINE_API_USER`
- `SIGHTENGINE_API_SECRET`
- `SIGHTENGINE_MODELS`
- `MODERATION_REVIEW_THRESHOLD`
- `DISABLE_CONTENT_MODERATION=false`

## 5. Set GitHub environment secrets

### For deploy workflow
- `STAGING_DEPLOY_CMD`
- `PRODUCTION_DEPLOY_CMD`
- `STAGING_HEALTHCHECK_URL`
- `PRODUCTION_HEALTHCHECK_URL`

### For browser e2e workflow
- `STAGING_BASE_URL`
- `STAGING_HEALTHCHECK_URL`
- `STAGING_METRICS_URL`
- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`

### For queue worker workflow
- `WORKER_URL`
- `JOB_WORKER_SECRET`

### For nightly ingest workflow
- `SCHEDULER_URL`
- `JOB_WORKER_SECRET`

### For uptime workflow
- `HEALTHCHECK_URL`
- `METRICS_URL`

## 6. Configure GitHub environments
In GitHub:
1. Create `staging`
2. Create `production`
3. Add required reviewers to `production`
4. Put the correct secrets into each environment

## 7. Set deploy commands
Example only. Adapt to the actual host.

### Vercel staging
```bash
vercel deploy --token=$VERCEL_TOKEN --yes
```

### Vercel production
```bash
vercel deploy --prod --token=$VERCEL_TOKEN --yes
```

## 8. Set up database
1. Create MongoDB Atlas cluster
2. Enable backups
3. Create DB user
4. Add network access for hosting platform
5. Put Atlas URI into `MONGODB_URI`

## 9. Set up file upload services
1. Create Cloudinary account/project
2. Add credentials to env
3. Verify signed upload endpoint works:
   - `POST /api/uploads/signature`

## 10. Set up malware scanning
1. Provision a reachable ClamAV daemon
2. Confirm the app can reach `CLAMAV_HOST:CLAMAV_PORT`
3. Set `MALWARE_SCAN_PROVIDER=clamav`

If no scanner is ready yet:
- do not go live with uploads open to the public

## 11. Set up content moderation
1. Create Sightengine account
2. Set:
   - `MODERATION_PROVIDER=sightengine`
   - `SIGHTENGINE_API_USER`
   - `SIGHTENGINE_API_SECRET`

## 12. Set up Sentry
1. Create Sentry project
2. Add DSNs and org/project env vars
3. Verify errors arrive in Sentry from staging first

## 13. Create first admin user
Before staging drill, create one admin user in MongoDB.

Recommended path:
1. Register a user normally
2. Change its `role` to `admin` in MongoDB
3. Verify email if required

This admin is needed for:
- `/admin/jobs`
- `/admin/corrections`
- `/admin/ingestion`
- Playwright admin tests

## 14. Deploy staging
Push to `main`.

This triggers:
- CI
- staging deploy
- browser e2e workflow after deploy success

Relevant workflows:
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
- `.github/workflows/browser-e2e.yml`
- `.github/workflows/queue-worker.yml`
- `.github/workflows/nightly-ingest.yml`
- `.github/workflows/uptime-check.yml`

## 15. After staging deploy, do this immediately

### Basic checks
1. Open `/api/health`
2. Open `/api/metrics`
3. Open `/auth/register`
4. Open `/auth/signin`
5. Open `/issues/new`
6. Open `/mps`
7. Open `/admin/ingestion`
8. Open `/admin/jobs`
9. Open `/admin/corrections`

### Functional checks
1. Register a user
2. Verify email
3. Sign in
4. Submit an issue
5. Upload evidence
6. Confirm issue create job hooks run
7. Run worker
8. Confirm no unexpected dead-letter jobs
9. Approve one dataset in `/admin/ingestion`
10. Queue one import
11. Confirm publish gate behavior works

## 16. Run the staging drill
```bash
SMOKE_BASE_URL=https://your-staging-url \
HEALTHCHECK_URL=https://your-staging-url/api/health \
METRICS_URL=https://your-staging-url/api/metrics \
PLAYWRIGHT_BASE_URL=https://your-staging-url \
E2E_ADMIN_EMAIL=admin@example.com \
E2E_ADMIN_PASSWORD='your-admin-password' \
npm run drill:staging
```

## 17. Before production
Do not go live until these are true:
1. CI is green
2. staging deploy succeeded
3. browser e2e workflow succeeded
4. health endpoint returns `200`
5. metrics endpoint returns `200`
6. queue worker runs cleanly
7. dead-letter jobs are `0`, or understood and resolved
8. Sentry is receiving events
9. backup is enabled
10. rollback plan is understood
11. `REQUIRE_IMPORT_APPROVAL=true` is confirmed in production env
12. upload scanning and moderation are actually enabled, not left as `noop`

## 18. Production deploy
Use manual production workflow only.

Do not deploy production by pushing blindly.

Production deploy is triggered through:
- GitHub Actions
- workflow dispatch
- target = `production`

## 19. Immediately after production deploy
Check:
1. `/api/health`
2. `/api/metrics`
3. sign-in flow
4. issue create flow
5. upload flow
6. admin jobs page
7. ingestion dashboard
8. corrections page
9. queue worker success
10. no spike in Sentry errors

## 20. First 24 hours after launch
Monitor:
1. Sentry
2. failed jobs
3. dead-letter jobs
4. alert mailbox
5. uptime checks
6. upload scan/moderation failures
7. auth failures
8. import approval mistakes

## 21. If something goes wrong
Use:
- `docs/runbooks/rollback.md`
- `docs/runbooks/backup-restore.md`

## 22. Important warning
These are not optional for public launch:
1. `REQUIRE_IMPORT_APPROVAL=true`
2. real Cloudinary credentials
3. real SMTP credentials
4. real Sentry config
5. real ClamAV setup
6. real moderation provider setup
7. real backups

If any of those are missing, treat the deployment as internal/staging only.

## Short version
1. Set up staging and production environments
2. Add all required env vars and GitHub secrets
3. Enable Mongo backups
4. Configure Cloudinary, SMTP, Sentry, ClamAV, Sightengine
5. Create one admin user
6. Push `main` to deploy staging
7. Run `npm run drill:staging`
8. Fix anything failing
9. Manually deploy production
10. Verify health, metrics, auth, uploads, jobs, ingestion, and Sentry
11. Watch alerts for 24 hours
