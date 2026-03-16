# Source Collection Plan

This document maps each required dataset to likely official sources, expected formats, refresh cadence, and team ownership.

## 1. Office Holders

### Union Ministers
- Source:
  - Prime Minister's Office
  - Cabinet Secretariat
  - Ministry websites
- Expected format:
  - HTML pages
  - press releases
  - PDF lists
- Refresh cadence:
  - on cabinet reshuffle
  - monthly verification
- Owner:
  - research + data normalization

### MPs: Lok Sabha
- Source:
  - Lok Sabha Secretariat
  - Parliament member profile pages
- Expected format:
  - HTML tables/pages
  - PDFs
- Refresh cadence:
  - after elections / by-elections
  - monthly verification
- Owner:
  - research + ETL

### MPs: Rajya Sabha
- Source:
  - Rajya Sabha Secretariat
- Expected format:
  - HTML pages
  - PDF member lists
- Refresh cadence:
  - as seats change
  - monthly verification
- Owner:
  - research + ETL

### MLAs
- Source:
  - State Legislative Assembly websites
  - State Election Commission / Election Department portals
- Expected format:
  - HTML member pages
  - PDF rosters
  - XLS/CSV in some states
- Refresh cadence:
  - after state elections / by-elections
  - monthly verification
- Owner:
  - state-level research pods + ETL

### Panchayat Members
- Source:
  - State Panchayati Raj portals
  - State Election Commission websites
  - District panchayat portals
- Expected format:
  - district HTML pages
  - XLS/PDF
- Refresh cadence:
  - after local elections
  - quarterly verification
- Owner:
  - district research + ETL

### Municipal Councillors / Local Representatives
- Source:
  - Urban local body portals
  - municipal corporation websites
  - State Election Commission portals
- Expected format:
  - HTML ward/member pages
  - PDF rosters
- Refresh cadence:
  - after local elections
  - quarterly verification
- Owner:
  - urban local body research + ETL

## 2. Jurisdiction Master Data

### Parliamentary / Assembly Constituencies
- Source:
  - Election Commission of India
- Expected format:
  - official lists
  - PDFs
  - HTML
- Refresh cadence:
  - on delimitation or official changes
  - annual verification
- Owner:
  - central data team

### District / Block / Panchayat / Ward Master
- Source:
  - state administrative portals
  - local governance department portals
  - Census / official administrative directories
- Expected format:
  - CSV/XLS
  - HTML tables
  - PDF circulars
- Refresh cadence:
  - annual verification
- Owner:
  - central data team + state researchers

## 3. Boundary Data

### Constituency Boundaries
- Source:
  - state GIS portals
  - ECI-linked maps where available
  - official administrative geodata portals
- Expected format:
  - GeoJSON
  - shapefile
  - KML
- Refresh cadence:
  - on official revision
  - annual verification
- Owner:
  - GIS/data engineering

### District / Block / Panchayat / Ward Boundaries
- Source:
  - state GIS portals
  - municipal GIS portals
- Expected format:
  - shapefile
  - GeoJSON
- Refresh cadence:
  - annual verification
- Owner:
  - GIS/data engineering

## 4. Election Results

### Parliamentary / Assembly Results
- Source:
  - Election Commission of India
- Expected format:
  - official result pages
  - CSV/XLS exports
  - PDFs
- Refresh cadence:
  - after each election / by-election
- Owner:
  - central data team

### Local Body Election Results
- Source:
  - State Election Commissions
- Expected format:
  - HTML/PDF/XLS
- Refresh cadence:
  - after each local election
- Owner:
  - state research pods

## 5. Development Indicators

### Infrastructure / Education / Health / Welfare / Water / Roads
- Source:
  - data.gov.in
  - ministry dashboards
  - state open data portals
  - district statistical handbooks
- Expected format:
  - CSV/XLS/API
  - PDFs for district reports
- Refresh cadence:
  - quarterly where possible
  - annual minimum
- Owner:
  - data analytics + ETL

## 6. Legislative Accountability Data

### Attendance / Questions / Debates / Committees
- Source:
  - Lok Sabha / Rajya Sabha official portals
  - state legislative assembly portals
- Expected format:
  - HTML pages
  - PDFs
  - downloadable reports
- Refresh cadence:
  - session-wise
  - monthly rollup
- Owner:
  - parliamentary research

### Fund Utilization
- Source:
  - MPLADS / MLALADS official portals
  - department dashboards
  - RTI-backed official data if needed
- Expected format:
  - PDF/XLS/HTML
- Refresh cadence:
  - quarterly
- Owner:
  - data analytics + finance research

## 7. Promises / Manifesto Tracking

### Manifestos and Public Commitments
- Source:
  - party websites
  - archived manifesto PDFs
  - candidate official pages
- Expected format:
  - PDF
  - HTML
- Refresh cadence:
  - each election cycle
  - quarterly status verification
- Owner:
  - editorial/research team

### Completion Evidence
- Source:
  - official project reports
  - government press releases
  - department dashboards
- Expected format:
  - PDF/HTML/CSV
- Refresh cadence:
  - quarterly
- Owner:
  - research verification team

## 8. Citizen Issues and Feedback

### Internal Platform Data
- Source:
  - app submissions
- Expected format:
  - MongoDB records / API
- Refresh cadence:
  - real time
- Owner:
  - product + engineering

## Ownership Model

### Central Data Team
- constituency master
- election results
- shared schemas
- QA sign-off

### State Research Pods
- MLA rosters
- local body representatives
- state-specific portals

### GIS / Data Engineering
- boundaries
- spatial cleanup
- jurisdiction mapping

### Editorial / Verification
- manifesto extraction
- promise status review
- disputed data resolution

## Collection Rules
- Prefer official institutional source first.
- Keep raw files exactly as downloaded in `data/raw/<date>/<source>/`.
- Record checksum and manifest for every raw file.
- Normalize into schema before any DB write.
- Reject publication if QA gate fails.
- Every published row must have `source_url`.

## Immediate Work Allocation

### Week 1
- Collect ECI constituency master
- collect Lok Sabha / Rajya Sabha member data
- collect one pilot state MLA roster
- identify official GIS boundary source for that state

### Week 2
- collect one pilot district's panchayat and municipal member rosters
- ingest pilot development indicators
- ingest pilot election results

### Week 3
- QA the pilot state end to end
- run smoke + map + dashboard validation
- fix schema gaps before scaling to more states
