#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

required=(
  wiki/README.md
  wiki/INDEX.md
  wiki/architecture.md
  wiki/glossary.md
  wiki/glossary.terms
  wiki/files.md
  wiki/CHANGELOG.md
  CLAUDE.md
)

fail=0
for f in "${required[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "  missing: $f"
    fail=1
  fi
done

for f in wiki/*.md; do
  lines=$(wc -l < "$f")
  if (( lines > 80 )); then
    echo "  too long: $f ($lines lines)"
    fail=1
  fi
done

grep -q 'wiki/README.md' CLAUDE.md || { echo "  CLAUDE.md must reference wiki/README.md"; fail=1; }
exit "$fail"
