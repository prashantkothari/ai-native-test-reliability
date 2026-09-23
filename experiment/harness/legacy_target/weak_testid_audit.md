# Weak-testid audit — MediaWiki 1.39 default install

**Verification date:** 2026-09-15
**Container:** `mediawiki:1.39` (SHA `sha256:1e821253cc88...`), SQLite backend
**Base URL:** `http://localhost:8080`

## Grep counts on served HTML

Method: `curl -s <URL> -o page.html && grep -oc <pattern> page.html`.

| Page                                                            | `data-testid` | `data-test` | `id="..."` | `name="..."` | `aria-label` | `<input>` | `<button>` |
|-----------------------------------------------------------------|:-------------:|:-----------:|:----------:|:------------:|:------------:|:---------:|:----------:|
| `/index.php/Main_Page`                                          | **0**         | 0           | 62         | 7            | 11           | 6         | 0          |
| `/index.php?title=Special:UserLogin`                            | **0**         | 0           | 60         | 18           | 11           | 14        | 1          |
| `/index.php?title=Main_Page&action=edit`                        | **0**         | 0           | 66         | 25           | 12           | 25        | 0          |

Total `data-testid` occurrences across the three primary interaction pages: **0**.
For comparison, a naive grep of n8n workflow-editor HTML yields dozens; Excalidraw's
built HTML yields several. MediaWiki matches the buyer profile: server-rendered
forms whose authors never adopted the modern test-hook convention.

## Anchor inventory — what IS available

The absence of `data-testid` is offset by three legacy-flavored anchor families,
listed in the order Playwright would prefer them:

### 1. Stable `id` attributes (the historical MediaWiki convention)
- **Nav / tabs:** `#ca-edit`, `#ca-history`, `#ca-talk`, `#ca-view` (page-action tabs);
  `#pt-login`, `#pt-createaccount`, `#pt-anoncontribs` (personal tools);
  `#n-mainpage-description`, `#n-randompage`, `#n-recentchanges`, `#n-help-mediawiki`;
  `#t-permalink`, `#t-info`, `#t-print`, `#t-specialpages`, `#t-whatlinkshere`.
- **Search:** `#searchInput`, `#searchButton` (form on every page).
- **Login form:** `#wpName1`, `#wpPassword1`, `#wpRemember`, `#wpLoginAttempt`.
- **Edit form:** `#wpTextbox1` (wikitext body), `#wpSummary`, `#wpSave`, `#wpPreview`,
  `#wpDiff`, `#wpMinoredit`, `#wpWatchthis`, `#wpAntispam`.
  Note: MediaWiki OOUI emits these with **single-quoted** attributes
  (`id='wpSave'`, not `id="wpSave"`) — DOM parsers normalize this, but naive
  regex-based scrapers must handle both.

### 2. `name` attributes on form inputs
- Login: `wpName`, `wpPassword`, `wpRemember`, `wpLoginToken`, `wpLoginAttempt`.
- Edit:  `wpTextbox1`, `wpSummary`, `wpSave`, `wpPreview`, `wpDiff`, `wpEditToken`,
  `wpUnicodeCheck`, `wpAntispam`.

### 3. `aria-label` attributes (spotty coverage — used mostly for icon-only widgets)
- `aria-label="Search TestWiki"` (site-search input on every page)
- `aria-label="Wikitext source editor"` (edit textarea)
- `aria-label="Change language variant"` (language chooser)
- No `aria-label` on the main Save/Preview/Diff buttons — Playwright falls back to
  visible text via `getByRole('button', { name: 'Save changes' })`.

### 4. Class attributes (least stable — mixed skin/reset/OOUI)
Buttons carry both role classes (`mw-ui-primary`, `mw-ui-progressive`) and
component classes (`oo-ui-buttonElement-button`, `oo-ui-inputWidget-input`).
These change across MW major versions and across skin overrides — precisely the
"drift" surface our self-heal plugin exists for.

## Drift plausibility
- 1.35 → 1.39 renamed the login submit from `wpLoginattempt` to `wpLoginAttempt`
  (case change). A naive Playwright selector `input[name=wpLoginattempt]` breaks.
- OOUI class prefixes (`oo-ui-*`) were introduced in 1.25 and are slated to be
  replaced by the Codex design system across upcoming releases — every button
  class currently visible is on the drift path.
- Sidebar link ids (`n-mainpage-description` etc.) are localizable in
  `MediaWiki:Sidebar` — a wiki-admin edit renames them.

## What was NOT verified (and why)
- Anonymous editing works out of the box on the default install; login is
  not required to trigger the Save/Preview/Diff flow. We therefore did not
  audit the post-login "edit conflict" / "captcha triggered" branches.
- Post-1.39 versions ship the Codex-based design system experimentally; this
  audit is scoped to the LTS to keep the drift story grounded.
