# CG-719S Generation Plan

SeaDays will generate one CG-719S PDF for each vessel represented in a user's logged sea service. The first implementation should populate Page 1 only and leave Page 2 blank for the applicant, vessel owner, or attesting party to complete and sign.

Official template reference: https://www.dco.uscg.mil/Portals/9/NMC/pdfs/forms/CG_719S.pdf

## Export Boundaries

- Generate a separate form per vessel because CG-719S Page 1 describes one vessel and one monthly service table.
- Keep generated forms tied to immutable export records so we can reproduce exactly what the user submitted.
- Do not store SSNs. Leave the Social Security Number field blank unless we later add an explicit, reviewed secure handling flow.
- Leave Page 2 blank for MVP. The user and owner workflows can fill signatures, attestation, and owner contact details later.
- Treat non-owned vessels as requiring an owner/attestor packet before final submission.

## Backend Modules

`Cg719sExportService`

- Public entry point for exports.
- Accepts a profile ID and optional filters such as credential goal, date range, or vessel IDs.
- Loads the profile, vessels, and trips, validates readiness, and returns one generated PDF per vessel.

`SeaServiceGroupingService`

- Groups trips by vessel for the MVP.
- Future option: split by vessel plus service role if USCG-ready output needs one role per form.
- Excludes deleted trips and can filter to qualifying service only when the export mode requires it.

`Cg719sFieldMapper`

- Converts profile, vessel, and aggregated trip data into CG-719S AcroForm field values.
- Owns the PDF field-name constants so the mapping is testable and not scattered through route code.

`SeaServiceAggregator`

- Builds month/year day totals for the Page 1 service table.
- Calculates total days served, average hours underway, average distance offshore, Great Lakes days, shoreward days, and seaward days.
- Produces warnings when a trip has ambiguous waters or missing underway hours.

`PdfFormFiller`

- Uses `pypdf` to read the CG-719S template and write filled field values into a copy.
- Keeps the original template immutable.
- Can later flatten the PDF if a submission workflow needs non-editable output.

`ExportValidationService`

- Checks whether each vessel packet is ready.
- Returns missing fields, warnings, and blocking errors for the UI.
- Examples: missing legal name, missing vessel identifier, missing gross tons, missing water body, missing owner name, or missing owner email/phone for a non-owned vessel.

`OwnerAttestationWorkflow`

- Later module for non-owned vessels.
- Creates owner request links, tracks signature status, and attaches completed Page 2 or owner letters to the export packet.

`ExportStorageService`

- Stores generated PDFs in R2 or another object store.
- Records object key, checksum, template version, generated timestamp, and export status.

## Page 1 Field Mapping

The attached CG-719S template exposes AcroForm fields that map cleanly to our current schema.

Applicant fields:

- `LastName`, `FirstName`, `MiddleName`: `profiles.legal_last_name`, `legal_first_name`, `legal_middle_name`.
- `RefNum`: `profiles.mariner_reference_number`.
- `SSN`: leave blank for now.

Vessel fields:

- `OfficialNumber`: primary vessel identifier, preferring documentation number, then state registration.
- `VesselName`: vessel legal name, not the informal display name.
- `LengthFeet`, `LengthInches`: `vessels.length_overall_inches`.
- `WidthFeet`, `WidthInches`: `vessels.beam_inches`.
- `DepthFeet`, `DepthInches`: `vessels.draft_inches`.
- `GrossTons`: `vessels.gross_tons`.
- `Propulsion`: `vessels.propulsion_type`, rendered as a USCG-friendly label.
- `ServedAs`: distinct trip service roles for that vessel, rendered as labels such as `Master` or `Mate`.

Service table fields:

- Month/year and days fields come from grouped `trips.trip_date` and `trips.day_count`.
- The aggregator should fill rows chronologically and stop with a validation error if there are more month/year buckets than fit on one Page 1 table.
- `DaysOnVsl`: sum of `trips.day_count` for that vessel export.
- `AvgHoursUnderway`: weighted average of `trips.underway_hours` across logged trips.
- `AvgDistanceOffShore`: average `trips.distance_offshore_nm` when present; otherwise leave blank and warn.
- `DayOnGrtLks`: sum of `day_count` where `trips.great_lakes` is true.
- `DaysOnWaterShoreward`: sum of `day_count` that is shoreward of the boundary line.
- `DaysSeaward`: sum of `day_count` that is seaward of the boundary line.
- Body of water field: distinct `trips.water_body_name` values for the vessel, compacted into a readable list.

## Domain Rules To Confirm

- Boundary-line mapping must be more precise than our current `inland`, `near_coastal`, `offshore`, and `great_lakes` labels. We should add an explicit `boundary_line_category` or rule output before promising final USCG-ready calculations.
- Mixed service roles on the same vessel may need either a comma-separated `ServedAs` value or separate forms. We should verify before launch.
- `day_count` currently treats 4 or more underway hours as one sea day. That is useful for OUPV progress, but export rules should remain configurable by credential path.
- We should keep an audit trail of every edit that changes an exported field after a PDF has been generated.

## First Implementation Slice

1. Add a backend `forms` package with field constants, grouping, aggregation, and PDF fill helpers.
2. Add tests using a tiny fixture PDF or the official template when available locally.
3. Add `GET /v1/exports/cg-719s/readiness` to show missing data by vessel.
4. Add `POST /v1/exports/cg-719s` to generate one Page 1 PDF per vessel and store it.
5. Add a frontend export review screen that shows each vessel packet, readiness warnings, and download links.
