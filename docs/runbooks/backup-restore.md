# Backup and Restore

## Scope
- MongoDB primary database
- `data/published/current` approval and QA artifacts
- Cloudinary asset inventory export

## Backup policy
- Production MongoDB snapshot: daily
- Point-in-time restore: enabled where provider supports it
- Artifact backup: nightly tarball of `data/published/current`
- Retention:
  - daily: 14 days
  - weekly: 8 weeks
  - monthly: 6 months

## Pre-flight verification
1. Confirm latest Mongo snapshot completed successfully.
2. Confirm latest `data/published/current` archive exists and checksum matches manifest.
3. Confirm Cloudinary usage export was generated for the same day.

## Restore drill
1. Restore MongoDB into isolated staging database.
2. Restore `data/published/current` into staging workspace.
3. Point staging `MONGODB_URI` at the restored database.
4. Run:
   - `npm run build`
   - `npm run smoke:staging`
5. Verify:
   - `GET /api/health` returns `200`
   - `GET /api/metrics` returns `200`
   - `/api/admin/ingestion` shows expected manifests and QA artifacts
   - recent jobs and corrections history are readable

## Verification record
- Drill date
- Restored snapshot timestamp
- Restored artifact checksum
- Smoke result
- Operator
- Follow-up actions
