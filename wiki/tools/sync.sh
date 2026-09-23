#!/usr/bin/env bash
# Weekly wiki sync. Runs in CI + locally. Idempotent.
# - Diffs tracked source files against wiki/files.md.
# - Always bumps Last-verified.
# - Sets Drift-open: yes/no.
# - Writes wiki/.sync-status.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

README="wiki/README.md"
STATUS="wiki/.sync-status"
TODAY="$(date -u +%Y-%m-%d)"

# Scope: source files under docs/, excluding READMEs.
drift=0
missing=()
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  case "$(basename "$f" | tr '[:upper:]' '[:lower:]')" in
    readme*|index.md) continue ;;
  esac
  if ! grep -qF "$f" wiki/files.md; then
    drift=1
    missing+=("$f")
  fi
done < <(git ls-files 'docs/*' 'docs/**/*')

# Bump Last-verified (always) and Drift-open (yes/no).
if [[ "$drift" -eq 1 ]]; then
  drift_val="yes"
else
  drift_val="no"
fi

# Portable in-place edit (macOS + Linux).
tmp="$(mktemp)"
awk -v today="$TODAY" -v drift="$drift_val" '
  BEGIN { seenLV=0; seenDO=0 }
  /^Last-verified:/ { print "Last-verified: " today; seenLV=1; next }
  /^Drift-open:/    { print "Drift-open: " drift; seenDO=1; next }
  { print }
' "$README" > "$tmp"
mv "$tmp" "$README"

grep -qF "Last-verified: $TODAY" "$README" || {
  echo "sync: FAILED — could not update Last-verified in $README" >&2
  exit 1
}

{
  echo "status: ok"
  echo "date: $TODAY"
  echo "drift: $drift_val"
  if [[ ${#missing[@]} -gt 0 ]]; then
    echo "missing:"
    for m in "${missing[@]}"; do echo "  - $m"; done
  fi
} > "$STATUS"

echo "sync: ok drift=$drift_val date=$TODAY"
