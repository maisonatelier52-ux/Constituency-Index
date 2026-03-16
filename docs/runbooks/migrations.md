# Data Migration Playbook

## Scope
This project currently uses import pipelines (official constituencies, boundaries) as data migrations.

## Rules
1. Never run destructive bulk updates directly in production without staging validation.
2. Always keep input dataset checksums and source version metadata in release notes.
3. Run import jobs first in staging, validate counts, then run in production.

## Pre-Migration Checklist
1. Verify input files:
   - `data/constituencies/official_constituencies.template.csv`
   - `data/constituencies/boundaries.template.geojson`
2. Verify DB backup timestamp.
3. Verify queue worker availability.

## Execution
1. Enqueue import jobs through `/api/admin/jobs`:
   - `import.official_constituencies`
   - `import.boundaries`
2. Process through `/api/jobs/worker`.
3. Track failures/dead-letter jobs in `/admin/jobs`.

## Validation
1. Confirm expected upsert/modified counts.
2. Confirm dashboard data and map boundaries render.
3. Confirm no spike in API 5xx.

## Rollback
If migration introduces bad data:
1. Stop import jobs.
2. Roll back app revision if needed.
3. Restore DB snapshot (last known good) if data cannot be corrected incrementally.
