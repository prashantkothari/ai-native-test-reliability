---
name: redteam
description: >
  Red-team a plan, decision, or idea before committing to it — attack assumptions, find failure
  modes, steelman the plan, give an honest verdict. Invoke when the user uses any synonym for
  "redteam this" / "attack this plan" / "what could go wrong" / "stress test this" / "tear this
  apart" / "share blindspots." Also invoke automatically per the structural trigger conditions
  defined in the canonical rule at `CLAUDE.md` → "Skill & Tool Invocation" section (e.g., plan
  adds a new service, touches schema, modifies files outside the user's request, irreversible
  action). For trigger logic, defer to CLAUDE.md; this skill defines the BODY of the ritual
  (attack/steelman/verdict structure). Default to N=2 passes minimum — after Pass 1, ask "what
  did Pass 1 miss?" before stopping. Past incidents (GAP-INGEST-002, instructor_extractor retry
  loop, silent boundary catches) all would have been caught by an attack pass; err toward
  invoking.
---

# Redteam

Structured adversarial analysis of a plan, decision, or idea before commitment.

## Triggers

**Auto-invoke — mandatory when ANY observable condition holds** (don't forecast scope — check the conditions):

- The plan adds a new file under `backend/services/` or `backend/routers/`
- The plan touches `backend/db/schema.sql`, any Alembic migration, or any DDL
- The plan adds a line to `requirements.txt` or `frontend/package.json`
- The plan modifies a file the user did NOT explicitly name in the request
  (**scope-creep detector — the strongest signal in practice**)
- The action is irreversible (force push, data delete, public release, prod migration)
- The user uses any synonym for "attack this" / "what could go wrong" / "stress test this" /
  "tear this apart" / "share blindspots"

**Default N=2 passes minimum.** After Pass 1, ask "what did Pass 1 miss?" before stopping.
Pass 2 routinely surfaces findings Pass 1 did not (evidence: a prior session's plan went
from 10 issues in Round 1 → 25 in Round 2 → measured structural patterns in Round 3). For
irreversible actions or scope >1 week, **N=3 with a measurement pass between rounds.**

**N=3 MANDATORY (Amendment 6 to plan-template, 2026-06-06)** when ANY of:
- Plan touches ≥3 subsystems
- Plan introduces a schema migration (Alembic upgrade/downgrade)
- Plan modifies a router's auth surface (adds/removes `Depends(get_workspace_context)`,
  `verify_workspace_role`, etc.)
- Plan adds a field to `/health` JSON schema (public contract change to monitors)
- Plan's net LoC delta ≥1000

**Pass 3 MUST run via independent subagent** (Amendment 7, 2026-06-06) for any plan meeting
the N=3 threshold above. Use the `Agent` tool with `subagent_type: Plan` or `general-purpose`.
The subagent receives a fresh context — it does not inherit the planner's framing, anchoring,
or lens-selectivity. Empirical evidence: in `move-items-to-a-clever-cray.md` Iter-5, the
same-session N=2 passes plateaued at 13 attacks (A1–A13); the independent-context Pass 3
found 15 additional findings (F19–F33) with no signal of diminishing return. The 15-finding
spike is the load-bearing data point for this amendment.

Skipping on a qualifying condition = **G6-3 violation** (scope-creep is an architectural
failure). Past incidents that would have been caught: GAP-INGEST-002, instructor_extractor
retry loop, silent boundary catches. Err toward invoking.

> **Source-of-truth contract: this section.** CLAUDE.md indexes here. Do not duplicate trigger
> logic in CLAUDE.md prose — link to this section instead. (C4-a, 2026-05-24.)

## If invoked with no plan description

Ask the user to describe the plan in enough detail to attack meaningfully:
- What is being built or decided?
- What are the key assumptions?
- What is the cost of being wrong?

## Three-part structure (keep each section distinct)

### Part 1: Attack

Find every way this fails. Cover assumptions that could be wrong, dependencies that could break,
edge cases the plan doesn't handle, competing approaches not considered, and the possibility
that the user is solving the wrong problem entirely.

Do not soften. Do not add "but this could work if...". State each problem as a direct claim,
not a hedged concern.

For technical plans: challenge architecture, data flow, failure modes, ops burden.
For feature/product decisions: challenge whether the problem is real, whether this solution
addresses it, whether the cost is worth it.

### Part 2: Steelman

Build the strongest possible case FOR the plan. What would have to be true for this to be
the right call? What advantages did the attack pass undersell? What's the best version of
this idea?

**Permission to refuse:** If the plan is fundamentally wrong, the steelman section may be
a single sentence: "There is no strong case for this. The verdict is don't build." Forcing
a manufactured steelman dilutes the verdict and trains the user to ignore weak attacks.
A genuine "no rescue available" is more honest than a hedged defense.

### Part 3: Verdict

Direct assessment: sound / flawed-but-salvageable / fundamentally wrong. What is the single
most important thing to resolve before committing? What would you change if it were your
decision? "It depends" is not a verdict.
