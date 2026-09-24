#!/usr/bin/env bash
# home-repo-diagnostic.sh — a read-only diagnostic for the /Users/prashant/.git
# repo situation. NEVER runs a destructive command; only prints what's there.
#
# The user's actual $HOME (/Users/prashant/) is a git repo — it was initialized
# there at some point (likely by accident, or as an early experiment to track
# .claude/ config). Working tree drifted 15+ files over ~13 days of normal
# Claude Code usage. Local `main` pointer stuck at an old SHA.
#
# The recommendation is: STOP tracking $HOME as a git repo. Move to a properly-
# scoped setup (e.g., ~/.claude-config/.git tracking just .claude/, or a
# dotfiles repo pattern). This script does NOT do that — it only diagnoses.
# The migration is a real change the repo owner should make deliberately.
#
# To run:
#   bash tools/home-repo-diagnostic.sh
set -euo pipefail

if [ ! -d "/Users/prashant/.git" ]; then
  echo "no /Users/prashant/.git — home-dir repo not present. Nothing to diagnose."
  exit 0
fi

cd /Users/prashant
echo "=== /Users/prashant/.git ==="
echo "HEAD:      $(git rev-parse HEAD)"
echo "HEAD age:  $(git log -1 --format='%ai (%ar)')"
echo "Current branch: $(git branch --show-current 2>/dev/null || echo 'detached')"
echo ""
echo "=== tracked file count ==="
echo "$(git ls-files | wc -l | tr -d ' ') tracked files"
echo ""
echo "=== working-tree drift (git status --short) ==="
git status --short --branch 2>&1 | grep -v '^warning:' | head -30
echo ""
echo "=== recommendation ==="
cat <<'REC'
Options, ordered by safety:

1. LEAVE IT ALONE (safest, current default). The dirty tree isn't
   affecting anything downstream; the .claude/* files it tracks are
   just old snapshots of session config that has since evolved.

2. STOP TRACKING $HOME (recommended if you're willing to make the change).
   The correct scope for tracking `.claude/` is a purpose-built dotfiles-style
   repo, not $HOME itself. Rough migration:
     git init ~/.claude-config     # a new repo, scoped to just .claude/
     # move the config content there, symlink from ~/.claude → the new repo
     # then: rm -rf /Users/prashant/.git   (only after confirming the new setup works)
   This is a real, multi-hour reorganization — do it deliberately, when you
   have time to verify each step.

3. COMMIT THE CURRENT DRIFT. If you actually want to preserve the current
   .claude/* state as it stands:
     cd /Users/prashant && git add -p .claude/ && git commit
   BUT do NOT `git add -A` or `git add .` from $HOME — it will stage .ssh/,
   .aws/, .cache/, .anydesk/, and anything else Finder or an app has
   accumulated in your home directory.

This script prints what's there. It does not execute any of the above.
REC
