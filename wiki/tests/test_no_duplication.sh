#!/usr/bin/env bash
# wiki/architecture.md must be < 30% of SELF_HEAL_ARCHITECTURE_v1.md line count.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

src=docs/architecture-v1.md
wiki=wiki/architecture.md

[[ -f "$src"  ]] || { echo "  missing $src";  exit 1; }
[[ -f "$wiki" ]] || { echo "  missing $wiki"; exit 1; }

src_lines=$(wc -l < "$src")
wiki_lines=$(wc -l < "$wiki")
budget=$(( src_lines * 30 / 100 ))

if (( wiki_lines >= budget )); then
  echo "  wiki=$wiki_lines lines >= 30% of src=$src_lines (budget=$budget)"
  exit 1
fi
echo "  wiki=$wiki_lines / budget=$budget (src=$src_lines)"
