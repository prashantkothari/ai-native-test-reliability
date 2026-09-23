---
name: ship
description: >
  Full expert code review + doc update + sanity checks + PR creation + merge-to-main workflow.
  Invoke when the user says "/ship", "ship it", "ship this", "ship to main", "PR this",
  "merge this", "review and ship", "review and merge", "expert review and ship", "let's ship",
  "wrap this up and merge", or any clear synonym signaling intent to finalize work and merge.
  Runs a 10-step pipeline: preflight → multi-domain expert review (FE / backend / API / DB / AI
  / URLs / args / errors / copy) → half-bridge gap check → silent-failure check (Gate 16) →
  edge case analysis → impacted-module review → doc hygiene update (TODO / BUGS / LESSONS /
  CLAUDE.md) → local sanity checks → sync with origin/main → push + create PR + merge-commit
  to main per CLAUDE.md B1 policy. Do NOT invoke for in-progress exploration or scoping; this
  skill is the SHIPPING step. The expert review IS the redteam pass for shippable work — do
  not double-invoke /redteam alongside /ship.
---

# Ship — expert review and merge-to-main

The user's standard ship workflow, captured as a sequential 10-step pipeline. Run sequentially.
Never skip a HARD step without an explicit acknowledged reason.

---

## Triggers

**Auto-invoke** when the user says any of: "ship it" / "ship this" / "ship to main" /
"PR this" / "merge this" / "review and ship" / "review and merge" / "expert review and
ship" / "let's ship" / "wrap this up and merge" / "/ship", or any clear synonym signaling
intent to finalize work and merge.

**Do NOT invoke for:**
- In-progress exploration or scoping (this skill is the SHIPPING step, not the exploring step)
- Plan-mode work (finish planning first)
- Throwaway branches never intended to merge

**Relationship to `/redteam`:** the expert review in step 1 IS the redteam pass for shippable
work. Do **not** double-invoke `/redteam` alongside `/ship` — they cover the same ground.
For high-blast-radius PRs (auth, retrieval scoring, schema migrations, LLM provider changes),
step 7 invokes `/ultrareview` instead.

> **Source-of-truth contract: this section.** CLAUDE.md indexes here. Do not duplicate trigger
> logic in CLAUDE.md prose — link to this section instead. (C4-a, 2026-05-24.)

---

## 0. Preflight — confirm we're in a ship-able state ⛔ HARD

```bash
git status --short                          # working tree clean except PR-bound changes
git branch --show-current                   # on a feature branch, NOT main
git log --oneline origin/main..HEAD         # what commits will go in the PR
git diff origin/main..HEAD --stat | tail -5 # rough scope (files / lines changed)
```

Stop and ask if:
- Working tree has unstaged changes unrelated to the PR
- Currently on `main` (this skill ships TO main, not FROM main)
- The branch is >5 commits ahead of main AND scope wasn't planned that way

---

## 1. Expert code review — multi-domain ⛔ HARD

Review the diff against `origin/main` covering every domain. For each, NAME what you reviewed and what you found — do not just check the box.

| Domain | Specific checks |
|---|---|
| **Frontend** | Type contracts use `frontend/src/types/generated.ts` (NOT hand-written, per B6); design tokens only (Gate 11-CSS); route guards complete (Gate 12); `tenant_id` from `session.workspace.tenant_id`, never hardcoded (Gate 4); no `00000000-…-0099` demo UUIDs in pages/components |
| **Backend** | Transaction boundaries declared in docstring (Gate 8); LLM calls have explicit `max_retries` + `timeout` + mode (Gate 7); no f-string SQL (Gate 2); every `WHERE` clause includes `tenant_id` (Gate 4); no `print()` in services/routers (Gate 2) |
| **API** | URL string matches exactly between FE caller and BE `@router.X("/path")` (Gate 0 #1); Pydantic response model matches TS consumer shape (B6 generated types); error responses don't leak schema or stack traces (Gate 2) |
| **DB** | Schema changes via Alembic ONLY (B4/B5); `make db-heads-check` returns single head (B7); every new column has populated value path (default OR backfill); new query patterns have indices; RLS preserved |
| **AI / Retrieval / Ingest** | Boundary contracts validated (Gate 16-2 — case-fold / type translators have unit tests); variant provenance loud (Gate 11-Variant + G7-7/G7-8); deterministic floor exists for every probabilistic stage (G7-4); boot probe covers new backends (G7-8); zero-output stages emit metrics (G7-3) |
| **URLs / args** | Exact match FE↔BE path strings; encoding/decoding handled; query vs path param chosen deliberately; no parameter renaming in flight |
| **Errors** | Every NEW `except` clause satisfies Gate 16-3: re-raises after `logger.critical(... exc_info=True)`, OR increments a /health metric, OR carries `# fail-silent intentional: <reason>` annotation |
| **Copy** | User-facing strings reviewed for tone; no `Lorem Ipsum` / `TODO` / `FIXME` / placeholder text shipped; commit messages reference Gate / BUG ID where applicable |

---

## 2. Half-bridge / gap check ⛔ HARD

The PR must not ship half-implemented contracts.

```bash
# Vulture for orphan code (Gate 15)
$VENV_PY -m vulture backend/services/ --min-confidence 80
```

Verify:
- [ ] Every NEW function has at least one caller
- [ ] Every NEW endpoint is reachable from the frontend (or has a documented out-of-band caller)
- [ ] Every NEW DB column has a populated value path
- [ ] Every NEW config knob has a docstring or CLAUDE.md entry
- [ ] Every NEW error path has been exercised (or carries a comment "no test — covered by [X]")

---

## 3. Silent-failure check (Gate 16-3) ⛔ HARD

```bash
git diff origin/main..HEAD -- '*.py' | grep -B0 -A 3 "^+.*except "
```

Each new `except` must satisfy ONE of:
- Re-raise after `logger.critical(... exc_info=True)`, OR
- Increment a /health metric AND surface it, OR
- Carry `# fail-silent intentional: <one-line reason>` annotation

If any unjustified silent catch, fix before continuing.

---

## 4. Edge case analysis

For each NEW code path, state which edge cases were considered:

- Empty input (list, string, dict)
- `None` / null
- Concurrent access (race conditions)
- Timeout / network failure
- Large input (DoS via volume)
- Malformed input (injection, encoding)
- Multi-tenant isolation (Gate 4)

State which were tested AND which were judged not-applicable (with reason).

---

## 5. Impacted-module review (not just the diff)

Find callers of changed functions; verify their assumptions still hold:

```bash
# Files changed in this PR
git diff origin/main..HEAD --name-only

# For each modified function name, grep for callers
# (Replace <fn_name> with each function you changed)
grep -rn "<fn_name>" backend/ frontend/ --include="*.py" --include="*.ts" | grep -v "<file_you_changed>"
```

If a caller's assumption is broken (signature change, return shape change), update the caller in the same commit OR explicitly note why deferral is safe.

---

## 6. Update docs in same commit (Gate 1 last item) ⛔ HARD

The pre-commit doc-hygiene hook blocks commits that change backend/routers/services/schema/requirements without updating at least ONE of:

- `TODO.md` — mark task done / add follow-ups
- `BUGS.md` — close resolved entries (use `🟡 PARTIAL` if partial) / add newly discovered
- `wiki/engineering/lessons.md` — non-obvious lesson learned (rule + reason + how to apply)
- `CLAUDE.md` — tech stack / architecture / constants changed
- `wiki/` — service diagram or doc changed

Update BEFORE staging the code commit so the hook passes first try.

---

## 7. Local sanity checks ⛔ HARD

Activate the project venv (per `venv_activation_mandatory` memory — system Python 3.14 shadows 3.12):

```bash
VENV_PY=/Users/prashant/Documents/preflight7_core/.venv/bin/python

# Architecture audit (E0)
make eval-e0

# Fast tests (no slow marker)
$VENV_PY -m pytest backend/tests/ -m "not slow" -q

# Vulture (Gate 15 enforcement)
$VENV_PY -m vulture backend/services/ --min-confidence 80

# Alembic single head (B7)
make db-heads-check 2>/dev/null || echo "WARN: db-heads-check not available"

# Test collection (Gate 13)
$VENV_PY -m pytest --collect-only -q 2>&1 | tail -5
```

If ANY fails, fix before continuing. Never `--no-verify` to bypass.

For high-blast-radius PRs (auth flow, retrieval scoring, schema migrations, LLM provider changes), additionally run `/ultrareview` — it's billed but cheap insurance for the bug classes that have historically leaked through (GAP-INGEST-002, instructor_extractor retry loop).

---

## 7.5. Click-test changed user flows ⛔ HARD

Per CLAUDE.md Gate 14.5: for any session that touched a user-facing surface (page, CTA, form, toast, modal), open the browser and click the affected user flow end-to-end at least once. HMR confirmation (Gate 14) is necessary but not sufficient — code can hot-reload AND still be broken on the API contract.

**What to check:**
- Open the page that uses the changed code path (e.g. `/library/assistant` → Aging tab).
- Trigger the primary CTA(s) you touched (e.g. Mark verified, Snooze, Deprecate).
- Confirm the **actual response**: toast text, DevTools Network status code, console errors.
- If anything is unexpected, **trace to root cause before proceeding** — don't dismiss as "pre-existing not in scope."

**Visual changes require before/after screenshots** (Gate 14.5-5). When the touched surface is styled, attach pixel proof — words alone don't catch regressions.

**State explicitly in the ship summary**: `"Smoke test passed: clicked [CTA] on [page], saw [expected result]."` Or list the unexpected finding + root cause.

**Skip only if**: pure backend change with no FE flow that exercises the new path (rare). Backend changes that a FE click exercises are NOT exempt — the smoke test IS the FE click.

---

## 8. Check drift vs origin/main — do NOT merge

Worktrees drift fast. Fetch and **report** the drift, but **never auto-merge** into the branch. Auto-merging:
- pulls dozens of unrelated commits into the PR diff,
- pollutes generated files like `schema.sql` with state from main + dev DB,
- can re-trigger CI on unrelated files,
- and makes the PR review harder.

The right place to integrate is the merge-commit on `main` (step 10) — GitHub handles it cleanly.

```bash
git fetch origin
echo "Branch is N behind, M ahead of origin/main:"
git rev-list --left-right --count HEAD...origin/main
```

If the branch is **behind main AND your work has a hard dependency** on something in main (e.g. an Alembic migration whose `down_revision` references a migration only in main), STOP and surface to the user. The user decides whether to:
- rebase / merge manually, or
- adjust your work (e.g. re-parent the migration's `down_revision`).

Never merge unilaterally — the user owns that decision.

---

## 9. Push and create PR

```bash
git push -u origin "$(git branch --show-current)"

gh pr create \
  --title "<TYPE: [service] short description, under 70 chars>" \
  --body "$(cat <<'EOF'
## Summary
- <bullet 1: what changed>
- <bullet 2: why it changed>
- <bullet 3: any non-obvious side effect>

## Test plan
- [ ] Local pytest fast suite passed
- [ ] Local vulture passed (Gate 15)
- [ ] Local `make eval-e0` passed
- [ ] Doc hygiene satisfied (TODO/BUGS/LESSONS/CLAUDE.md updated as applicable)
- [ ] Edge cases reviewed: empty, None, concurrent, timeout, large input
- [ ] No new silent catches (Gate 16-3)
- [ ] Impacted modules verified — caller assumptions hold

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Return the PR URL to the user.

---

## 10. Merge to main — merge-commit ONLY (CLAUDE.md B1) ⛔ HARD

First, check CI state:

```bash
# Get the PR number from the URL returned in step 9
PR_NUM=<number>
gh pr checks $PR_NUM 2>&1 | head -10
```

**If CI is failing for billing/infra reasons** (not code): surface to the user. Do NOT bypass with `--admin` unless user explicitly authorizes per-PR.

**If CI is green (or user authorized override)**, merge with merge-commit:

```bash
gh pr merge $PR_NUM --merge --delete-branch
# --merge = merge-commit ONLY. NEVER --squash, NEVER --rebase.
# Squash/rebase merges are DISABLED at repo level per CLAUDE.md B1
# (PR #115/#132/#135 dropped content silently via squash).
```

After merge:

```bash
git checkout main
git pull origin main
git log --oneline -3              # confirm the merge commit landed
```

Report final state: PR URL, merge commit hash, main is now at <hash>.

---

## Failure-mode quick reference

| Step | Common failure | Action |
|---|---|---|
| 0 Preflight | Working tree dirty | Stop; ask what to include |
| 1 Review | Domain issue found | Fix in same session BEFORE step 2 |
| 2 Half-bridge | Orphan function | Add caller, write test, OR delete |
| 3 Silent catch | Bare `except` | Promote to CRITICAL, metric, or annotate |
| 4 Edge case | Not tested | Add test OR document why N/A |
| 5 Impacted modules | Broken assumption | Update caller OR revert |
| 6 Docs | Hygiene gate blocks | Update TODO/BUGS/LESSONS/CLAUDE.md |
| 7 Sanity | Test fails | Fix code; never `--no-verify` |
| 8 Sync | Merge conflict | Resolve; never `--hard reset` |
| 9 Push | Wrong remote / protected | Verify remote |
| 10 Merge | CI red / billing-blocked | Surface to user; do not auto-bypass |

---

## Skipping rules

- **HARD steps** (0, 1, 2, 3, 6, 7, 8, 10) — never skip. Skipping = shipping known gaps.
- **Steps 4, 5, 9** may be partially skipped for docs-only PRs (no code paths exist). State explicitly which steps are skipped and why.
- For tiny PRs (one-line fix, single typo), the full pipeline is overkill — collapse steps 1–5 into "single-line review" and proceed. State the collapse explicitly.

---

## When NOT to call /ship

- Mid-exploration: still scoping or experimenting → do that first
- Plan-only changes: if the work is just designing, no `/ship` needed yet
- Quick spike on a throwaway branch never intended to merge
- When the user is in plan mode: respect the mode, finish planning first

If unsure whether the work is ship-ready, run step 0 (preflight) and ask the user.
