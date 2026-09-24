# playwright_middleware — self-heal experiment monorepo

A Playwright test harness that drives the `experiment/self-heal` locator-healing library
against real running apps, using trusted browser events, and records reproducible trial
results with a hard gate: `false_heal` must stay 0 in aggregate.

## What's here

- `experiment/harness/` — the Node/Playwright runner (`run_trials.js`), library bundler
  (`bundle-library.js`), locator translator, and app-inspection scouts.
- `experiment/self-heal/` + `experiment/selfheal-core.js` — the self-heal library, vendored
  from `prashantkothari/ai-for-qa` (see `experiment/SELFHEAL_VERSION` for the pinned commit
  and `NOTICE.md` for provenance). No submodule — natural paths, one repo.
- `experiment/fixtures/`, `experiment/mutations/` — recorded test + drift-inducing patches.
- `experiment/report/` — trial write-ups (`p1_results.md`, `p2_results.md`, etc.).
- `docs/architecture-v1.md` — canonical architecture reference (8-stage self-heal loop).
- `docs/planning/` — the consolidation planning docs (how this repo got assembled).
- `wiki/` — curated, terse index. Start at `wiki/README.md`.

## Setup

```bash
cd experiment && npm install
```

**Target app.** The harness drives its trials against an external app checkout, not
committed to this repo (see `.gitignore`):

```bash
git clone <target-app-url> experiment/target_repo
cd experiment/target_repo && git checkout <pinned-sha>
```

`experiment/harness/run_trials.js` prints a clear error naming this step if
`experiment/target_repo/` is missing.

## Running

```bash
cd experiment
node harness/bundle-library.js   # produces logs/selfheal-bundle.js
node harness/run_trials.js       # runs the mutation matrix, writes logs/trials.jsonl
```

## A note on `report/*.md`

Reports predate this consolidation and are left untouched (read-only) by design — they're
a historical record. Where they cite `lib/` as a path (the old submodule location), that
path is now `experiment/self-heal/` / `experiment/selfheal-core.js` at repo structure level.
Where they cite a `libSha`, cross-reference `experiment/SELFHEAL_VERSION`'s current value
against the report's date to know whether it's still current.

## History

This repo consolidates three things that used to be separate: this monorepo, the
`ai-for-qa` self-heal library (vendored, not a submodule), and a small Playwright-adapter
proof-of-concept repo (`ai-native-test-reliability`) that turned out to be almost entirely
duplicated here already. See `docs/planning/` for the full path that led here.

## About `.claude/`

The root-level `.claude/` directory holds Claude Code session config and a curated
skills library used during development of this repo. It's optional dev tooling —
ignore it if you're not using Claude Code, or use it as a jumping-off point if you are.
