# Kerala Pilot Data Workspace

Use this directory for Kerala-specific working files before they are promoted into the shared pipeline folders.

## Expected working files
- `representatives/`
  - Kerala raw exports or manually structured CSVs before import
- `constituencies/`
  - Kerala parliamentary and assembly masters
- `boundaries/`
  - Kerala GeoJSON or source references
- `notes/`
  - collection notes, blockers, and URL discovery logs

## Promotion rule
- Working files here are not treated as published artifacts.
- To become part of the audited pipeline, run imports so they land under:
  - `data/raw/<YYYY-MM-DD>/<source_name>/`
  - `data/normalized/<YYYY-MM-DD>/`
  - `data/published/current/`
