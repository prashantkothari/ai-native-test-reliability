#!/usr/bin/env bash
# Asserts experiment/SELFHEAL_VERSION exists, non-empty, and contains a valid git SHA prefix.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

f=experiment/SELFHEAL_VERSION
[[ -f "$f" ]] || { echo "  missing: $f"; exit 1; }
[[ -s "$f" ]] || { echo "  empty: $f"; exit 1; }

content=$(tr -d '[:space:]' < "$f")
if ! [[ "$content" =~ ^[0-9a-f]{7,40}$ ]]; then
  echo "  invalid SHA in $f: '$content'"
  exit 1
fi
echo "  ok: $f = $content"
