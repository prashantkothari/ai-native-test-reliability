#!/usr/bin/env bash
# VENDOR-TIME ONLY. Not for CI. Not for pre-commit.
# Redacts 6 vendor names from files that landed via ai-for-qa vendoring.
# Idempotent via sentinel at tools/.vendor-scrubbed (gitignored — fresh clones re-run scrub,
# which is a no-op since the source files are already redacted).
#
# Uses perl for the substitution, not sed -i: BSD sed (macOS default) does not support \b
# word-boundary escapes in extended regex (-E) — it silently fails to match, which is exactly
# what happened on first implementation (verified via Probe 4 catching 2 surviving hits in
# self-heal/pretotype/fixtures.js: "Gong/AirPods", "Amplitude-pilot"). Perl's \b is consistent
# across macOS and Linux, which this repo targets per merge-plan-v3.
#
# Run only at vendor-refresh time, when self-heal/* is re-pulled from ai-for-qa upstream.
# Do not wire this into CI or a pre-commit hook — it is not a general-purpose linter and
# will not run against files it doesn't know about (see FILES list below).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

SENTINEL=tools/.vendor-scrubbed
if [[ -f "$SENTINEL" && "${1:-}" != "--force" ]]; then
  echo "vendor-scrub: sentinel present ($SENTINEL); already run. Pass --force to re-run."
  exit 0
fi

FILES=(
  self-heal/pretotype/fixtures.js
  self-heal/pretotype/payment-fixtures.js
  self-heal/schemas/tests.html
  self-heal/tests/adversarial-validation-tests.js
  self-heal/tests/candidate-widening-tests.js
)

for f in "${FILES[@]}"; do
  [[ -f "$f" ]] || { echo "vendor-scrub: expected file missing: $f"; exit 1; }
done

for f in "${FILES[@]}"; do
  perl -pi -e 's/\b(testsigma|gong|amplitude|appsmith|immich|salesforce)\b/REDACTED/gi' "$f"
done

mkdir -p tools
date -u +%Y-%m-%dT%H:%M:%SZ > "$SENTINEL"
echo "vendor-scrub: scrubbed ${#FILES[@]} files; sentinel written"
