# Self-Healing Framework: In-House vs Research Learnings (2026-09, v2)

Companion to [`test-recorder-survey-2026-09-v2.md`](./test-recorder-survey-2026-09-v2.md).
Grounded in `/Users/prashant/Documents/playwright_middleware/SELF_HEAL_ARCHITECTURE_v1.md`
and `/Users/prashant/Documents/playwright_middleware/FAILURE-TAXONOMY.md` (read
2026-09), not the task brief's summary.

Scope: capabilities 3 (brain / locator cache), 4 (self-healing execution),
5 (reporting). Recorder gap = separate doc.

## What we actually have (from ARCH v1 + TAXONOMY)

Much more than the task brief implied. Summary of the built surface:

- **8-stage loop** (STUDY → LOCATE → RECORD → INTENT → EXECUTE → DIAGNOSE →
  HEAL → LEARN) with a VERIFY-by-effect step wired between HEAL and LEARN
  (ARCH §1).
- **11-signal descriptor** for elements, with **T0–T3 anchor tiers**
  (testid > stable-id > id-fragment > name-only > anchorless) and
  container/ordinal disambiguators (ARCH §3b).
- **Empirically-grounded 7-category failure taxonomy** (DRIFT, AMBIGUITY,
  REMOVAL, STATE_ISSUE, TEMPORAL, FLOW_CHANGE, UNKNOWN) with healable-yes/
  no annotations and correct-behavior per category (TAXONOMY §B).
- **1000-failure iOS POC** as the empirical basis (TAXONOMY §A): 74.4% of
  failures fall in the AI/auto-heal stream (A, B, C, G); the remaining
  25.6% (D, E, F, H, I) are scoped OUT — never healed, only reported.
- **Verified matching floor**: the matcher already clears the heal
  threshold on role+tag alone; **what blocks a heal is MARGIN (duplicate
  tie), not threshold** — so healing is a *disambiguation* problem
  (Ledger K8, TAXONOMY §C).
- **Elimination / negative-constraint tie-break** already BUILT (P1)
  (TAXONOMY §C).
- **Analyzer 2.0 alignment** (ARCH §3c): Q1 (same-page fingerprint),
  Q2 (element-here disambiguation — where we're the specialist), Q3
  (earlier-drift walk), T0–T3 tier vocabulary, root-cause enum,
  reinforce-only-on-verified.
- **Locator POOL lifecycle** (ARCH §3d): primary + working-auto-healed
  (DB) + ≤25 backups from 6 sources (S3); ordered by execution-history
  not rank; **top-three-agree consensus gate** (find-only, no action);
  page-state heal 7a/7b/7c; `consecutive_pass ≥ 3` promotion;
  `was_primary` sticky bit; persist only on validated success.
- **Design ethos**: **false-heal = 0**; a true 66–80% beats a fabricated
  95%; deterministic + explainable core, LLM/vision only for the residue
  (ARCH §3, §4).
- **Autonoma**: already flagged BSL 1.1 — read READMEs only, do NOT
  fork/copy source (ARCH §3e).
- **Maestro**: format grammar borrowed (Apache-2.0), Studio flagged as a
  potential *mobile* authoring path via a Studio→our-format transpiler
  (ARCH §3f, §3g).
- **Cross-tenant learning moat** (I27) is design-declared, P2/P3 status.

## What the research surfaced (delta only)

The arch doc already surveys Momentic, Antithesis, OpenTest, Swarm,
Propolis, Playwright, axe-core, Healenium, Skyvern, OmniParser,
browser-use, Autonoma, Maestro. This section only lists things **not**
in the arch doc, or where the research meaningfully sharpens what's
already there.

### Genuinely new to add

**A. arXiv:2603.20358 (zero-cost accessibility-tree healing, MIT code at
Renjithnj/zero-cost-self-healing-qa).** Publishes an explicit 10-tier
locator hierarchy (role → testid → ARIA → text → css → xpath) applied
from the accessibility tree, framed as a *cost-scaling* argument against
per-invocation LLM heals.
- **Delta**: aligns almost perfectly with our T0–T3 tiers and the "keep
  LLM off the hot path" ethos (ARCH §3, §4). Their explicit ordering
  (10 tiers vs our 5-ish) is a useful sharpening of our tier definition
  language — worth a read to see if any of our tiers merge/split.
- **Not new**: the cache-first-LLM-fallback stance is already our design.

**B. arXiv:2605.01471 (LLM-agent multi-agent test repair failure modes).**
Enterprise-scale case study of what breaks when multiple LLM agents do
autonomous test repair: over-repair (silently rewriting oracle),
ambiguous-DOM loops, "successful" repairs whose intent has drifted.
- **Delta**: validates our INTENT-as-Clue-3 design (ARCH row 4) and the
  verify-by-effect gate. Also a useful *external* citation for why our
  false-heal=0 metric matters. Worth mining for failure modes that
  should route to HITL under our T0–T3 rules.
- **New action**: cross-check the 7 categories in TAXONOMY §B against
  this paper's failure modes. FLOW_CHANGE already covers "oracle drift"
  in spirit; confirm it does in the routing logic too.

**C. arXiv:2509.25140 (ReasoningBank — self-improving agent via memory
consolidation).** Policy for *which* observations become long-term
memory. Frontier academic work on the "self-evolving brain" problem
we've stubbed at P2/P3.
- **Delta**: directly relevant to §3b brain and §3d "conservative
  learning" (`consecutive_pass ≥ 3` + `was_primary` sticky). Our
  policy is `HIGH-confidence verified + HITL-confirmed only` +
  consecutive-pass promotion; ReasoningBank adds explicit
  consolidation/decay/forget policy that our stub doesn't yet name.
  Worth reading before we actually build P2/P3 brain persistence.

**D. rrweb (github.com/rrweb-io/rrweb, MIT).** Not a healing library,
but noted here because ARCH §3b mentions Healenium's history store as
the brain reference — rrweb is a *complementary* battle-tested capture
engine that would feed the brain higher-fidelity input (full DOM
mutation stream, not just discrete step events). See the recorder
survey doc for the full case.

### Already covered in the arch doc (no delta)

- **Healenium** — ARCH §3b already borrows the weighted-LCS tree-compare
  gist and the Postgres locator-history-as-brain pattern, with our
  verify-gate addition. Research adds nothing.
- **Skyvern** — ARCH §3, §3b already borrows the Planner/Actor/Validator
  loop and the route-memorization → deterministic-compile pattern.
  Research adds nothing.
- **Momentic** — covered ARCH rows 2, 3, 7 and §2 (gist, we stay
  deterministic).
- **Autonoma** — covered ARCH §3e including the BSL 1.1 warning and the
  package-split validation.
- **Swarm / Propolis** — covered ARCH row 1 and §2 (STUDY-stage pattern).

## Comparison table (in-house vs research vs OSS today)

| Dimension | In-house today | Research frontier | Best OSS | Delta / action |
|---|---|---|---|---|
| Anchor tiering | T0–T3 (testid > stable-id > id-frag > name > anchorless) + 11-signal descriptor + container/ordinal | 10-tier accessibility hierarchy (arXiv:2603.20358) | Renjithnj/zero-cost-self-healing-qa (MIT) | Compare tier definitions; may merge or split 1–2 tiers |
| Candidate generation | Elimination + context/ordinal/widener (P1 built); pool of ≤25 from 6 sources (P2/P3) | Priority-list ordering | Healenium (LCS tree-compare) | None — we're ahead conceptually; verify our pool source-ordering |
| Consensus / safety gate | Top-3-agree find-only gate + actionability + margin (§3d) | Not a common academic focus | None as clean | We're ahead |
| Cache / brain memory | HIGH-conf verified + HITL-confirmed writes only; `consecutive_pass ≥ 3`; `was_primary` sticky; persist only on validated success | ReasoningBank consolidation/decay policy (2509.25140) | Healenium history DB (writes on every heal — contamination risk) | Adopt an explicit decay/forget policy before P2/P3 brain ship |
| Failure taxonomy | 7 categories, empirically grounded on 1000 real failures + 30 drift cases | LLM-agent repair failure-mode catalogue (2605.01471) | None as principled | Cross-check FLOW_CHANGE covers oracle-drift routing |
| Verify-by-effect | Modelled; live = P2 | Paper 2605.01471 shows agents without it drift silently | Antithesis (gist only, backend focus) | Keep it non-optional — external evidence supports |
| Reporting | Per-scenario + per-element pass/fail + heal/flakiness | Not a common academic focus | None | Ahead |
| Cross-tenant learning | Designed (I27), P2/P3 stub | Adjacent to ReasoningBank | None open | Read 2509.25140 before implementing |
| False-heal metric | 0 as hard target | Rarely reported in papers or OSS libs | None call it out | Contribute this as a public metric |

## Concrete follow-up items

1. **Read arXiv:2603.20358** and compare its 10-tier hierarchy against
   our T0–T3 tiers (ARCH §3b). Decide whether to merge/split any tier
   or adopt the paper's naming.
2. **Read arXiv:2605.01471** and mine failure modes; confirm FLOW_CHANGE
   routing covers oracle-drift in the actual pipeline code, not just in
   TAXONOMY §B's definition.
3. **Read arXiv:2509.25140 (ReasoningBank)** before implementing the P2/P3
   brain persistence. Extract its consolidation/decay/forget policy and
   layer it onto our existing `consecutive_pass ≥ 3` + `was_primary`
   rules.
4. **rrweb as brain input** (not just as recorder capture engine): full
   DOM-mutation stream is a richer signal than discrete step events for
   the "structural diff" P2 lever (TAXONOMY §C). Worth a spike.
5. **Publish the false-heal=0 metric** in any external write-up — it
   distinguishes us from every LLM-heal-per-invocation library and every
   heal-on-every-failure library (Healenium included).

## What the research did NOT change

- The design ethos (deterministic + explainable core, LLM/vision for
  residue only). Research supports this direction.
- The Autonoma BSL warning (ARCH §3e). Confirmed.
- The Maestro-format borrow (ARCH §3f). Confirmed as clean Apache-2.0.
- The Playwright-as-EXECUTE-runtime decision. Confirmed as the correct
  wholesale-adoption call.
- The Analyzer 2.0 alignment (ARCH §3c). Nothing in the research
  literature contradicts this mapping.
