# Verdict: Jev-Choice vs Jev-Noul (plan: enchanted-swimming-fern.md)

**Result: Choice does not win per the plan's own bar**, but the failure mode is much better understood and cheaper.

## Numbers (n=20)

| | Correct | Abstained | Wrong-confident | Input tokens |
|---|---|---|---|---|
| Baseline (no judge) | 17/20 | — | — | — |
| Jev-Noul (8 calls/case) | 15/20 | 2/20 | **3/20** | 180,419 |
| Jev-Choice (1 call/case) | 14/20 | 6/20 | **0/20** | 31,985 (18% of Noul) |

## Plan §3 success criterion

- Zero wrong-confident on case-01/14/18: **PASS**
- Aggregate correct ≥ 15/20: **FAIL** (14/20) — Choice abstained on all 6 decoy cases, including two (case-01, case-20) where one candidate has a real `data-testid` and the other doesn't, which should have been decisive.

## What actually happened (§5 F3 check — tied-vs-uniform)

On every decoy case, Choice's probability mass landed *entirely* on the two duplicate candidates (indices 0/1) and exactly zero on the other six — never a diffuse "no idea" distribution. Choice correctly narrows "it's one of these two" with perfect precision every time; it just can't reliably break the tie between two near-identical candidates, even when one carries a testid the other lacks (case-01: 0.57/0.43 lean toward the right one, case-20: dead 0.50/0.50 despite a testid difference).

## Conclusion

Choice fixes the dangerous failure (confidently wrong) that motivated this investigation, and does it at ~18% of Noul's token cost in 1/8th the calls. It does not fix the underlying weakness: neither primitive reliably uses a testid as a decisive anchor when comparing two near-identical elements — Choice just fails safe (abstain) where Noul failed unsafe (confident wrong pick). Per the plan, the next step for that specific gap is a deterministic anchor-tier pre-filter — which likely already exists in this system (`lib/descriptor.mjs`'s ranker already weights testid matches at +5, and the separate hybrid plan's `strongAnchorSkip` already trusts strong anchors and skips the LLM/Jev check entirely for them) rather than a new judge primitive. Out of scope for this investigation.

Caveat: n=20, single synthetic page. Not sufficient for a "safe for prod" claim — sufficient to rank two primitives against each other on a fixed benchmark, which was the assigned question.
