---
name: session-codify
description: Emit a structured handoff artifact at end of session — open assumptions, half-finished bridges, what worked, what surprised. Run before clearing context. Loaded by the next session that touches the same subsystem.
---

# session-codify

You are wrapping up a working session. Before the user clears context, emit a single artifact that makes the next session start hot, not cold.

## Timing

Record wall-clock at invocation start and end. Log one line to the artifact footer:
`_Codify ran in Xs (target <30s)_`

If elapsed >60s, note which section caused the slowdown (usually "Open — half-bridges" scan).

## Triggers

**Auto-invoke — no user prompt needed** when ANY of:
- A PR merged this session (detected via `/ship` completing or `gh pr merge` success)
- A bug was filed or closed this session
- The user said "ship it" / "wrap up" / "done for now" / "close out" / "end of session"
- ≥3 files were touched in implementation (not pure read) in this session

Skip if: pure research session with no code change, or user explicitly says "no codify".

Output goes to `wiki/engineering/session-codify/<YYYY-MM-DD>-<topic-slug>.md`. The
half-bridges section is the highest-value field — name every downstream consumer gap
explicitly. Skipping `Open — half-bridges` is a Gate 16/18 risk.

> **Source-of-truth contract: this section.** CLAUDE.md indexes here. Do not duplicate trigger
> logic in CLAUDE.md prose — link to this section instead. (C4-a, 2026-05-24.)

## What to emit

Write to `wiki/engineering/session-codify/<YYYY-MM-DD>-<topic-slug>.md`. Single page, this exact structure:

```markdown
# Session: <topic>  •  <YYYY-MM-DD>

## What shipped
- One line per merged PR / committed change. Link the SHA.

## Open — half-bridges
For each piece of work that wrote data/state but does NOT yet have a downstream consumer:
- **<edge type / table / module>** — written here: <ref>. NOT consumed yet by: <ref>. Required link: <one line>.

If none, write "None — verified end-to-end."

## Open — unverified assumptions
For each assumption made during the session that wasn't directly tested:
- **<assumption>** — would be invalidated by: <one observation>.

## What worked (non-obvious)
- Things that succeeded against initial intuition. One line each. These are the positive lessons that usually go unwritten.

**When writing to lessons.md:** use compact format `### [DATE] Title` + `**Rule:**` + `**Ref:**` (max 8 lines).
Before writing: grep CLAUDE.md Gates + `.claude/skills/` for the rule. If already encoded → don't add.

## What surprised
- Things that didn't behave as expected. Even if recovered. One line each.

## Next session opening prompt
A 1-2 sentence pre-derived prompt the next session can use to load straight into action, e.g.:
> "Continuing Lane 1.3 — limiter is shipped. Open: verify the breaker sits OUTSIDE the limiter (per review feedback fcf59a4). Open: real-spacing test passes against the new bucket size. Skip re-deriving where this fits."

## Project-state delta (post-session, before footer)

Did this session discover or change any fact that belongs in `~/.claude/projects/preflight7-state.md`?
Surface a proposed delta to the user for approval. **Do not auto-write** — this file is the only artifact
that crosses sessions, so any change needs a human gate.

Format (per line): `<key>: <new value>  # because: <one-line reason>`

Examples:
- `Extraction primary backend: Cerebras llama3.1-8b → Cerebras llama-3.1-70b  # because: PR #214 swap`
- `(none — no project-state changes this session)`

If non-empty, present as: *"Propose to update preflight7-state.md with: <lines>. Approve?"*

---
_Codify ran in Xs (target <30s)_
```

## Hard rules

1. **One artifact per session, not per file.** If session touched 3 subsystems, write ONE doc with sections, not three docs.
2. **Half-bridges are mandatory.** If any new data flows into a table/edge type/queue, you MUST name the consumer. Missing consumer = half-bridge = G16/G18 territory. This is the single highest-value field — fill it even if it feels obvious.
3. **No status copy from PR description.** "Shipped Lane 1.3" alone is useless. The artifact is for things NOT already in the PR description.
4. **"What worked" minimum 1 entry, max 5.** Forces capture of positive signal. Drop if literally none.
5. **No promises.** Don't write "next time we'll..." — write what's open and what surprised, period.

## Failure modes (these mean the skill misfired)

- Artifact reads like a PR description → you re-stated what's already in git. Re-do focusing on half-bridges + surprises.
- "Open" section is empty AND surprises is empty → either the session was trivial (then skip codify) or you're missing the introspection. Try once more.
- Next-session prompt names files not modified this session → you're guessing at future work. Cut it.

## Counter-pattern

A session-codify artifact that says "everything is wired up and tested" is the exact failure mode that produced Lane 1.3 and COMPLIES_WITH half-bridges. If you find yourself writing that, stop and ask: which downstream consumer queries this new data? If you can't name one, name THAT as the open half-bridge.

## Compounding

Output feeds `pattern-promoter` (lessons extracted from "What surprised" entries) and `plan-template` (next session's §3 Failure Modes pre-seeded from "Open — half-bridges"). Install all three together or none.
