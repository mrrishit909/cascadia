---
name: dataset-verification
description: Audit a project's proposed data source for license, access, schema, and reproducibility before any ingestion code is written. Use whenever a project's dossier names a public data source (NYC TLC, USGS, NASA Exoplanet Archive, OpenAlex, NOAA, NVD, GTFS, etc.) or before deciding to use a synthetic fixture instead.
---

# Dataset Verification

**When:** Before Gate G1 closes, and before the Data Engineering Specialist writes any ingestion script.
**Input:** the project dossier's "Source and data strategy" line; `docs/extracted/MASTER_REQUIREMENTS.md`'s source registry for known URLs.

## Procedure

1. Fetch the provider's actual current documentation (not from memory) for the named source. Record: canonical URL, access method, current rate limits, license/terms of use, exact fields and units available, update cadence.
2. Check redistribution terms specifically — a verified source page proves the source exists, not that every field is redistributable in a public static-hosted bundle.
3. If any term is unverified or the data doesn't actually cover what the dossier assumes, decide now: scope down to what's verified, or switch to an explicitly labeled synthetic fixture. Do not proceed on an unverified assumption.
4. Record the SHA-256 of any raw snapshot actually downloaded, plus the exact query/parameters used to fetch it.
5. Write the data manifest entry (`specifications/DATA_CONTRACT.yaml`): provider, URL, access date, license decision, fields, units, time zone/CRS, refresh cadence.

**Output:** a signed-off data manifest entry and a go/no-go/synthetic decision.
**Failure condition:** ingestion code written against a source whose license or field availability was never actually checked.
**Recovery:** If a source's license/redistribution terms can't be confirmed within a reasonable check, default to the synthetic-fixture path immediately rather than blocking the project indefinitely on an unanswerable licensing question.
