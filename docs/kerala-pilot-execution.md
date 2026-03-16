# Kerala Pilot Execution

This document is the Kerala-specific execution sheet for onboarding real political and constituency data.

## Pilot Goal
- Make Kerala the first fully onboarded state.
- Cover:
  - Union ministers from Kerala where relevant as office holders
  - Lok Sabha MPs for Kerala
  - Rajya Sabha MPs representing Kerala
  - Kerala MLAs
  - Panchayat members
  - Municipal councillors
  - Other local elected representatives where officially available
- Reach one full-state pilot with working:
  - office-holder directory
  - constituency and local boundary layers
  - election-result inputs
  - real constituency index inputs for at least a first indicator set

## Priority Order
1. Kerala parliamentary and assembly jurisdiction master
2. Kerala parliamentary and assembly office holders
3. Kerala local-body elected members
4. Kerala boundary and ward delimitation datasets
5. Kerala election results
6. Kerala development indicators
7. Kerala promises / manifesto records

## Official Source Targets

### 1. Kerala MLAs
- Primary source:
  - Kerala Legislative Assembly
- Source candidate:
  - [Kerala Legislative Assembly member profiles](https://niyamasabha.nic.in/index.php/profile/index/2236)
- Expected data:
  - member name
  - assembly constituency
  - party
  - district
  - profile details
- Expected format:
  - HTML member profile pages
- Notes:
  - likely requires page-by-page scraping of member profiles
  - keep `source_url` per member profile page

### 2. Kerala Local Body Elected Members
- Primary source:
  - Kerala State Election Commission
- Source candidate:
  - [SEC Kerala voter services / know member](https://sec.kerala.gov.in/public/voterservices)
- Expected data:
  - elected local body member
  - district
  - local body
  - ward
  - office/body type
- Expected format:
  - searchable HTML interface
- Notes:
  - likely needs scripted query extraction by district/local body
  - this is the best starting point for panchayat and municipal representatives

### 3. Kerala Local Body Delimitation / Ward Boundaries
- Primary source:
  - Kerala Delimitation Commission
- Source candidate:
  - [Kerala Delimitation Commission](https://delimitation.lsgkerala.gov.in/about_us)
- Expected data:
  - ward delimitation notifications
  - local-body boundary references
- Expected format:
  - HTML / linked files / GIS documents
- Notes:
  - may need manual source discovery for downloadable boundary files
  - record exact download URLs in source registry once identified

### 4. Kerala Parliamentary Constituencies and Results
- Primary source:
  - Election Commission of India
- Source candidates:
  - [ECI 2024 parliamentary result pages for Kerala PCs](https://results.eci.gov.in/PcResultGenJune2024/ConstituencywiseS111.htm)
- Expected data:
  - candidate names
  - winning MP
  - party
  - total votes
  - vote share
  - turnout-related totals
- Expected format:
  - HTML results pages
- Notes:
  - use ECI as the authoritative result source

### 5. Kerala Ministers
- Primary source:
  - Government of Kerala ministry/department pages
- Source candidates:
  - [Government of Kerala portal](https://kerala.gov.in/contactus)
  - department minister profile pages such as [Minister O. R. Kelu profile](https://minister-scst.kerala.gov.in/en/home/)
- Expected data:
  - minister name
  - portfolio
  - constituency
  - office assumption date
- Expected format:
  - department websites / minister profile pages
- Notes:
  - source quality varies by department, so validate each URL carefully

### 6. Kerala Development Indicators
- Primary source candidates:
  - [Kerala Local Self Government / NREGS dashboard](https://nregs.kerala.gov.in/en/home/)
  - data.gov.in datasets filtered for Kerala
  - Kerala department dashboards
- Expected data:
  - district/block/GP counts
  - welfare and employment proxies
  - public works and utilization indicators
- Expected format:
  - dashboard HTML
  - CSV/XLS
  - annual reports

## Kerala Dataset Inventory

### A. Kerala Office Holders
- `kerala_mlas`
- `kerala_lok_sabha_mps`
- `kerala_rajya_sabha_mps`
- `kerala_local_body_members`
- `kerala_ministers`

### B. Kerala Jurisdiction Master
- `kerala_parliamentary_constituencies`
- `kerala_assembly_constituencies`
- `kerala_districts`
- `kerala_blocks`
- `kerala_panchayats`
- `kerala_municipalities`
- `kerala_wards`

### C. Kerala Spatial Data
- `kerala_parliamentary_boundaries`
- `kerala_assembly_boundaries`
- `kerala_local_body_boundaries`
- `kerala_ward_boundaries`

### D. Kerala Index Inputs
- `kerala_election_results`
- `kerala_infrastructure_metrics`
- `kerala_health_metrics`
- `kerala_education_metrics`
- `kerala_welfare_metrics`
- `kerala_employment_metrics`

## Required Fields for Kerala Records
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
- `canonical_id`

## Suggested Ownership
- MLA / MP collection:
  - research + ETL
- local body member collection:
  - Kerala research pod + ETL
- boundary collection:
  - GIS/data engineering
- development indicators:
  - data analytics
- QA sign-off:
  - central data team

## Immediate Execution Steps
1. Download and normalize Kerala MLA profiles from Niyamasabha.
2. Build Kerala local-body member extractor against SEC Kerala "Know Member".
3. Capture ECI Kerala parliamentary results into normalized result rows.
4. Identify downloadable Kerala ward/boundary assets from delimitation/GIS sources.
5. Select 5-10 Kerala development indicators for the first constituency index version.

## Acceptance for Kerala Pilot
- All Kerala MLAs ingested with source URLs.
- All 20 Kerala Lok Sabha seats mapped to current MPs.
- At least one Kerala district's local body elected members ingested end-to-end.
- QA artifacts produced in `data/raw`, `data/normalized`, and `data/published/current`.
- `/mps?officeLevel=mla` and other office-level filters show Kerala real data correctly.
