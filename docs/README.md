# Telefonak documentation

The **code is the source of truth.** These files describe the application as implemented.

Start here:

| Document | What it covers |
|---|---|
| [README.md](../README.md) | Product overview, setup, how to run the three apps, testing |
| [10_ARCHITECTURE.md](10_ARCHITECTURE.md) | Current system architecture |
| [06_DATABASE.md](06_DATABASE.md) | Schema overview, `ensureDatabase`, `schema_migrations`, first-production baseline |
| [07_API_SPECIFICATION.md](07_API_SPECIFICATION.md) | Current HTTP API (from `backend/routes/`) |
| [14_AUTHENTICATION_ARCHITECTURE.md](14_AUTHENTICATION_ARCHITECTURE.md) | Customer OTP vs admin email/password |
| [05_ADMIN_PANEL.md](05_ADMIN_PANEL.md) | Admin Web as implemented |
| [13_IOS_DEVELOPMENT_WORKFLOW.md](13_IOS_DEVELOPMENT_WORKFLOW.md) | Native iOS / Expo workflow |
| [../backend/security-tests/README.md](../backend/security-tests/README.md) | API security test harness |
| [../REFACTORING_PLAN.md](../REFACTORING_PLAN.md) | Historical 2026-09-01 audit snapshot (not a product README) |

## Historical planning docs (July 2026)

These were written as product/planning contracts. They still have context, but they **do not** match the running MVP in several places (password login, port 5000, phones-only wording, incomplete admin). Do not implement against them.

- [01_PRODUCT_VISION.md](01_PRODUCT_VISION.md)
- [02_MVP_SCOPE.md](02_MVP_SCOPE.md)
- [03_USER_JOURNEY.md](03_USER_JOURNEY.md)
- [04_FEATURES.md](04_FEATURES.md)
- [08_UI_UX_GUIDELINES.md](08_UI_UX_GUIDELINES.md)
- [09_SECURITY.md](09_SECURITY.md)
- [11_TESTING_STRATEGY.md](11_TESTING_STRATEGY.md)
- [IMPLEMENTATION_BACKLOG.md](IMPLEMENTATION_BACKLOG.md)

Empty placeholders (no content): `07_API_SPEC.md`, `08_DESIGN_SYSTEM.md`, `09_NON_FUNCTIONAL_REQUIREMENTS.md`, `10_CURSOR_RULES.md`, `11_DEVELOPMENT_ROADMAP.md`, `12_DECISIONS.md`.
