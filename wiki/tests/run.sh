#!/usr/bin/env bash
# Wiki test suite entrypoint. Runs every test_*.sh in this dir.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$(git rev-parse --show-toplevel)"

fail=0
for t in "$DIR"/test_*.sh; do
  name="$(basename "$t")"
  if bash "$t"; then
    echo "PASS  $name"
  else
    echo "FAIL  $name"
    fail=1
  fi
done
exit "$fail"
