# Legacy weak-testid target — pick

**Winner: MediaWiki 1.39 (default install, no plugins, SQLite backend).**

Rationale: n8n and Excalidraw are modern SPAs with some `data-testid` discipline; our
buyer's real app is a legacy webapp with server-rendered forms and zero test-hook
budget. MediaWiki's default install ships classic PHP forms whose primary anchors
are `id="wpSave"`, `id="wpTextbox1"`, `id="wpName1"`, `id="searchInput"` — i.e. the
kind of anchors a legacy customer actually has. Verified: zero `data-testid`
occurrences on the three primary served pages (Main_Page, Special:UserLogin,
edit view). See `harness/legacy_target/weak_testid_audit.md`.

## Scoring (1-5, higher is better)

| Candidate                 | 1. Docker-one-liner | 2. Zero testids (verified) | 3. Deterministic UI | 4. Drift plausible | 5. No anti-automation | Total |
|---------------------------|:-------------------:|:--------------------------:|:-------------------:|:------------------:|:---------------------:|:-----:|
| **MediaWiki 1.39**        | 5                   | 5 (0 hits, verified)       | 5                   | 4                  | 5                     | **24** |
| WordPress wp-admin (LTS)  | 3 (needs mysql)     | 5 (0 hits, wp-admin/install)| 4                  | 4                  | 4 (nonce churn)       | 20    |
| phpBB 3.3                 | 3 (needs mysql)     | 5 (expected 0, not verified — image not on Hub)| 4  | 3                  | 4                     | 19    |
| Redmine (Rails)           | 4                   | 4 (expected 0)             | 4                   | 4                  | 4                     | 20    |
| osTicket                  | 3                   | 4                          | 3                   | 3                  | 4                     | 17    |
| MoinMoin                  | 2                   | 5                          | 3                   | 2                  | 5                     | 17    |

## Rejection reasons (one-liners)
- **WordPress wp-admin**: needs MySQL + a 5-step install wizard before real admin UI is reachable; nonce/token churn adds Playwright-orthogonal flakiness.
- **phpBB**: official image not on Docker Hub (`phpbb/phpbb-fpm` requires login); community images vary and drift.
- **Redmine**: Rails engine ships stable IDs but also emits Rails UJS `data-*` on some links; less pure "legacy weak-hook" story.
- **osTicket**: staff/agent UI split makes the "primary flow" ambiguous for a demo cross-check.
- **MoinMoin**: too niche; drift story hard to argue to a buyer.

## Verification method used
1. `docker run -d --name chipd-mw -p 8080:80 mediawiki:1.39`
2. `docker exec chipd-mw php maintenance/install.php --dbtype=sqlite --dbpath=/var/www/data --pass=adminpass123 --scriptpath="" TestWiki Admin`
3. `docker exec -u root chipd-mw chown -R www-data:www-data /var/www/data /var/www/html/LocalSettings.php`
4. `curl` three key URLs → grep for `data-testid`, `data-test`, `id="`, `name="`, `aria-label`, `<button`, `<input`.
Result: 0/0/0 `data-testid` on Main_Page, Special:UserLogin, edit view.

## Runner-ups (kept for phase-2 breadth if we need a second legacy app)
1. WordPress wp-admin — same "zero testids" property, harder to stand up in one command.
2. Redmine — the "legacy Rails" flavor if we want a non-PHP data point.
