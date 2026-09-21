# NOTICE

This repository contains code vendored from other sources. Provenance recorded here so
future contributors know what came from where.

## Vendored from prashantkothari/ai-for-qa @ dc5a87f

- `experiment/selfheal-core.js`
- `experiment/SELFHEAL_VERSION` records the pinned SHA
- `experiment/self-heal/**` — schemas, pipeline, brain, pretotype (selfheal-runtime.js,
  fixtures.js, payment-fixtures.js), docs, benchmark, tests
- Total: 33 files (32-file manifest from docs/planning/files-comparison.md + self-heal/README.md)

Vendored at natural paths under `experiment/` (this branch's existing convention — not
repo-root as originally planned; see docs/planning/ for why) — no `vendor/` prefix, per
user preference. Runtime consumption is via `experiment/harness/bundle-library.js`, which
reads 13 of these files in a fixed load order into a single injected bundle.

**Source SHA note:** the vendored SHA is `dc5a87f`, not the `599dca1c` that earlier
planning docs assumed — this branch's own "bump lib submodule" commits (predating this
consolidation) had already advanced the pin past that point. `dc5a87f` is a strict
superset of `599dca1c` (verified via `git merge-base --is-ancestor`).

**License note:** ai-for-qa (both `prashantkothari/ai-for-qa` and its `preflight7` fork)
carries no LICENSE file as of 2026-09-21. Vendoring is treated as self-owned code
consolidation (source and destination repos share the same owner). A future contributor
adding a LICENSE to either repo should update this notice.

## Vendored from prashantkothari/ai-native-test-reliability

- `README.md` content folded into this repo's own README.md (the only file with unique
  content vs. this repo's `experiment-only`/`chip-*` lineage — everything else was a
  byte-identical duplicate).
