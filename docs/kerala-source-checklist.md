# Kerala Source Checklist

This checklist turns the Kerala pilot into a collection workflow the team can execute in order.

## 1. Jurisdiction Master

### Kerala Parliamentary Constituencies
- Dataset name:
  - `kerala_parliamentary_constituencies`
- Priority:
  - `P0`
- Primary source:
  - Election Commission of India
- Expected output:
  - `data/constituencies/kerala_parliamentary_constituencies.csv`
- Required fields:
  - `country`
  - `name`
  - `constituency_type`
  - `constituency_code`
  - `state`
  - `district`
  - `source_url`
  - `source_last_updated`

### Kerala Assembly Constituencies
- Dataset name:
  - `kerala_assembly_constituencies`
- Priority:
  - `P0`
- Primary sources:
  - Kerala Legislative Assembly
  - Election Commission of India
- Expected output:
  - `data/constituencies/kerala_assembly_constituencies.csv`

### Kerala District / Block / Panchayat / Municipality / Ward Master
- Dataset names:
  - `kerala_districts`
  - `kerala_blocks`
  - `kerala_panchayats`
  - `kerala_municipalities`
  - `kerala_wards`
- Priority:
  - `P0` for districts and wards
  - `P1` for remaining local hierarchy
- Primary sources:
  - Kerala State Election Commission
  - Kerala Local Self Government Department

## 2. Office Holders

### Kerala Lok Sabha MPs
- Dataset name:
  - `kerala_lok_sabha_mps`
- Priority:
  - `P0`
- Primary sources:
  - Election Commission of India
  - Lok Sabha Secretariat
- Output format:
  - append to `data/representatives/kerala_official_representatives.csv`

### Kerala Rajya Sabha MPs
- Dataset name:
  - `kerala_rajya_sabha_mps`
- Priority:
  - `P0`
- Primary source:
  - Rajya Sabha Secretariat

### Kerala MLAs
- Dataset name:
  - `kerala_mlas`
- Priority:
  - `P0`
- Primary source:
  - Kerala Legislative Assembly

### Kerala Ministers
- Dataset name:
  - `kerala_ministers`
- Priority:
  - `P1`
- Primary source:
  - Government of Kerala department and ministry pages

### Kerala Local Body Members
- Dataset name:
  - `kerala_local_body_members`
- Priority:
  - `P0` for one pilot district
  - `P1` for statewide coverage
- Primary source:
  - Kerala State Election Commission
- Notes:
  - Start with one district and complete end-to-end before expanding statewide.

## 3. Spatial Data

### Kerala Parliamentary / Assembly Boundaries
- Dataset names:
  - `kerala_parliamentary_boundaries`
  - `kerala_assembly_boundaries`
- Priority:
  - `P0`
- Primary sources:
  - Election Commission of India
  - official GIS / delimitation references
- Output format:
  - GeoJSON in `data/constituencies/`

### Kerala Local Body / Ward Boundaries
- Dataset names:
  - `kerala_local_body_boundaries`
  - `kerala_ward_boundaries`
- Priority:
  - `P1`
- Primary source:
  - Kerala Delimitation Commission

## 4. Election Data

### Parliamentary Results
- Dataset name:
  - `kerala_parliamentary_results`
- Priority:
  - `P0`
- Primary source:
  - Election Commission of India

### Assembly Results
- Dataset name:
  - `kerala_assembly_results`
- Priority:
  - `P1`
- Primary source:
  - Election Commission of India

### Local Body Results
- Dataset name:
  - `kerala_local_body_results`
- Priority:
  - `P1`
- Primary source:
  - Kerala State Election Commission

## 5. Constituency Index Inputs

### First Indicator Set
- Dataset names:
  - `kerala_infrastructure_metrics`
  - `kerala_health_metrics`
  - `kerala_education_metrics`
  - `kerala_welfare_metrics`
  - `kerala_employment_metrics`
- Priority:
  - `P1`
- Primary sources:
  - Kerala department dashboards
  - data.gov.in datasets with Kerala coverage

## 6. Collection Rules
- Use official sources first.
- Record `source_url` for every row.
- Keep raw downloads in `data/raw/<YYYY-MM-DD>/<source_name>/`.
- Create `manifest.json` with sha256 for every raw file.
- Do not publish if QA fails on null rate, duplicate canonical IDs, invalid dates, or missing jurisdiction mappings.

## 7. Kerala Pilot Definition of Done
- All 140 Kerala MLAs loaded.
- All 20 Kerala Lok Sabha MPs loaded.
- Kerala Rajya Sabha members mapped.
- One district worth of local body members loaded.
- Kerala parliamentary and assembly master datasets loaded.
- At least one boundary layer available for map validation.
