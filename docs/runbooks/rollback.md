# Rollback Runbook

## Rollback Triggers
- sustained elevated 5xx rate
- auth/session failures
- queue dead-letter spike
- data corruption indicators

## Immediate Response
1. Freeze new deployments.
2. Route traffic back to previous known-good revision.
3. Pause worker endpoint triggers if queue handlers are failing repeatedly.

## Data Safety
1. If data writes are suspected to be bad, disable mutating routes via maintenance flag.
2. Snapshot current DB before any restore.
3. Restore from latest good backup only if required and approved.

## Validation After Rollback
1. `/api/health` returns healthy.
2. Login/logout works.
3. Issue create/update works.
4. Queue worker processes jobs without new failures.

## Follow-up
1. Open incident report with timeline and root-cause analysis.
2. Add regression test or CI check before re-release.
