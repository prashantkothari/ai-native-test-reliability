# `.claude/skills/` — repo-shadowed Claude skills

This directory is the **contract** for Claude Code skills used by this project.
The **runtime** lives at `~/.claude/skills/` (user-global). Drift between the two
is a CI-checkable failure (see `scripts/skills_sync_check.sh`).

## Why shadow

CI cannot reach `~/.claude/skills/`. Without a repo copy, `test_skill_triggers.py`
would be a half-bridge — green locally, ungated on PRs.

## The five tracked skills

| Skill | Purpose | Has `## Triggers`? |
|---|---|---|
| `plan-template` | 6-section plan structure | ✅ |
| `session-codify` | end-of-session handoff artifact | ✅ |
| `pattern-promoter` | scan lessons.md → Gate proposals | ✅ |
| `redteam` | attack-plan / steelman / verdict | ✅ |
| `ship` | 10-step review + PR + merge pipeline | ✅ |

Each `## Triggers` section is **source-of-truth**. CLAUDE.md links here; it does
not duplicate the trigger logic.

## Sync workflow

- `make skills-check` — pytest gates: `## Triggers` present
- `make skills-sync-check` — diffs repo vs `~/.claude/skills/`; exits 0 if matched OR if `~/.claude/skills/` absent (CI)
- `make skills-sync` — bidirectional, mtime-based. Prompts before overwriting either side.

Edit the repo copy. Run `make skills-sync` to push to runtime. CI runs
`skills-check` + `skills-sync-check` via `make pr-ready`.
