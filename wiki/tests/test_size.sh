#!/usr/bin/env bash
# Total wiki bytes must be <= 50% of source bytes under docs/.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

wiki_bytes=$(find wiki -type f -name '*.md' -exec cat {} + | wc -c)
src_bytes=$(find docs -type f -name '*.md' -exec cat {} + | wc -c)

if (( src_bytes == 0 )); then
  echo "  no source md files under docs/"
  exit 1
fi

budget=$(( src_bytes / 2 ))
if (( wiki_bytes > budget )); then
  echo "  wiki=$wiki_bytes bytes > budget=$budget (50% of src=$src_bytes)"
  exit 1
fi
echo "  wiki=$wiki_bytes / budget=$budget (src=$src_bytes)"
