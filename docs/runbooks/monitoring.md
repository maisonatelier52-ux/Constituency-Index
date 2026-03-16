# Monitoring and Alerts

## Endpoints
- Health: `/api/health`
- Metrics: `/api/metrics`
- Worker: `/api/jobs/worker`

## Minimum alerts
- Health endpoint non-200 for 3 consecutive checks
- Metrics endpoint non-200 for 3 consecutive checks
- `app_jobs_dead_letter > 0`
- `app_jobs_failed > 25`

## Uptime probe cadence
- Every 10 minutes for staging
- Every 5 minutes for production

## Operator response
1. Check `/admin/ingestion` for QA failures.
2. Check `/admin/corrections` for failed or dead-letter import jobs.
3. Retry failed jobs where appropriate from `/api/admin/jobs`.
4. Escalate if dead letters continue increasing after retry.
