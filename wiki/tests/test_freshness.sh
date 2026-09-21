#!/usr/bin/env bash
# Last-verified must be present; warn if >14d, fail if >30d.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

line="$(grep '^Last-verified:' wiki/README.md || true)"
[[ -n "$line" ]] || { echo "  Last-verified header missing"; exit 1; }

date_str="${line#Last-verified: }"
# Parse YYYY-MM-DD portably.
if date -j -f '%Y-%m-%d' "$date_str" +%s >/dev/null 2>&1; then
  lv_epoch=$(date -j -f '%Y-%m-%d' "$date_str" +%s)
else
  lv_epoch=$(date -d "$date_str" +%s)
fi
now_epoch=$(date -u +%s)
age_days=$(( (now_epoch - lv_epoch) / 86400 ))

if (( age_days > 30 )); then
  echo "  Last-verified is $age_days days old (>30)"
  exit 1
fi
if (( age_days > 14 )); then
  echo "  WARN: Last-verified is $age_days days old (>14)"
fi
echo "  age=${age_days}d"
