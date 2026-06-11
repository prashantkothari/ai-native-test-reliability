---
name: plan-template
description: Standard structure for plan-mode plans. Forces every plan through Context → Mock-Execution → Failure-Modes → Verification → Rollback. Diffable across plans; enables retrospective "did the plan predict its own failure modes" scoring.
---

# plan-template

When writing a plan in plan mode, conform to this structure. Every section is mandatory. Omitting a section is a structural failure of the plan — don't ship it.

## Timing

Note wall-clock time when plan is first drafted. Record total elapsed in a footer comment:
`<!-- plan-template applied in Xs (target <20s overhead) -->`

## Triggers

**Auto-invoke — no user prompt needed** when entering plan mode for ANY non-trivial task:
- User enters plan mode (`/plan` or plan-mode-triggering request)
- Task involves ≥3 files OR new service/router/schema
- Task involves a bug fix with potential cross-subsystem impact
- User says "plan this" / "write a plan" / "let's plan" / "before we build"

Skip if: trivial single-line fix, pure research/exploration (mark file as RESEARCH not PLAN).

Pre-seed §3 Failure Modes from the most recent `wiki/engineering/session-codify/` artifact's
"Open — half-bridges" section if one exists for the touched subsystem.

> **Source-of-truth contract: this section.** CLAUDE.md indexes here. Do not duplicate trigger
> logic in CLAUDE.md prose — link to this section instead. (C4-a, 2026-05-24.)

## Required sections (in order)

```markdown
# <Plan title>

## 0. Pre-flight (grep before referencing — HARD GATE)

**Never name a helper, schema column, CHECK constraint, PK, or external-system key in §2
without verifying it exists.** Two ghost references in one plan = process gap, not bad luck.

Run and capture output of every applicable check before writing §1:

- **Helpers/services:** `grep -n "def <name>\|async def <name>" backend/` for every function
  the plan claims to "reuse". A function that doesn't exist is a hallucination — drop the
  reference or scope the work to build it.
- **Schema columns:** `grep -A 5 "CREATE TABLE.*<table>" backend/db/schema.sql` for every
  table the plan reads or writes. Confirm column names, types, PKs, FKs.
- **CHECK constraints:** `pg_get_constraintdef` query or grep schema dump for every enum
  the plan extends or relies on. If the plan claims "bug X because CHECK doesn't allow Y",
  the CHECK MUST be inspected, not assumed.
- **External system keys:** AGE vertex/edge key names, embedding dimensions, env var names,
  3rd-party API field names. Grep the actual integration code, not docs.
- **session-codify half-bridges:** read the most recent `wiki/engineering/session-codify/`
  artifact for the touched subsystem. Pre-seed §3 from open half-bridges if any apply.
- **File-path existence (NEW — Amendment 3, 2026-06-06).** Before claiming "create new file at
  `path/to/foo.ts`", run `ls path/to/foo.ts`. A grep for SYMBOL NAMES (`escapeHtml`, etc.) that
  returns zero does NOT prove the file is free; the file may exist with different exports and
  callers. Empirical evidence: `move-items-to-a-clever-cray.md` Iter-5 F19 caught a planned
  file overwrite of `frontend/src/lib/dom.ts` (10 active callers) that the symbol-grep had
  cleared.
- **Re-grep of inherited doc claims (NEW — Amendment 2, 2026-06-06).** For every finding the
  plan inherits from a doc older than 7 days (e.g., `code-review-bugs.md`, BUGS.md, prior plan),
  run the grep that proves the finding still exists on `origin/main`. Document inline as
  `✓ still-present` or `✗ already-fixed`. Documents go stale; main moves.
- **Commit-log probe — `git log --since=<plan-date>` (NEW — Amendment 8, 2026-06-06).** For every
  file the plan claims to touch, run:
  ```bash
  git log --since="<plan-date>" --oneline -- <path>
  ```
  ANY commit in that range may have silently fixed, partially-fixed, or changed the surface area
  the plan targets. Document each commit's relevance inline as `✓ irrelevant` / `⚠ partial-fix
  applied — narrow scope to X` / `✗ fully fixed — drop session`. Symbol-grep, file-exists, and
  GH-issue-state probes (Amendments 2 + 3) do NOT catch this class because: a file path can
  exist with the bug fixed (file-exists passes), a symbol can exist while the surrounding code
  was rewritten (symbol-grep passes), and a GH issue can stay open while the underlying commit
  shipped (issue-state passes — e.g., #845 closed days after the fix commit landed).
  **Empirical evidence (move-items-to-a-clever-cray Wave 1, 2026-06-06):** 5 stale-doc findings
  surfaced AFTER Iter-4 §0 probes ran. (a) `/api/rfp/corrections` was fixed by commit `17d289d`
  before #845 was closed → S3 became a no-op the agent only discovered at step 0; (b) migration
  `20260603_002` was partially-on-main lacking Gate 8 SAVEPOINT + F21 backfill → S4 hardened
  in-place rather than creating a new migration; (c) annotation router endpoint count was 14
  in the inherited doc, actually 10 on main; (d) `code-review-bugs.md` UNVERIFIED count was 22
  in the inherited doc, actually 59 on main. All four would have been caught by a single
  `git log --since="<plan-date>" --oneline -- backend/routers/ backend/db/migrations/ wiki/engineering/code-review-bugs.md`.

Document grep output inline in §0 of the plan ("✓ verified" or "✗ doesn't exist → adjusted").

## 1. Context
- **What we're trying to do** (one paragraph, plain language).
- **Why now** (the trigger that made this a plan, not a maybe-someday).
- **Scope** (what's in).
- **Non-goals** (what's explicitly out).
- **Constraints** (time / LoC / reversibility budget — if user didn't state one, ASK before writing the rest).

## 1.5 Ordering — 80/20 risk × value (multi-session plans only)

For plans with ≥2 sessions, list the sessions and score each:

| Session | Surgical layers (file × type) | Read-only? | Value (1-5) | Risk (1-5) | Reversibility | Order |
|---|---|---|---|---|---|---|
| ... | e.g. `routers/x.py:router` + `services/y.py:service` + `db/migrations/...:schema-migration` | Y/N | ... | ... | revert / migration-down / data-loss | 1, 2, 3 |

**Surgical-layers column (NEW — Amendment 4, 2026-06-06).** PR count = number of distinct
`(file, change-type)` tuples where `change-type ∈ {router, service, schema-migration,
OpenAPI-contract, FE-component, FE-lib, config, test-only}`. Counting PRs from logical
clusters ("this is the privesc cluster") rather than surgical layers consistently underestimates
merge boundaries by 2× (empirical from `move-items-to-a-clever-cray.md` Iter 1→2: claimed
"6 HARDs collapse to 2 PRs" was actually 4 PRs across 4 surgical layers).

**Read-only? column (NEW — Amendment 5, 2026-06-06).** Read-only sessions (validation passes,
inventory updates, doc-only changes) have zero merge risk and parallelize freely. Put them
in the EARLIEST non-blocked wave, regardless of where their value intuitively fits. Putting
read-only work last is a false economy: it lets the rest of the work drift away from
ground-truth state before the validation runs.

Default ordering: **lowest-risk-highest-value first** AMONG fix sessions; **read-only
sessions ride in parallel with the earliest fix wave they don't block.** Irreversible
destructive operations ship last among the high-value sessions, after lower-risk ones
have given users enough value to make the destructive work worthwhile. Justify any deviation.

## 2. Mock execution
Sketch the work as if you were doing it, on paper:
- **Files to touch** (list with line-count estimate per file).
- **Critical changes** (the 3 most important code transformations, in pseudocode).
- **External calls / data / state** (DB writes, HTTP calls, file writes).
- **Most plausible bug** (predict one thing that will almost certainly need a follow-up).

If you can't sketch it, the plan isn't ready — go back to Context and tighten scope.

## 2.5 Probes (HARD GATE for any of: irreversible ops, new constants, external system writes)

Every commit that does any of the following MUST be preceded by an `X.0 Probe` commit
(no code change; just diagnostic script + benchmark capture):

- **Writes to ≥2 tables in one transaction** → SAVEPOINT dry-run on real data,
  inventory which rows actually move (claims_to_move, citations_to_move, etc.).
- **Introduces a constant or threshold** (`STALE_DAYS`, `MAX_RETRIES`, `MIN_CONFIDENCE`) →
  query p50/p90/p95/max from production data; pick the constant from the distribution,
  not a guessed default. (`feedback_distribution_before_cap`.)
- **Touches an external system** (AGE, embeddings, LLM, 3rd-party API) → end-to-end
  round-trip probe; verify the key/format/response shape, not the docs.
- **Claims a bug exists** → query that proves the bug-affecting data is in the expected
  state (e.g., `dismisses_audited = 0`). If the probe falsifies the claim, drop the
  related commit before writing code.

Each probe outputs into `wiki/engineering/benchmarks/<plan-slug>-<date>.md`. If any probe
inverts an assumption in §2, the corresponding commit is dropped or rewritten BEFORE code.

## 3. Failure modes — 7-LENS CHECKLIST (Amendment 1, 2026-06-06)

Pre-seed from: (a) current session's open half-bridges from session-codify artifact if one exists,
(b) most recent gate-proposals file from pattern-promoter if one exists,
(c) your own mock-execution "most plausible bug" from §2,
(d) downstream readers of any state §2 mutates (grep `WHERE <table>.fact_id` etc.).

**The 7 lenses (each yes / no / N-A with one-line justification — N-A permitted but must
be honest, not a dodge):**

1. **Data correctness** — wrong values, lost rows, schema drift, off-by-one
2. **Concurrency** — race, double-write, transaction boundary, lock ordering
3. **Auth / tenant isolation** — cross-tenant leak, role bypass, header forgery
4. **Performance** — p95 latency, throughput, lock contention, N+1 query
5. **Deploy order** — FE-first vs BE-first window risk, additive vs required schema fields,
   migration-vs-code-deploy sequencing
6. **Observability contract** — `/health` schema, log format, metric name, dashboard
   consumer (any change to these is a public-API change to monitoring)
7. **Half-bridge recurrence** — does this plan promise a step (probe, migration, baseline)
   without a structural enforcement gate? Promise-without-gate is the same anti-pattern
   as Gate 16-3 silent-except

For each LENS where you mark "yes" (failure mode applies), write at least one failure mode:
- **What could go wrong** (one sentence).
- **How we'd notice** (the observable signal — log line, metric, test failure).
- **Mitigation** (the code-level or process-level prevention).
- **If it happens anyway** (one-line response plan).

If you can't name a failure mode under 3+ lenses, the change is either trivial (no plan
needed) or you don't understand it well enough.

**Empirical evidence for 7 lenses vs 3 (2026-06-06):** `move-items-to-a-clever-cray.md`
Iter 1 (3-lens § 3) → 11 failure modes. Iter 4 (7-lens applied) → 18 failure modes
(+7 from lenses 4–7). Iter 5 (independent-context Pass-3 with 7-lens) → 33 failure modes
(+15 from gaps invisible to same-session). The 4 lenses added by this amendment surface
failures that the 3-lens version mathematically cannot detect.

## 4. Verification
Named, runnable checks. Not "tests pass" — specifics:
- `pytest backend/tests/test_<x>.py -v` — must pass
- `make pr-ready` — must pass
- `grep -c <pattern> backend/services/<file>.py` — expected count
- `/health.<x>` — expected value
- Manual UI flow if applicable, with the exact click path

**UX paths vs HTTP 200.** Workbench / HITL / multi-step UI surfaces are NOT covered by
HTTP-200 tests alone. Every such surface gets at least one end-to-end test (Playwright
or equivalent) covering: optimistic UI update → server confirm → list refetch / state
sync → rollback on 4xx/5xx. "It returns 200" is necessary, not sufficient.

## 5. Rollback
- **How to undo** (revert SHA, db migration down, feature flag flip).
- **What state is unrecoverable** (data writes, external API calls — if any).
- **Decision rule for triggering rollback** (the threshold — "rollback if test failure rate >X").

## 6. Bug-pair check (mandatory if 2+ bugs in same subsystem)
If this plan addresses 2+ bugs in the same subsystem, ask explicitly:
> "Are these the same bug seen from different angles? Does fixing one collapse the other?"
Then either: confirm they are independent (with evidence), or unify the plan.

## 7. Cofounder pass (mandatory for HITL / UI / user-facing surfaces)

A working surface and a delightful surface are not the same thing. For any plan that
touches a workbench, inbox, form, or otherwise user-facing flow, answer each as
yes / no / N/A with one line of justification:

- **Preview before irreversible?** Does the user see what will change before committing?
- **Undo?** Is there a window to reverse the action? How long?
- **Bulk action?** If the queue can be ≥10 items, can the user act on a group?
- **Keyboard navigation?** J/K-style navigation + Enter/Esc for power users?
- **Empty-state delight?** When the queue is empty, does the UI reflect accomplishment
  (counts, deltas, health) — or just "nothing here"?
- **Micro-signal on action?** Does the user see that the system is learning / responding,
  even before the underlying algorithm ships?
- **Shared component vs triplication?** If the same pattern shows up in ≥2 surfaces, is
  there a shared component, or are we copy-pasting?

N/A answers are fine when honest. Bulk-action N/A for a 3-item queue is correct.
Empty-state N/A for a non-list surface is correct. The point is to make the choice
visible, not to force features.
```

## Hard rules

1. **Sections in this order. No reordering.** Diffability across plans depends on positional consistency.
2. **No empty sections.** If a section doesn't apply, write "N/A — <one-line reason>". Empty = skipped = structural failure.
3. **No "TBD" in Failure Modes or Rollback.** These must be answered before plan approval. "TBD" means the plan isn't ready.
4. **Mock execution ≠ implementation.** Sketches in pseudocode. Don't write the actual code in plan mode.
5. **Scope/constraints from §1 are load-bearing.** If you find yourself exceeding them in §2, return to §1 and re-negotiate with the user.
6. **§0 grep MUST run before §2.** Helpers, schema columns, CHECK constraints, external-system keys all verified by command output, not from memory. A plan that references a non-existent helper is a hallucination, not a plan.
7. **§2.5 Probes are mandatory** for the trigger conditions listed in that section. Skipping a probe to "move faster" is the same anti-pattern as Gate 6/7/16 silent-failure recurrence: the cost is paid later, with interest.
8. **§7 Cofounder pass is mandatory for HITL/UI surfaces.** All 7 questions answered yes/no/N-A. "We can add it later" is a no, not an N-A.
9. **No speculative plan items.** Every file path, count, function name, schema column, or key named in §2 MUST be verified by grep/ls/read before the plan is written. If you can't show evidence the item exists, the item doesn't belong in the plan. A reference that can't show grep evidence is a hallucination.
10. **§3 must cover all 7 lenses** (Amendment 1, 2026-06-06). data correctness, concurrency, auth/tenant isolation, performance, deploy order, observability contract, half-bridge recurrence. Each yes / no / N-A with one-line justification. N-A permitted but must be honest — "we'll add it later" is a yes-without-mitigation, not an N-A. Single-lens or 3-lens-only plans are structurally incomplete; the empirical 4-lens gap (performance, deploy, observability, half-bridge) accounts for the largest class of post-merge regressions in this repo.
11. **Author-critic separation via subagent** (Amendment 7, 2026-06-06). For plans with ≥3 sessions OR plans that touch schema OR plans that modify a router's auth surface OR plans that add /health schema fields, the redteam Pass 3 (and beyond) MUST run via an independent subagent (`Agent` tool, `Plan` or general-purpose subagent_type). Same-context critic produces diminishing returns; empirical evidence: same-session 7-lens topped at 18 failure modes, independent-context 7-lens found +15 more with no signal of diminishing return.
12. **Read-only validation rides earliest wave** (Amendment 5, 2026-06-06). Sessions marked Read-only? = Y in §1.5 ordering MUST go in the earliest wave they don't block. Putting read-only validation last lets the rest of the plan drift away from ground truth. If a read-only session reveals state changes that affect a later fix session, the later session re-scopes — fast, cheap, in-flight.
13. **Promise-with-no-gate is half-bridge recurrence** (Amendment derived from F28, 2026-06-06). Every "we'll do X before Wave N starts" promise in §9 next-actions MUST have a corresponding §0 enforcement gate that fails the gate command (`test -f <artifact>` etc.) if the promise isn't kept. A narrative checklist in §9 is the same anti-pattern as Gate 16-3 silent-except annotations: it documents intent without preventing recurrence.

## When to skip the template

- Trivial fixes (single-line, no behavior change): no plan needed at all.
- Pure research / exploration: free-form is fine, but mark the file as RESEARCH not PLAN.
- Anything else: use the template.

## Retrospective scoring (compounds with `pattern-promoter`)

After a plan ships and a 7-day grace period:
1. List the fix PRs in those 7 days that reference work from this plan.
2. For each fix, ask: was this failure mode named in §3?
3. Compute prediction rate (predicted ÷ actual).
4. If <50%, the plan was under-predictive — note which class of failure was missed; refine the template's §3 prompts.
5. If >90% twice in a row, the plan is over-defensive — consider trimming.

## Compounding

§3 failure modes are pre-seeded from session-codify half-bridges and pattern-promoter proposals. Retrospective scores feed back as lessons to pattern-promoter. The loop: session-codify → lessons → pattern-promoter → Gate proposals → plan-template §3. Install all three together or none.
