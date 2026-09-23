#!/usr/bin/env bash
# If experiment/self-heal/* or experiment/selfheal-core.js changed since the vendor commit,
# experiment/SELFHEAL_VERSION must also have changed. Enforces the "bump-on-library-change"
# invariant that keeps libSha meaningful. Compares against the vendor-landing commit (found by
# grepping for the "vendor: ai-for-qa @" commit message prefix), not main — on a fresh remote
# with unrelated history, comparing to main over-fires on the entire history (see
# wiki/merge-plan-v3.md §Cynical #2).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

base=$(git log --format='%H' --grep='^vendor: ai-for-qa @' | tail -1)
if [[ -z "$base" ]]; then
  echo "  no 'vendor: ai-for-qa @' commit found in history — nothing to compare against, skipping"
  exit 0
fi

lib_changed=$(git diff --name-only "$base"..HEAD -- experiment/self-heal/ experiment/selfheal-core.js | wc -l | tr -d ' ')
ver_changed=$(git diff --name-only "$base"..HEAD -- experiment/SELFHEAL_VERSION | wc -l | tr -d ' ')

if (( lib_changed > 0 && ver_changed == 0 )); then
  echo "  FAIL: experiment/self-heal/ or experiment/selfheal-core.js changed since $base without a SELFHEAL_VERSION bump"
  git diff --name-only "$base"..HEAD -- experiment/self-heal/ experiment/selfheal-core.js | sed 's/^/    /'
  exit 1
fi
echo "  ok: lib_changed=$lib_changed ver_changed=$ver_changed (base=$base)"
