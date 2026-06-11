---
name: code-review-auth
description: >
  Deep code review for auth/session/workspace code — JWT issuance, OTP flow, session
  cookies, workspace context, dependencies.py guards, login/signup/logout, password reset.
  Invoke with "/code-review-auth <file>" or when reviewing auth_service, dependencies,
  routers/auth, routers/workspace, workspace_service, or any session/cookie middleware.
  Focuses on privilege-escalation failure modes: missing tenant_id, JWT signature
  bypass, session fixation, IDOR via workspace_id manipulation, OTP brute force,
  insecure cookie flags.
---

# Code Review — Auth / Session / Workspace

Auth code fails silently AND catastrophically. A missing tenant_id is a cross-tenant leak. A weak JWT secret is account takeover. A missing OTP rate limit is brute force. This skill reviews for privilege-escalation classes specifically.

## Triggers

Auto-invoke when reviewing files matching:
- `backend/services/auth_service.py`
- `backend/services/workspace_service.py`
- `backend/services/settings_service.py` (membership/role logic)
- `backend/dependencies.py`
- `backend/routers/auth.py`
- `backend/routers/workspace.py`
- `backend/middleware/*auth*.py`
- Any file with `jwt.encode`, `jwt.decode`, `bcrypt`, `passlib`, `cookies.set`, `OTP`

## Review checklist

### A. Tenant / workspace contract — Gate 4 territory (HARD)
1. **`get_workspace_context()` returns BOTH `workspace_id` AND `tenant_id`**. Per Gate 4: workspaces.tenant_id is the domain identifier; workspace_id is the auth identifier. Don't cross.
2. **No endpoint reads `workspace_id` from request body, query, or header** to determine access. Membership lookup via authenticated session only.
3. **Workspace membership check** happens BEFORE any tenant data is touched: `SELECT 1 FROM workspace_members WHERE user_id = $1 AND workspace_id = $2`.
4. **Role checks (`owner` vs `member` vs `viewer`)** at the route boundary, not buried in service logic.

### B. JWT / token hygiene
5. **`JWT_SECRET` from env, never default in code**. Empty default = `secrets.token_urlsafe(32)` at boot is acceptable for dev; `""` is not.
6. **`algorithms=["HS256"]` (or whatever you use) passed explicitly to `jwt.decode`**. Missing → algorithm confusion (HS256/RS256 attack).
7. **`exp`, `iat`, `nbf` set on every token**. Token without expiry = forever-valid bearer.
8. **`aud` and `iss` validated**: prevents tokens from one env (staging) being accepted in another (prod).
9. **Token rotation on privilege change**: role upgrade or workspace switch invalidates prior token.

### C. Password / OTP hygiene
10. **Passwords hashed with bcrypt/argon2 with explicit cost factor**. No `hashlib.sha256(pwd).hexdigest()` anywhere.
11. **OTP rate-limited**: per-user-per-IP, e.g. 5/minute. No rate limit = brute force the 6-digit code.
12. **OTP single-use**: marked consumed after successful verify, can't be replayed.
13. **OTP comparison constant-time**: `hmac.compare_digest`, not `==`.
14. **No password/OTP/secret in `logger.info()` or `logger.error()`**. Grep the file for `password`, `otp`, `token` in log strings.

### D. Cookie / session
15. **Session cookie flags**: `HttpOnly=True`, `Secure=True` (prod), `SameSite="Lax"` or `"Strict"`, `Path="/"`.
16. **Session ID regenerated on login** (prevents session fixation). Don't reuse pre-login session ID post-login.
17. **Logout invalidates server-side session**, doesn't just clear cookie client-side.
18. **CSRF protection** on state-changing endpoints if cookie-based session is used.

### E. Authorization checks
19. **IDOR check on every resource access**: `SELECT ... WHERE id = $1 AND tenant_id = $session_tenant_id`. Resource ID alone is not enough.
20. **Soft-deleted users can't authenticate**: `WHERE users.status = 'active'` on session lookup.
21. **Workspace deletion cascades to session invalidation**: deleted workspace can't have active sessions.

### F. Account creation / signup
22. **Email verification required** before granting workspace access (or explicit "unverified" role).
23. **Tenant_id generated server-side** (UUID4), never accepted from request.
24. **Race condition on workspace creation**: `INSERT ... ON CONFLICT DO NOTHING` or unique index, not "check-then-insert".

### G. Error responses don't leak
25. **Login failure**: generic "Invalid credentials", same for unknown email and wrong password. Don't distinguish (user enumeration).
26. **Workspace 404 vs 403**: prefer 404 (hides existence) when user has no access.
27. **No stack traces, no SQL error strings** in auth error responses.

### H. Audit logging
28. **Every login, logout, role change, password reset logged** to `fact_audit_log` or equivalent with `user_id`, `ip`, `timestamp`, `event_type`.
29. **Failed login attempts logged**, not just successful. Forensics need both.
30. **Audit log writes can't be silenced**: not behind `try: ... except: pass`.

## Scoring rubric

- **HARD**: any privilege-escalation path, missing tenant filter, password in logs, weak JWT
- **SOFT**: missing audit log, missing rate limit, cookie flag missing
- **NIT**: log formatting, error message style

## Output format

```
## Auth Review — <filename>

### HARD findings (M)
1. [Gate X / OWASP A0X] <file>:<line> — description
   Threat: <which attacker capability this enables>
   Fix: <one-line>

### SOFT / NIT findings ...

### Score
- Gate coverage: X/30
- Signal:noise: 0.XX
- OWASP Top 10 alignment: A01 (Broken Access Control), A02 (Crypto), A07 (Auth)
- Privilege escalation paths: <count>
- Tenant isolation: clean / leaky
- Recommended next action: <one sentence>
```

## Not for
- General API endpoint review → `/code-review-api`
- DB-side enforcement (RLS, constraints) → `/code-review-db`

---

## v11 Pattern Update (2026-06-03 — from gstack)

### Severity discipline — two-pass classification (P1)

**Pass 1 — CRITICAL (HARD)** — flag as HARD only if ALL three apply:
1. **Reachable in default config** — not gated by a non-default flag, ENV var, or rare code path
2. **Real runtime impact** — wrong output, data loss, security breach, or shipping blocker (NOT style/maintenance)
3. **Has grep/test evidence** — file:line + actual command output (NOT just pattern match against checklist)

**Mandatory downgrade rules (these are SOFT, not HARD):**
- DELETE/HEAD endpoint returning bare dict → SOFT (clients rarely consume body)
- "Weaker filter than ideal" (e.g. `tenant_id IS NOT NULL` vs `= $tid`) → SOFT (defense-in-depth, not active leak)
- Dormant code path (only fires when non-default flag is set) → SOFT
- "Pattern matches checklist but no grep evidence run" → DROP (insufficient evidence)

**Pass 2 — INFORMATIONAL (SOFT)** — worth fixing but doesn't meet HARD bar. Style, maintenance, defense-in-depth, hygiene.

**NIT** — cleanup, comments, naming. Not actionable for rework.

### Enum & Value Completeness check (P4 — Pass 1 CRITICAL)

When the file introduces, accepts, or references an enum value / status string / tier name / type constant:
1. TRACE through every consumer — `grep -rn "<value>" backend/ frontend/` then READ each match (not just grep count)
2. Check allowlists/filter arrays for missing sibling values
3. Check case/if-elsif chains for fallthrough to wrong default
4. Cite the consumers that need updates

This requires reading code OUTSIDE the file under review. If you don't have the patience to grep+read consumers, mark the finding as `NEEDS-MANUAL-GREP` and SKIP rather than guess.

### Fix-First Heuristic (P5)

After classifying severity, classify resolution path:
- **AUTO-FIX** (mechanical, one-line, no judgment): missing import, typo, magic number → named constant, missing log statement
- **ASK** (judgment required): architectural change, severity disagreement, schema migration, security trade-off

HARD findings lean ASK; SOFT findings lean AUTO-FIX.

### Output format — terse (P2)

For each finding: ONE line problem, ONE line fix, ONE line evidence. NO preamble, NO summaries, NO "looks good overall."

```
HARD [Gate X | category] path:N — <one-line problem>
  Fix: <one-line>
  Evidence: <grep command + result OR test that reproduces>
  Resolution: AUTO-FIX | ASK

SOFT [Gate X | category] path:N — <one-line problem>
  Fix: <one-line>
  Resolution: AUTO-FIX | ASK

NIT path:N — <one-line>
```

End the review with a SINGLE summary line:
```
Pre-Landing Review: N issues (X HARD, Y SOFT, Z NIT). Cost: ~$K tokens.
```

If no findings: `Pre-Landing Review: No issues found.`

**Banned phrases:** "Overall the file looks…", "This file demonstrates…", "Notable surprise…", "One-line justification…", "Score: X — rationale…", and any prose preamble before the findings list.

---

## v12 refinement 2026-06-03 — Confidence scoring (P6)

**Every finding MUST include a self-assessed confidence rating.** This forces the reviewer to be honest about evidence quality before claiming severity.

### Confidence levels

- **HIGH** — Grep evidence ran AND output matches finding AND framework semantics verified by mini-test if relevant. Reproducible by anyone. Default for verified gate violations.
- **MED** — Pattern matches checklist; grep evidence supports it; but reviewer didn't run a test to confirm runtime behavior. Probably real but worth user spot-check.
- **LOW** — Pattern observation only. No grep. No test. Reviewer noticed but didn't validate. **LOW confidence auto-downgrades severity by one level.**

### Auto-downgrade rule

If confidence is LOW:
- HARD with LOW confidence → automatically reclassified as SOFT
- SOFT with LOW confidence → automatically reclassified as NIT
- NIT with LOW confidence → dropped (insufficient signal)

This is mandatory — the reviewer MUST apply the downgrade before outputting.

### Updated output format

```
HARD [conf=HIGH | Gate X | category] path:N — <one-line problem>
  Fix: <one-line>
  Evidence: <grep command + output OR test result>
  Resolution: AUTO-FIX | ASK

SOFT [conf=HIGH/MED | Gate X | category] path:N — <one-line problem>
  Fix: <one-line>
  Resolution: AUTO-FIX | ASK

NIT [conf=HIGH/MED] path:N — <one-line>
```

### When to use which confidence

- **HIGH:** "I ran `grep X file` and got Y output; I ran `python -c '...'` and got Z result; this is reproducible"
- **MED:** "I read the code at file:N, the pattern matches X gate definition, but I didn't write a runtime test"
- **LOW:** "I saw a pattern that looks like X but I didn't grep or test — pure visual inspection"

### Banned: confidence-asymmetric reasoning

- ❌ Don't claim HARD severity with LOW confidence (auto-downgrades anyway)
- ❌ Don't pad MED confidence findings with "this could be a bug if X" speculation — that's LOW
- ❌ Don't use HIGH unless you ran the actual grep/test
- ❌ Don't downgrade-then-still-flag — if LOW becomes NIT-dropped, drop it. Don't list it.

### Summary line — add confidence breakdown

```
Pre-Landing Review: N issues (X HARD, Y SOFT, Z NIT). Confidence: H=N M=N L=0 (LOW auto-dropped). Est cost: ~$K tokens.
```

LOW count should always be 0 in output (LOW findings are dropped per auto-downgrade rule).
