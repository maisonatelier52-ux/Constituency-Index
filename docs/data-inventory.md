# Data Inventory

This document defines the data we should compile for a real constituency index and how to prioritize it for rollout.

## Required Now

### 1. Office Holders
- Union Ministers
- MPs: Lok Sabha
- MPs: Rajya Sabha
- MLAs
- Panchayat Members
- Municipal Councillors
- Zila Parishad / Block Panchayat members
- Other local representatives relevant to state structure

Required fields:
- `full_name`
- `canonical_id`
- `office_level`
- `office_title`
- `jurisdiction_type`
- `jurisdiction_code`
- `country`
- `state`
- `district`
- `block`
- `panchayat_or_ward`
- `party`
- `term_start`
- `term_end`
- `status`
- `source_url`
- `source_last_updated`

Likely primary sources:
- Election Commission of India
- Lok Sabha Secretariat
- Rajya Sabha Secretariat
- State Assembly websites
- State Election Commission websites
- Panchayati Raj / Urban Local Body portals

### 2. Jurisdiction Master Data
- Parliamentary constituencies
- Assembly constituencies
- Districts
- Blocks
- Panchayats
- Municipal wards
- Villages / towns mapping where available

Required fields:
- `jurisdiction_code`
- `name`
- `jurisdiction_type`
- `parent_jurisdiction_code`
- `country`
- `state`
- `district`
- `block`
- `source_url`
- `source_last_updated`

Likely primary sources:
- Election Commission of India
- State GIS / open data portals
- Census / administrative datasets
- State local governance portals

### 3. Boundary Data
- Parliamentary constituency boundaries
- Assembly constituency boundaries
- District boundaries
- Block boundaries
- Panchayat boundaries
- Ward boundaries

Required fields:
- `jurisdiction_code`
- `boundary_geojson`
- `centroid`
- `source_url`
- `source_last_updated`

Likely primary sources:
- State GIS portals
- Survey / land records GIS datasets
- Official administrative map releases

### 4. Election Results
- Current elected representative by jurisdiction
- Recent election winners
- Vote share
- Margin of victory
- Turnout
- By-election / vacancy status

Required fields:
- `election_year`
- `jurisdiction_code`
- `candidate_name`
- `party`
- `votes`
- `vote_share`
- `result`
- `turnout_percent`
- `winning_margin`
- `source_url`

Likely primary sources:
- Election Commission of India
- State Election Commissions

### 5. Constituency Development Indicators
These are core inputs to the constituency index.

Priority categories:
- Infrastructure
- Education
- Healthcare
- Employment
- Welfare delivery
- Water and sanitation
- Roads and transport
- Environment
- Law and order

Required fields:
- `metric_name`
- `metric_category`
- `jurisdiction_code`
- `value`
- `unit`
- `period`
- `source_url`
- `source_last_updated`

Likely primary sources:
- data.gov.in
- State department dashboards
- District statistical handbooks
- Census and official annual reports

### 6. Promises / Manifesto Tracking
- Election promises
- Category of promise
- Geography impacted
- Current status
- Evidence links
- Last verified date

Required fields:
- `promise_id`
- `representative_canonical_id`
- `promise_text`
- `category`
- `jurisdiction_code`
- `status`
- `evidence_urls`
- `manifesto_source_url`
- `last_verified_at`

Likely sources:
- Party manifesto documents
- Candidate affidavits / campaign material
- Official government progress reports
- Verified news / public statements as enrichment only

### 7. Citizen Issues and Grievances
- Reported issues
- Issue category
- Location
- Status
- Deadline
- Resolution timestamps
- Citizen satisfaction
- Urgency / votes

Required fields:
- `issue_id`
- `jurisdiction_code`
- `category`
- `description`
- `lat`
- `lng`
- `created_at`
- `status`
- `deadline`
- `resolved_at`
- `satisfaction_rating`

Source:
- Internal platform data

## Optional Later

### 8. Legislative and Accountability Metrics
- Attendance
- Questions asked
- Debates participated in
- Committee memberships
- Committee attendance
- Fund utilization:
  - MPLADS
  - MLALADS
  - local body funds

Required fields:
- `representative_canonical_id`
- `period`
- `attendance_percent`
- `questions_asked`
- `debates_count`
- `committee_count`
- `fund_allocated`
- `fund_spent`
- `source_url`

Likely primary sources:
- Lok Sabha / Rajya Sabha data
- State assembly portals
- Department spending dashboards

### 9. Public Consultation / Meeting Data
- Town halls
- Public hearings
- Field visits
- Official events

Required fields:
- `representative_canonical_id`
- `event_type`
- `title`
- `date`
- `location`
- `source_url`

Likely sources:
- Official press releases
- Verified office calendars

### 10. Scheme Beneficiary and Delivery Data
- Scheme coverage by area
- Beneficiary counts
- Delivery quality / backlog indicators

Likely sources:
- Department dashboards
- Official open data portals

## Priority Rollout Order
1. Jurisdiction master data
2. Boundaries
3. Current office holders
4. Election results
5. Development indicators
6. Promises / manifesto tracking
7. Citizen issues and grievance data
8. Legislative accountability metrics

## Minimum Viable Real-Data Launch
To launch credibly with limited time, compile these first:
- current office holders
- jurisdiction master data
- constituency and local boundaries
- election winners, turnout, and margin
- a small but defensible set of development indicators
- promises / manifesto tracking
- citizen issue data

## Data Governance Rules
- Official institutional sources are primary.
- Secondary sources can enrich records but cannot be sole truth.
- Every published record must carry `source_url`.
- All imports must run through ETL and QA gates.
- No manual database edits.
