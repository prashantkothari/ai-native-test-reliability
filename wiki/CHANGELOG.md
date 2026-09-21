# Wiki Changelog

Append-only. One line per sync run or manual edit. Newest at top.

- 2026-09-21 — consolidation S3 (wiring): harness paths repointed at experiment/self-heal/,
  SELFHEAL_VERSION added, submodule removed, 3 new wiki-tests added (test_selfheal_version,
  test_selfheal_version_bump, test_dual_mode), README.md + NOTICE.md added, docs/planning/
  created for the 6 full-length planning docs (moved out of wiki/ to respect the 80-line cap).
- 2026-09-21 — consolidation S2 (vendor): 33 files vendored from prashantkothari/ai-for-qa @
  dc5a87f (corrected from merge-plan-v3's assumed 599dca1c), scrubbed via tools/vendor-scrub.sh
  (perl-based after a BSD-sed \b bug was caught by Probe 4).
- 2026-09-21 — consolidation S1: consolidated-main built from chip-c-a1-scaffold merged with
  chip-d-legacy-target (S0 audit found neither was an ancestor of the other; the originally
  assumed canonical branch, claude/ai-native-test-reliability-011333, was a strict ancestor
  of both and superseded).
- 2026-09-21 — init: created wiki skeleton, tests, sync script, CI workflow.
