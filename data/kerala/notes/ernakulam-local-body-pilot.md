# Ernakulam Local-Body Pilot

This file tracks the first Kerala local-body ingestion district.

## Pilot District
- `Ernakulam`

## Why Ernakulam
- Covers both urban and rural local bodies.
- Good first district for validating:
  - panchayat member rows
  - municipal councillor rows
  - ward-level jurisdiction codes
  - mixed office-title normalization

## Target Datasets
- `ernakulam_panchayat_members`
- `ernakulam_municipal_councillors`
- `ernakulam_local_body_master`

## Source Targets
- Primary:
  - Kerala State Election Commission voter services / know-member flow
- Secondary discovery only:
  - local body public rosters if linked from official SEC pages

## Required Row Shape
- `country`
- `full_name`
- `office_level`
- `office_title`
- `jurisdiction_type`
- `jurisdiction_code`
- `state`
- `district`
- `block`
- `ward`
- `party`
- `term_start`
- `term_end`
- `source_url`
- `source_last_updated`
- `status`

## Jurisdiction Code Pattern
- Panchayat ward:
  - `IN-KL-ERN-GP-<local_body_code>-W<ward>`
- Municipality ward:
  - `IN-KL-ERN-MUN-<local_body_code>-W<ward>`
- Corporation ward:
  - `IN-KL-ERN-CORP-<local_body_code>-W<ward>`

## Collection Steps
1. Identify the SEC request flow for district -> local body -> ward/member lookup.
2. Capture one valid Ernakulam panchayat member row from the official source.
3. Capture one valid Ernakulam municipal/corporation member row from the official source.
4. Normalize local body naming and assign stable local body codes.
5. Expand to the full district only after the first two row types validate cleanly.

## Findings So Far
- District lookup page:
  - `https://sec.kerala.gov.in/election/member/viewMember`
- Dependent local-body endpoint:
  - `POST /public/getalllbcmpdb/byd`
  - payload: `objid=<district_id>`
  - Ernakulam district id: `8`
- Dependent ward endpoint:
  - `POST /public/getward/bylb`
  - payload: `objid=<local_body_source_key>`
- Captured official artifacts:
  - `data/kerala/constituencies/ernakulam_local_bodies.official.csv`
  - `data/kerala/constituencies/ernakulam_choornikkara_wards.official.csv`
  - `data/kerala/constituencies/ernakulam_north_paravur_wards.official.csv`
- Confirmed non-captcha official source:
  - Kerala SEC downloadable election-result gazettes
  - Ernakulam panchayat gazette:
    - `https://sec.kerala.gov.in/public/elercd/download/db3d5c61-cc49-48d5-991f-d207bd159562`
  - Municipal council / corporation gazette:
    - `https://sec.kerala.gov.in/public/elercd/download/90941035-a6b5-46e0-b20d-667aa9894a46`
- Seed member file updated from those gazettes:
  - `data/kerala/representatives/ernakulam_local_body_members.template.csv`

## Current Blocker
- Actual elected-member lookup is captcha-protected on the SEC form.
- That means direct browser-style scraping of the member form should not be assumed.
- Safe extraction path now implemented:
  - `scripts/importKeralaLocalBodyGazettes.py`
  - reads the official SEC gazette PDFs
  - filters Ernakulam rows using the captured local-body master CSV
  - writes `data/kerala/representatives/ernakulam_local_body_members.official.csv`
  - output can be imported through `scripts/importRepresentatives.js`

## Current Extraction Flow
1. Ensure the two official SEC gazette PDFs are available:
   - `/tmp/ernakulam-panchayat.pdf`
   - `/tmp/kerala-municipal-winners.pdf`
2. Run:
   - `npm run extract:kerala-local-bodies`
   - or district-only:
     - `/Users/sam/Documents/JMHV/.venv/bin/python scripts/importKeralaLocalBodyGazettes.py --district Ernakulam --panchayat-pdf /tmp/ernakulam-panchayat.pdf --municipal-pdf /tmp/kerala-municipal-winners.pdf --output data/kerala/representatives/ernakulam_local_body_members.official.csv`
3. Import into MongoDB:
   - `SKIP_SOURCE_URL_VALIDATION=true REP_SOURCE_NAME=ernakulam_local_bodies node scripts/importRepresentatives.js data/kerala/representatives/ernakulam_local_body_members.official.csv`

## Kerala-Wide Gazette Support
- Kerala-wide panchayat import now expects the 14 district gazette PDFs plus the statewide municipal/corporation gazette.
- Official source URLs are tracked in:
  - `data/kerala/gazettes/source_manifest.json`
- The importer supports:
  - district-only extraction
  - Kerala-wide extraction
  - OCR cleanup into `normalized_name`
  - optional best-effort transliteration into `transliterated_name`
- Current SEC source caveat:
  - the election-results page exposes 13 district panchayat gazettes plus the statewide municipal/corporation gazette
  - Pathanamthitta currently appears in the statewide dataset through municipal rows, but a dedicated panchayat gazette was not present on the source page during the latest extraction pass

## Acceptance for Pilot Start
- SEC source flow identified.
- Template CSV created.
- District notes created.
- Ready to expand Ernakulam local-body members from official gazettes.
