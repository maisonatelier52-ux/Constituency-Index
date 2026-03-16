# Official Constituency Import Pipeline

## Constituency Master Import
Accepted formats:
- CSV (`.csv`) with header row
- JSON (`.json`) array of objects

Required fields:
- `name`
- `code` (unique key; e.g. `PC-011`, `AC-082`)
- `state`
- `constituencyType` (`parliamentary` or `assembly`; aliases: `pc`, `ac`, `lok sabha`, `vidhan sabha`)

Optional fields:
- `profileType` (`urban`, `rural`, `universal`)
- metrics (`promises`, `infrastructure`, `welfare`, `employment`, `education`, `healthcare`, `environment`)

Run:
- default path: `data/constituencies/official_constituencies.csv`
- `npm run import:official`
- custom path: `npm run import:official -- ./path/to/file.csv`

## Boundary GeoJSON Import
Input must be a GeoJSON `FeatureCollection` with Polygon/MultiPolygon features.

Expected properties (configurable via env):
- code field: `code` (`BOUNDARY_CODE_FIELD`)
- name field: `name` (`BOUNDARY_NAME_FIELD`)

Run:
- default path: `data/constituencies/boundaries.geojson`
- `npm run import:boundaries`
- custom path: `npm run import:boundaries -- ./path/to/boundaries.geojson`

Template file:
- `data/constituencies/boundaries.template.geojson`
