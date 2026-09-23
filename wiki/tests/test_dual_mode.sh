#!/usr/bin/env bash
# Asserts each dual-mode file (must run in both Node vm-context AND browser IIFE) loads
# cleanly under `node -e require(...)`. Catches an accidental top-level browser-only API
# (window.crypto, document., fetch) that would break the Node-side path in run_trials.js.
# Does NOT catch a browser-only API referenced only inside a function body that's never
# called at require-time — see wiki/merge-plan-v3.md §Cynical #3 for the known limitation.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

dual_mode_files=(
  experiment/self-heal/schemas/false-heal.js
  experiment/self-heal/schemas/flywheel-event.schema.js
  experiment/self-heal/schemas/validator.js
)

fail=0
for f in "${dual_mode_files[@]}"; do
  [[ -f "$f" ]] || { echo "  missing: $f"; fail=1; continue; }
  if ! node -e "require('./$f')" 2>/dev/null; then
    echo "  FAIL: $f cannot be require()'d from Node (likely browser-only API introduced)"
    fail=1
  else
    echo "  ok: $f"
  fi
done
exit "$fail"
