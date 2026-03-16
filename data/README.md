# Data Contract

## Folder Contract
- `data/raw/<YYYY-MM-DD>/<source_name>/`
  - Raw source snapshots and `manifest.json` with sha256 checksums.
- `data/normalized/<YYYY-MM-DD>/`
  - Normalized JSON datasets and QA output.
- `data/published/current/`
  - Latest approved QA/manifests for runtime and audit review.

## Pipeline Stages
1. `extract`
2. `normalize`
3. `validate`
4. `upsert`
5. `qa report`

## Representative Pipeline QA Gates
- Reject if required field null rate > `1%`.
- Reject if duplicate canonical IDs > `0`.
- Reject if any `term_start > term_end`.
- Reject if jurisdiction mapping is missing.
- Reject if source URLs are empty or unreachable.
