---
name: diagnose
description: >
  6-phase structured debugging skill: build a feedback loop FIRST, then reproduce, hypothesize,
  instrument, fix, cleanup. Adopted from mattpocock/skills/diagnose. Hard rule: no hypothesis
  testing before the feedback loop is working and reproducing the bug deterministically. Fires
  on explicit user request ("debug this", "diagnose this", "what's going wrong") OR on the 3rd
  iteration of work on the same problem. Pilot status — evaluated at N=5 invocations against
  Phase 1 ratio criteria. Mutually exclusive with /redteam (only one fires per turn).
---

# Diagnose

Structured debugging with feedback-loop-first discipline. The biggest debugging mistake is
hypothesis testing before the loop is working — that's gambling, not engineering.

**Pilot status (V14, 2026-05-29; ungated 2026-06-11):** kill criteria below remain as quality bar. The env-flag gate was removed after 14-day audit found 3 invocation attempts → 0 useful runs (gate exited silently every time). Gate prevented reaching N=5 evaluation threshold.

## Triggers

**Auto-invoke — when ANY of these conditions hold:**

- User says "debug this" / "diagnose this" / "what's going wrong" / "it's not working" / "why is X failing"
- This is the 3rd or later iteration on the same problem within the session
- A test failed AND the failure isn't immediately obvious from the assertion

**Skip when ANY of these hold (precedence over the above):**

- A failing test already exists AND reproduces deterministically — Phase 1 is already done,
  jump to Phase 3 (hypothesize).
- The fix is a known one-line correction (typo, missing import, off-by-one in obvious spot)
- /redteam fired this turn — mutually exclusive (EXP-3 / per-skill audit). Pick one.

**Order with /redteam:** mutually exclusive. /redteam attacks PLANS; /diagnose investigates
BUGS. If the user describes a bug while also planning a fix, /diagnose fires; /redteam can
fire on the resulting plan in a later turn.

> **Source-of-truth contract: this section.** CLAUDE.md indexes here. Do not duplicate
> trigger logic in CLAUDE.md prose — link to this section instead. (C4-a, 2026-05-24.)

## Kill / Keep criteria (pilot evaluation at N=5 invocations)

After this skill has fired 5 times, evaluate:

**KEEP if all hold:**
- `phase_1_seconds / total_debug_seconds ≤ 0.25` on average — Phase 1 is efficient (not heavy ritual)
- Bug fixed within ≤ 3 hypothesis iterations on average
- User did not say "skip the diagnose" or "just fix it" ≥ 2 times

**KILL if any hold:**
- Phase 1 ratio > 0.5 on average — Phase 1 takes longer than the fix itself
- Average iterations to fix > 5 — discipline isn't reducing shotgun debugging
- User dismissed ≥ 2 times

Kill action: revert this commit (re-add the env-flag gate) and document why in lessons.md. Re-evaluate in 30 days.

## The six phases

### Phase 1: Build the feedback loop ⛔ HARD GATE

**Do not skip. Do not hypothesize before the loop is working.** This is where most debugging
sessions waste time — the "let me try this" iteration without a deterministic way to test.

Pick exactly ONE feedback mechanism:
- **Failing pytest** — write a test that reproduces the bug. Most preferred.
- **curl script** — if testing an endpoint, save the curl command + expected vs actual response.
- **Throwaway Python script** — for service-level reproduction. Save to `/tmp/repro_<bug>.py`.
- **Failing integration script** — for cross-service flows.

The loop MUST satisfy:
1. **Deterministic** — runs the same way every time
2. **Fast** — under 10 seconds end-to-end
3. **Targeted** — exercises the suspected failure path, nothing else
4. **Provably reproducing the bug** — assertion fails with the actual symptom, not a proxy

If you can't build a loop that reproduces, STOP. Either:
- (a) Need more info — ask the user for one specific detail (logs, timing, env)
- (b) The bug is intermittent — Phase 1 needs to capture timing/state. Log to `/tmp/intermittent_<bug>.jsonl`.

**Record `phase_1_seconds` when this phase completes.**

### Phase 2: Reproduce

Run the loop. Confirm it fails. Capture the EXACT failure mode:
- Error message
- Stack trace (if any)
- Observed value(s)
- Expected value(s)

If the loop passes (doesn't reproduce), GO BACK TO PHASE 1. The loop is wrong.

### Phase 3: Hypothesize

NOW you can think about causes. Write down ≥ 2 candidate hypotheses:
1. <most likely cause based on symptom>
2. <next most likely cause>
3. <unlikely but worth ruling out>

For each hypothesis, name the discriminating evidence: what would the loop output look like
if THIS hypothesis is correct vs. if it's wrong?

### Phase 4: Instrument

For each hypothesis, add the minimum instrumentation to test it:
- Print/log statements at suspected branching points
- Breakpoint or `pdb.set_trace()` in throwaway debug code
- Database SELECT to verify state at a specific moment
- `dtruss` or `strace` if the bug is at a system call layer

Run the loop again. Read what came out. Update hypotheses based on evidence.

### Phase 5: Fix + test

When the evidence supports ONE hypothesis:
1. Make the minimal fix
2. Run the loop — assert it now passes
3. Run the broader test suite — assert no regression

If the loop still fails, the hypothesis was wrong. Go back to Phase 3. **Record this as an
iteration in `iterations_to_fix`.**

### Phase 6: Cleanup

1. Remove all instrumentation added in Phase 4
2. Promote the loop into a permanent regression test (`backend/tests/`) if it covers a
   class of bug worth guarding against
3. Update `wiki/engineering/lessons.md` with the root cause. Format:
   `### [DATE] Title` + `**Rule:** imperative instruction` + `**Ref:** PR/Gate`.
   Place under matching topic section. Max 8 lines.

## Anti-patterns

- **Skipping Phase 1 because "I already know what it is."** You don't. The loop tells you.
- **Phase 1 = "I ran the tests once."** Not the same. The loop must be deterministic, fast,
  and TARGETED to the suspected path. Running the full test suite isn't a feedback loop.
- **Adding 20 print statements in Phase 4.** Add 2. The signal-to-noise of 20 prints is worse
  than 2. If 2 isn't enough, you haven't narrowed the hypothesis enough.
- **Fixing the symptom not the cause.** Phase 5 fix must address WHY the bug happened, not
  just suppress the assertion. If you suppress, you're not done.
- **Skipping Phase 6 cleanup.** Leaving debug prints in production code is how this becomes
  Gate 6-3 (scope creep) in the next session.

## Public-skills credit

Adopted from [mattpocock/skills/diagnose](https://github.com/mattpocock/skills) (2026-05).
Pocock's version is 6 phases with the same hard-rule discipline. Our additions:
- Feature flag (EXP-6)
- Mutual exclusion with /redteam (per-skill audit boundary)
- Phase 6 cleanup integrates with our existing lessons.md → pattern-promoter loop

<!-- skill body — /diagnose — V14 plan Session 2 PR 1 -->
