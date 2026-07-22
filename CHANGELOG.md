# Changelog

All notable public changes to TechRole Index are recorded here. Versions follow Semantic Versioning for the application; dataset observations retain their own ingestion period, schema version and provenance.

## [Unreleased]

- Added a third, provenance-rich salary benchmark layer for all 50 professions using Habr Career H1 2026 (`n=45,226`) plus explicitly labeled grade references; exact, related, technology and category scopes never overwrite vacancy metrics.
- Expanded exact salary coverage from 29 to 36 professions with dated public SEO medians from filtered Habr Career calculator pages; account-gated values are not extracted and unknown sample/tax fields remain explicit.
- Added the exact public manual-testing median and an opt-in Dagster audit that detects metadata drift without auto-updating snapshots or reading account-gated data; coverage is now 37 exact, 11 related and 2 category-only roles.
- Updated profession pages, sources and data-status schema 1.3 with regional salary references, source periods, tax status, sample sizes and mapping caveats.
- Added a no-charge payment sandbox, server-priced 30-day Premium orders, auditable terms acceptance, idempotent webhooks/refunds and payment result pages.
- Added fail-closed YooKassa and Robokassa adapters. The Robokassa path signs redirects/ResultURL receipts, acknowledges duplicate notifications safely, supports Password3 refund requests and reconciles pending refunds; real charges remain disabled.
- Added an admin-only payment readiness checklist that exposes no credentials and a separate stable-HTTPS guard that prevents live charges on temporary hosting.
- Made category titles and descriptions deterministic so transient API failures cannot publish incomplete SEO metadata.
- Documented the confirmed self-employed NPD path, Robokassa as primary with automatic SMZ receipts, YooKassa as reserve, and a concrete owner-only domain/VPS cutover plan.
- Updated Apache ECharts to 6.1.0 and forced patched PostCSS 8.5.19 after dependency audit.

## [0.1.0] - 2026-07-21

### Added

- Russian-language catalog of 50 IT professions with SSR pages, categories, comparison, research and methodology views.
- Separate prepared baseline and observed publication layers; unknown gross/net status is never silently converted into gross salary.
- Public daily JSON/CSV exports with JSON Schema Draft 2020-12, W3C CSVW, MLCommons Croissant 1.1, W3C DCAT 3 and Frictionless Data Package metadata.
- Stable citation landing page plus CSL-JSON, BibTeX, RIS and repository-level CFF 1.2 metadata.
- Twelve original methodology and data-quality articles, each with Article JSON-LD and its own portable citation formats.
- RSS, sitemap, robots, `llms.txt`, `llms-full.txt`, `ai-index.json`, RFC 9264 Linkset, provenance/status and research endpoints.
- FastAPI/PostgreSQL/Redis/Celery/Dagster backend, optional official CBR rates and guarded vacancy providers.
- Server-side Premium entitlement, CSRF protection, Redis auth limits, privacy-bounded logs/metrics and production fail-closed configuration.
- Reproducible CI for backend, frontend, Compose, browser accessibility/performance, full sitemap crawl, CFF, Croissant and full-history secret scanning.
- Production-like standalone preview behind a loopback-only proxy and Tailscale Funnel.

### Verified

- Backend: Ruff, mypy and 78 pytest tests.
- Frontend: ESLint, TypeScript, 37 Vitest tests, 26 Playwright scenarios and a 57-route standalone build.
- External HTTPS smoke: 85 sitemap URLs, all browser assets, 50 AI entities, 691 materialized daily slices, schema/CSVW/Croissant/DCAT/Linkset/citation contracts and conditional `304` responses.
- Local `qwen3.6:27b` structured-output benchmark: 20/20 exact synthetic domain cases and 3/3 required abstentions.

### Known limitations

- The current `*.ts.net` preview is beta, bandwidth-limited, machine-dependent and not an availability-guaranteed production deployment.
- The HH provider remains disabled without separately documented commercial-use permission.
- Observed source records with unknown tax status remain separate from the prepared gross baseline.
- No real payment provider is configured.
- Public availability does not itself grant a software or data license; applicable source terms and a future owner-selected code license must be evaluated separately.

[Unreleased]: https://github.com/Platoonzurflow/techrole-index/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Platoonzurflow/techrole-index/releases/tag/v0.1.0
