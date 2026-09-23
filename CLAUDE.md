# Repo instructions

0. **Continue work on `consolidated-main` (or its current successor branch) — do not branch from `main` for new sessions.** This repo previously had 30 local branches and three separate GitHub repos because every session started a fresh session-named branch instead of continuing existing work. See docs/planning/plan-reconciliation.md for the archaeology.

1. Before any task, read `wiki/README.md` — it indexes the rest of the wiki.
2. Then look up the file you need in `wiki/files.md`, and read that actual file before editing it. The wiki is **advisory, not authoritative** — verify paths/symbols against source before edits.
3. If `wiki/.sync-status` is missing or not `ok` AND `wiki/README.md`'s `Last-verified` header is >14 days old, treat the wiki as stale and read source directly.
