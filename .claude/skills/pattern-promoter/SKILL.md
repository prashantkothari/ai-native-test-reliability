---
name: pattern-promoter
description: Scan wiki/engineering/lessons.md for recurrence patterns and propose Gate promotions. Invoke weekly or when LESSONS grows by ≥10 entries since last scan. Output is a proposal list — user approves/rejects each.
---

# pattern-promoter

Scan the LESSONS file for patterns that have recurred 2+ times. Propose each as a Gate candidate. Default rejection — burden of evidence is on the pattern.

## Timing

Record wall-clock at invocation start and end. Log one line at the bottom of the output file:
`_Pattern-promoter scan ran in Xs (target <60s)_`

If elapsed >90s, the lessons file has grown large — consider splitting into archived and recent sections.

## Triggers

**Invoked on-demand by Claude — no cron** (C3, 2026-05-24: the prior remote-trigger cron produced zero artifacts in 30+ days and was retired). Trigger when ANY of:
- After `/ship` of a substantial PR (≥3 files, new gate, schema/migration touched)
- LESSONS file has grown by ≥10 entries since the last scan (check `wiki/engineering/.pattern-promoter-state` for last scan entry count)
- Immediately after promoting any new Gate to CLAUDE.md (sanity check for adjacent patterns)
- User explicitly invokes `/pattern-promoter`

Output goes to `wiki/engineering/gate-proposals-<YYYY-MM-DD>.md`. Cap at 3 proposals per scan.
User approves/rejects each proposal individually — never rubber-stamp.

> **Source-of-truth contract: this section.** CLAUDE.md indexes here. Do not duplicate trigger
> logic in CLAUDE.md prose — link to this section instead. (C4-a, 2026-05-24.)

## Procedure

1. **Start timer.**
2. Read `wiki/engineering/lessons.md` in full.
   Note: lessons are `### [DATE] Title` headings under `## Topic` section headers.
   Extract entries by matching `^### \[\d{4}-\d{2}-\d{2}\]`.
3. Read `wiki/engineering/.pattern-promoter-state` to get `last_entry_count` and `last_scan_date`. If missing, treat as first run.
4. For each lesson, extract: `(date, file/module touched, error_class, fix_shape)`. The "error class" is a 2-5 word phrase you generate, e.g. "silent except-catch", "hardcoded allowlist drift", "missing downstream consumer".
5. Cluster lessons by `error_class`. A cluster of ≥2 distinct dates is a recurrence candidate.
6. For each cluster with size ≥2:
   - Verify the cluster is genuine: do the lessons describe the *same failure mode* or just similar-sounding fixes? Read both lessons in full before promoting.
   - Reject if the cluster is a single root cause with multiple downstream lessons (that's one incident, not two).
   - Reject if the cluster spans >90 days with no recurrence in the last 30 (stale).
7. For each surviving candidate, draft a Gate proposal in this exact format:

```markdown
## Proposed: Gate <next-number> — <name>

**Pattern:** <one sentence — what recurs>

**Evidence (lessons):**
- [<date>] <title> — <one-line summary of the failure>
- [<date>] <title> — <one-line summary>

**Proposed rule:**
- HARD GATE: <one sentence — what to enforce>
- Pre-commit check: <grep / script / structural rule>
- Failure mode if violated: <what bug class returns>

**Why it's not already covered:**
- <reference existing Gate N> covers <what>, but does NOT cover <this pattern's specific shape>.

**Confidence:** high / medium / low
```

8. Emit the full proposal list (max 3 proposals per scan) to `wiki/engineering/gate-proposals-<YYYY-MM-DD>.md`. Tag for user review.
9. Update `wiki/engineering/.pattern-promoter-state`:
   ```
   last_scan_date: <YYYY-MM-DD>
   last_entry_count: <N>
   proposals_emitted: <N>
   ```
10. **Stop timer. Log elapsed.**

## Hard rules

1. **Two distinct incidents minimum.** One lesson + one anecdote ≠ recurrence. Two dated LESSONS entries = recurrence.
2. **Different files preferred.** Recurrence in the same file by the same person is a process bug; recurrence across files is a structural bug worth a Gate. Flag same-file recurrence at lower confidence.
3. **Don't propose if an existing Gate already names the pattern.** Read CLAUDE.md Gates 0–18 first. If the pattern is already enforced, instead propose a tightening of the existing Gate.
4. **Don't propose if the lessons explicitly already promoted a Gate.** Many lessons end with "promoted to Gate N" — those are closed, skip.
5. **Three or more recurrences = high confidence; promote without hedging.** Two recurrences = medium; offer the user the choice.
6. **Cap at 3 proposals per scan.** If more than 3 survive the filter, rank by recency (most recent recurrence first) and emit top 3. Note the count of suppressed candidates.

## False-positive triggers to watch for

- "All these lessons mention LLMs" — too broad, not a pattern.
- "All three lessons happened on a Tuesday" — coincidence, not pattern.
- Lessons that share keywords but describe different mechanisms (e.g. "silent" can mean WARN-swallowed exception, dropped log line, OR no metric — they're three different patterns).

## What success looks like

- Each Friday: a 1-page proposal file with 0-3 proposals (most weeks: 0).
- When the count is 3+, that's a signal to slow down feature work and stabilize.
- Over 12 months: ≥80% of new Gates were proposed here BEFORE the third recurrence (not after, like Gates 12–18 historically).

## Compounding

Each new Gate proposed here becomes a pre-commit grep. session-codify's "What surprised" entries are the highest-signal input — they get classified first. plan-template's §3 failure modes for the next session are pre-seeded from recent proposals. Install all three together or none.
