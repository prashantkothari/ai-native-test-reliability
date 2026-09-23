#!/usr/bin/env bash
# Every relative markdown link target in wiki/**/*.md resolves from the link's directory.
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

fail=0
while IFS= read -r f; do
  dir="$(dirname "$f")"
  while IFS= read -r link; do
    case "$link" in
      http://*|https://*|mailto:*|'#'*) continue ;;
    esac
    target="${link%%#*}"
    [[ -z "$target" ]] && continue
    if [[ ! -e "$dir/$target" ]]; then
      echo "  broken link in $f -> $target"
      fail=1
    fi
  done < <(grep -oE '\]\([^)]+\)' "$f" | sed -E 's/^\]\(//;s/\)$//')
done < <(find wiki -type f -name '*.md')

exit "$fail"
