---
name: grill-me
description: >
  Pre-plan requirements interview — fires BEFORE plan-template ONLY when the user's request
  contains ambiguity that a plan would otherwise have to guess at. Asks ONE clarifying question
  at a time (max 3 questions), stops when the decision tree resolves, hands off a tight
  requirements summary to plan-template §1. Adopted from mattpocock/skills (/grill-me). Pilot
  status — evaluated after 5 invocations against kill criteria. Skip when requirements are
  already concrete (specific files named, single unambiguous behavior change).
---

# Grill Me

Pre-plan requirements interview. Fires before plan-template only on ambiguity. Hands off a
clean requirements summary to plan-template §1, so the plan doesn't waste tokens disambiguating.

**Pilot status (V14, 2026-05-29; ungated 2026-06-11):** kill criteria below remain as quality bar. The env-flag gate was removed after counterfactual test on 3 active sessions showed grill-me would have fired on session 2's vague open ask but the gate prevented all real evaluation — gate prevented reaching N=5.

## Triggers

**Auto-invoke — when ALL of these hold:**

1. Plan mode is entering OR the user said "let me think about X" / "before we build" / "what should we do" / "help me figure out"
2. The user's request contains ≥1 of these ambiguity signals:
   - Vague verbs ("improve," "fix," "refactor") without a named target
   - A goal stated without success criteria
   - References to "the X" without specifying which X (when multiple plausible Xs exist)
   - A request for "a plan" with no constraints stated

**Skip when ANY of these hold (precedence over the above):**

- The user named specific files / functions / endpoints — requirements ARE concrete
- The user gave success criteria ("until tests pass," "so /health.X returns Y")
- The user said "just do it" / "no questions" / "skip the grill"
- The work is a single mechanical edit (rename, format, typo fix)

**Order with /plan-template:** grill-me precedes plan-template ONLY when ambiguity exists.
If plan-template would auto-fire (per its triggers) but the request is concrete, grill-me
returns silently and plan-template runs normally. (EXP-3 mitigation — V14 plan §15.)

> **Source-of-truth contract: this section.** CLAUDE.md indexes here. Do not duplicate
> trigger logic in CLAUDE.md prose — link to this section instead. (C4-a, 2026-05-24.)

## Kill / Keep criteria (pilot evaluation at N=5 invocations)

After this skill has fired 5 times, evaluate:

**KEEP if all hold:**
- ≥3/5 invocations resolved ambiguity in ≤3 questions (`questions_asked ≤ 3 AND decision_resolved = true`)
- User did not say "skip the grill" or equivalent dismissal ≥2 times
- Net session tokens (measured via end-phase `output_tokens` delta vs. baseline) up by ≤10%

**KILL if any hold:**
- ≥3/5 invocations failed to resolve in ≤3 questions
- User dismissed ≥2 times
- Net tokens up by >10%

Kill action: revert this commit (re-add the env-flag gate) and document why in lessons.md. Re-evaluate in 30 days.

## The grilling

### Step 1: Identify the ambiguity

In one sentence, name the specific ambiguity that triggered this skill:
> "The request says [X] but I need to know [Y] to plan well."

If you can't name a specific ambiguity in one sentence, the trigger was wrong — exit
silently (and log `decision_resolved: false, questions_asked: 0` so the eval correctly
penalizes false positives).

### Step 2: Ask ONE question

The question must:
- Resolve a specific decision (yes/no OR pick-from-list)
- Have a default that you'll fall back to if the user says "your call"
- Be answerable in ≤30 seconds of user time

Use `AskUserQuestion` with `header` ≤ 12 chars and a recommended option marked
"(Recommended)." Multiple choice with 2–3 options; the user can always pick "Other."

### Step 3: Decide if more grilling is needed

After the answer, re-evaluate: is there still ambiguity that would make the plan worse?

- **No further ambiguity:** proceed to step 4 (handoff)
- **One more decision needed:** repeat step 2 (max 2 more times = total cap 3)
- **Multiple decisions still needed:** the request is too vague for grilling; STOP and ask
  the user to write a 3-line problem statement instead

### Step 4: Handoff to plan-template

Write a tight "Requirements summary" block that plan-template §1 will reuse verbatim:

```markdown
## Requirements summary (from /grill-me)

- **Goal:** <one sentence>
- **Success criteria:** <observable signal>
- **Constraints:** <time / scope / tech>
- **Non-goals:** <explicit out-of-scope>

_Resolved via N questions in /grill-me. Decisions: <list of choices made>._
```

## Anti-patterns

- **Don't grill on already-concrete requests.** "Add a column called `is_active` to `facts`"
  doesn't need grilling. Step 1 will catch this — if you can't name an ambiguity in one
  sentence, exit.
- **Don't ask more than 3 questions.** The user's patience is the resource. If 3 questions
  weren't enough, the problem is too vague and needs a written statement, not more questions.
- **Don't ask procedural questions.** "Which file should I edit?" is the implementer's call,
  not the user's. Stick to BEHAVIORAL questions: what should the system do, not how.
- **Don't replace plan-template.** This skill produces a requirements summary; plan-template
  produces the plan. Two distinct artifacts.

## Public-skills credit

Adopted from [mattpocock/skills/grill-me](https://github.com/mattpocock/skills) (2026-05).
Pocock's version doesn't include the feature flag — that is our addition
per V14 plan §15 (EXP-6). The grilling discipline (one question at a time, max 3,
decision tree resolution) is his.

<!-- skill body — /grill-me — V14 plan Session 1 PR 2 -->
