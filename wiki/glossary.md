# Glossary

Terms required by `test_glossary_terms.sh` — see `glossary.terms`.

## Analyzer 2.0 questions

- **Q1** — same page? URL-template + title + a11y-hash + landmarks + auth fingerprint; VLM tie-break.
- **Q2** — is the target element here? Owned by `matchStep` → `disambiguateByContext` → `WEB.actionable`.
- **Q3** — earlier drift? Per-prior-step fingerprint walk; splits Flow-Change vs Prerequisite.

## Anchor tiers

- **T0** — testid (most stable).
- **T1** — stable-id.
- **T2** — id-fragment.
- **T3** — name-only / anchorless (least stable).

## Failure taxonomy (7-category)

- **DRIFT** — element moved / renamed but still present.
- **REMOVAL** — element gone entirely.
- **AMBIGUITY** — multiple viable candidates.
- **STATE** — element exists but not in the required state.
- **TEMPORAL** — timing / still-loading (network in-flight, oldest-pending age).
- **FLOW_CHANGE** — the app path changed upstream.
- **UNKNOWN** — residue: nameless icon / full visual redesign.

## Other

- **HITL** — human-in-the-loop overlay; record-time anchor-strengthening + execute-time adjudication. The heal-rate unlock (K35).
- **verify-by-effect** — 3-way outcome (pass / fail / unverified→human); the declared effect must actually happen.
- **K-numbers** — indexed decisions/lessons (K19, K22, K26, K33–K37) in the arch doc.

For full context on any term see [architecture.md](architecture.md) or the canonical arch doc.
