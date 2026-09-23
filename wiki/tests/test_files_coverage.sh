#!/usr/bin/env bash
# Every tracked file under docs/ (excluding READMEs) must appear in wiki/files.md.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

fail=0
while IFS= read -r f; do
  case "$(basename "$f" | tr '[:upper:]' '[:lower:]')" in
    readme*|index.md) continue ;;
  esac
  if ! grep -qF "$f" wiki/files.md; then
    echo "  missing from wiki/files.md: $f"
    fail=1
  fi
done < <(git ls-files 'docs/*' 'docs/**/*')

exit "$fail"
