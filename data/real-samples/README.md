# Real data samples

These are the actual files used to produce the real (non-synthetic) findings
described in the top-level README. Every file here is real government data,
not a demo fixture. Full provenance (source URL, resource id, retrieval
timestamp, SHA-256) for each one is recorded in
[`../source-register.csv`](../source-register.csv).

- `punjab-ger-schools-2019-2022/`, 8 files, District-wise Gross Enrollment
  Ratio in Schools of Punjab (2019-2022), one per school level x gender,
  downloaded directly from
  [data.gov.in](https://www.data.gov.in/catalog/district-wise-gross-enrollment-ratio-ger-schools-punjab).
  Ingesting these and running the anomaly engine surfaced a real finding:
  SAS Nagar (Mohali) district's GER climbs to 124-145% by 2022, well above
  every peer district, consistently across nearly every level and gender.
- `mgnrega-punjab-fy2024-25/`, MGNREGA Punjab district-wise data for
  FY2024-25 (6,784 rows), sourced from the official
  [nrega.nic.in](https://nrega.nic.in) release via a public GitHub mirror.
- `kcc-punjab-sample/`, a 5,000-row Punjab sample of the Kisan Call Centre
  dataset, pulled from data.gov.in's own Open Government Data API.

Reproduce any of these locally with the `bdd` CLI, for example:

```bash
uv run bdd ingest data/real-samples/punjab-ger-schools-2019-2022/ger_primary_boys_punjab.csv \
  --artifact-id art-ger-primary-boys \
  --source-id SRC-GER-7632443-DATAGOVIN \
  --title "District-wise GER of Boys in Primary Schools of Punjab, 2019-2022 (data.gov.in)"

uv run bdd findings --kind anomaly
```
