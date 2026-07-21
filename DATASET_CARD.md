# TechRole Index observed publication dataset

## Dataset summary

TechRole Index publishes an evolving, aggregated dataset of official IT vacancy publications. It is designed for reproducible analysis of publication flow by UTC creation date, profession, seniority, region and salary tax status. It does **not** represent the number of vacancies that were simultaneously active on a given day.

The product and field documentation is primarily Russian. Stable machine identifiers, field names and this card also provide English context.

## Scope and unit of observation

One row represents:

`metric_date × source × profession × seniority × region × salary_tax_status × currency`

The source observations come from the official open-data API of the Russian federal employment portal «Работа России». TechRole Index classifies and aggregates publication records into a versioned taxonomy of 50 technology professions. Provider payloads, contact fields, individual résumés and user data are not published in the dataset.

Every exported JSON record contains `current_market_claim=false`. Publication dates are historical record-creation dates, not reconstructed active-state snapshots.

## Available representations

| Representation | Purpose |
| --- | --- |
| `/open-data-daily` | Human-readable dataset landing, limitations and field dictionary |
| `/open-data-daily.json` | Metadata plus 27-field normalized records |
| `/open-data-daily.csv` | Flat UTF-8 table with 30 actual columns, including provenance URLs |
| `/open-data-daily.csv-metadata.json` | W3C CSVW metadata with datatypes, nullable cells, composite primary key and provenance |
| `/open-data-daily.schema.json` | Strict JSON Schema Draft 2020-12 contract |
| `/open-data-daily.croissant.json` | MLCommons Croissant 1.1 metadata, typed fields, composite key and lineage |
| `/catalog.jsonld` | W3C DCAT 3 catalog with Dataset, direct distributions, DataService and provenance |
| `/datapackage.json` | Frictionless Data Package catalog |
| `/data-status.json` | Materialization status and layer provenance |
| `/citation` | Citation guidance, CSL-JSON, BibTeX and RIS |

The canonical host is supplied by the production deployment. Temporary tunnel hosts must not be used in publications or catalog registrations.

## Data collection and processing

1. The provider retrieves only documented JSON API responses using bounded `GET` requests.
2. An allowlist removes contact details and fields that are not needed for aggregate analysis.
3. Deterministic rules map observations to profession and seniority identifiers. A bounded local model may assist only uncertain records and cannot override confidence limits.
4. PostgreSQL materialization groups records by UTC creation date and the dimensions above.
5. Quality gates compare materialized totals with classified source totals, keep tax-status groups separate and reject invalid proportions or salary leaks.
6. Published rows retain source identifiers, ingestion/materialization timestamps and a transform version.

## Missing values and salary statistics

- `null` means that no publishable value is available; it is not an observed zero.
- Salary midpoint statistics require complete RUB ranges and the published minimum sample size.
- Values below the sample gate remain `null`.
- `gross`, `net` and `unknown` are separate groups. Unknown is never silently converted to gross.
- Coverage, sample size and confidence must accompany any reported salary statistic.

## Intended uses

- reproducible descriptive research on historical vacancy publication flow;
- education and examples of provenance-aware data engineering;
- comparisons that preserve date range, sample size, source and transform version;
- testing tabular ingestion, CSVW, JSON Schema and Croissant-compatible tooling.

## Out-of-scope uses

The dataset must not be presented as a live market census, a guarantee of demand or salary, an estimate of all vacancies, or an individual hiring/employment decision system. It is not suitable for inferring protected or personal characteristics.

## Privacy and responsible use

Public exports contain aggregated counts and salary summaries. They exclude contact persons, contact lists, addresses, raw provider payloads, account data, support requests and Premium-only prepared metrics. Small salary samples are suppressed by a quality gate.

## Terms and attribution

The upstream portal identifies its publication as open data, links to the Russian federal standard conditions for open-data use and requires attribution to `trudvsem.ru` when information is copied. The machine metadata links to the [official mirror of those standard conditions](https://rospatent.gov.ru/ru/opendata/uslovia-od) and to the [«Работа России» dataset page](https://trudvsem.ru/opendata/datasets).

TechRole Index does not unilaterally relicense the source-derived dataset as CC BY. A separate code or additional-rights license must be explicitly selected by the owner. Before commercial production use, obtain legal review of the current source terms and intended processing.

## Citation and reproducibility checklist

When citing a number, include:

- TechRole Index and the canonical dataset URL;
- UTC creation-date period;
- profession, seniority, region and salary tax status;
- publication count or salary sample size;
- transform version and materialization date;
- «Работа России» as the observation source;
- the limitation that publication flow is not simultaneous active-vacancy count.

Repository users can start from [`CITATION.cff`](CITATION.cff). The live site also provides `/citation.json`, `/citation.bib` and `/citation.ris`.
