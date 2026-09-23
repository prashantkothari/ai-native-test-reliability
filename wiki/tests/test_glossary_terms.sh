#!/usr/bin/env bash
# Every non-empty line in wiki/glossary.terms must appear in wiki/glossary.md.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

fail=0
while IFS= read -r term; do
  [[ -z "$term" ]] && continue
  if ! grep -qF "$term" wiki/glossary.md; then
    echo "  missing from wiki/glossary.md: $term"
    fail=1
  fi
done < wiki/glossary.terms

exit "$fail"
