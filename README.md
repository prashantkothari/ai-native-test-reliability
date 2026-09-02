# ai-native-test-reliability

A Playwright adapter that drives the self-heal pipeline from
[`prashantkothari/ai-for-qa`](https://github.com/prashantkothari/ai-for-qa)
against a real running SPA using **trusted** browser events.

The self-heal library is the substance; this repo is the harness. The library
is included as a git submodule under `lib/` at a pinned SHA so trial results
stay reproducible.

## Status

- **P1 slice-1** — cold-start fitness check against Excalidraw at N=3 trials
  in trusted-event mode. See `report/p1_results.md` (initial run) and
  `report/p1_v2_results.md` (post-redteam remediation with heal path
  empirically exercised). Both live on the `p1-slice` branch.

## Layout

```
harness/     Playwright adapter, translator, trial runner, bundle builder
fixtures/    Recorded authored-test descriptors
mutations/   git apply patches simulating drift (data-testid rename, etc.)
report/      Result write-ups and redteam passes
lib/         Submodule → prashantkothari/ai-for-qa (pinned SHA)
```

## Reproducing a trial run

```bash
git clone --recurse-submodules https://github.com/preflight7/ai-native-test-reliability.git
cd ai-native-test-reliability
npm install
# clone target repo (Excalidraw) separately, run its dev server on :3001
node harness/bundle-library.js
node harness/run_trials.js
cat logs/trials.jsonl
```

See `report/p1_v2_results.md` for the reproduction recipe including the
`prep_aria.patch` prerequisite and the target-fitness pre-check.
