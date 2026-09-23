# preflight7 project state — auto-loaded on session start

_Maintained by `session-codify` §N "Project-state delta". Update only on user approval. No secrets._

## Databases
- **Dev DB:** `preflight7_dev` | **Test DB:** `preflight7_test` | port **5433** (containerized PG16 + AGE 1.6.0 via colima)
- **Migration head check:** `make db-heads-check` (must print "✅ single Alembic head")
- **Schema source of truth:** Alembic migrations under `backend/db/migrations/versions/`; `backend/db/schema.sql` is a regenerated dump

## Extraction pipeline
- **Primary backend:** Cerebras `llama3.1-8b` (env var: `CEREBRAS_API_KEY`)
- **Fallback chain:** Cerebras → Groq → Ollama `mistral-nemo:12b` → `rule_v1`
- **Required env:** `EXTRACTION_BACKEND=cerebras` and `EXTRACTION_PROMPT_VARIANT` (see Gate 7 G7-7, G7-8, Gate 11.5)
- **Boot probe:** `backend/services/extraction_backend_probe.py` (verifies live HTTP round-trip)

## Chat / Ask-AI
- **Backend:** Ollama `mistral-nemo:12b` on port **11434** (not Cerebras — separate path)

## Contracts
- **fact_type CHECK enum:** V2 closed set in `backend/config/ontology/claim_types.yaml`; constraint added in migration `20260522_003`
- **CORS allowlist:** `backend/main.py` → `cors_origin_regex`
- **Eval workspace tenant_id:** `00000000-0000-0000-0000-000000000099` (public eval ID, not a secret)

## Health probes
- `/health.extraction_backend_probe` — live backend status
- `/health.ingestion_validator.last_run` — 4-stage quality report (JSONB)
- `/health.cognee_rate_limiter` — 30 RPM / 60s bucket state

## Active rules
- CLAUDE.md Gates 0–21 apply
- B1 merge policy: **merge-commits only** (`gh pr merge <N> --merge`); no squash/rebase
- B6 type contract: `frontend/src/types/generated.ts` is the source of truth; do NOT hand-write FE types
- G14 worktree hygiene: edit main repo for files uvicorn opens at any point; worktrees for hot-reload-only files

## Skills & process
- **Active skills (7):** `diagnose` / `grill-me` / `pattern-promoter` / `plan-template` / `redteam` / `session-codify` / `ship` (archived: 7 `code-review-*` skills moved to `.archived-skills/2026-06-11/` — `/ship` Step 1 covers per-domain review)
- **Plan-template amendments (1–9):** Amendment 9 (2026-06-11) = verb-probe — for every action verb in §2, write a 3-line probe BEFORE the implementation commit (SQL / WebFetch / grep). Catches the wrong-premise class (vector_score, workspaces.tenant_id, sources.py, AGE-on-Azure, css probe type — 5 redesigns in 4 days).
- **Metrics:** `scripts/skills_metrics.py` — subcommands `session <jsonl>` / `plan <md>` / `codify <md>` / `redesigns <glob>`. Run after major PRs to measure before/after.

---
_Last verified by codify session: 2026-06-11 (PR #926 + #931 skills rationalization + Amendment 9)_
