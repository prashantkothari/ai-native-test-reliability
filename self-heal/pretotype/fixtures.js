/* self-heal/pretotype/fixtures.js — S0 pretotype fixtures (Wizard-of-Oz inputs + pre-registered expectations).
 *
 * THROWAWAY. Validates the FLOW + the report/output CONTRACT, not real accuracy. The login DOM is
 * deliberately ADVERSARIAL so the run exercises all three outcomes: heal, abstain, HITL (plan §6).
 *   - email  : data-testid                       -> heals through restyle AND localize (testid is an attribute)
 *   - password: name + type + autocomplete       -> heals (stable form attrs survive localize)
 *   - submit : role+name+type=submit             -> heals (type=submit distinguishes it); weak-identity flag
 *   - eyeIcon: nameless <button><svg></button>   -> no-anchor at record; AMBIGUOUS at execute (HITL)
 *   - sso / forgot                               -> heal
 * Each target carries data-oracle="<truth>" that SURVIVES drift -> lets us score correct-heal vs FALSE-HEAL.
 */
(function (root) {

  // ---- the screen under test (mounted into #appStage; data-oracle = ground-truth id per control) ----
  const LOGIN_DOM = `
    <form action="/login" id="loginForm" class="auth-form">
      <h2>Sign in</h2>
      <label for="email">Email</label>
      <input id="email" data-testid="login-email" type="email" name="email" autocomplete="username"
             placeholder="Email" class="inp" data-oracle="email">
      <label>Password
        <input type="password" name="password" autocomplete="current-password"
               placeholder="Password" class="inp" data-oracle="password"></label>
      <button type="button" class="icon" data-oracle="eye"><svg width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="6"></circle></svg></button>
      <button type="submit" id="submitBtn" class="btn primary" data-oracle="submit">Sign in</button>
      <a href="/forgot" id="forgot" class="link" data-oracle="forgot">Forgot password?</a>
      <button type="button" id="sso" class="btn sso" data-oracle="sso">Continue with Google</button>
    </form>`;

  // post-action screens the mock executor swaps in, so the assertion oracle has something to read
  const DASHBOARD_DOM = `<div id="dash"><h1>Dashboard</h1><p>Welcome back.</p></div>`;
  const ERROR_DOM     = LOGIN_DOM + `<div class="err" role="alert">Invalid credentials</div>`;
  const STUCK_DOM     = LOGIN_DOM; // "app bug": submit clicked but nothing navigates (no Dashboard)

  // ---- the FULL suggested set a login screen should yield (Wizard-of-Oz; no LLM) ----
  // expectFail:true means the test PASSES when its assertion (an error) is satisfied (negative test).
  const TESTS = [
    { id:'T1', name:'Login — valid credentials', kind:'positive', target:'submit',
      steps:['email','password','submit'], assert:{type:'textPresent', value:'Dashboard'} },
    { id:'T2', name:'Login — wrong password (negative)', kind:'negative', expectFail:true, target:'submit',
      steps:['email','password','submit'], assert:{type:'textPresent', value:'Invalid credentials'} },
    { id:'T3', name:'Toggle password visibility', kind:'positive', target:'eye',
      steps:['eye'], assert:{type:null} },
    { id:'T4', name:'Forgot password link', kind:'positive', target:'forgot',
      steps:['forgot'], assert:{type:null} },
    { id:'T5', name:'Sign in with Google (SSO)', kind:'positive', target:'sso',
      steps:['sso'], assert:{type:null} },
    { id:'T6', name:'Sign up — new account', kind:'positive', target:'sso',
      steps:['sso'], assert:{type:null}, note:'off-screen flow; suggestion only (not approved in pretotype)' }
  ];

  // review (Flow 1): which the user approves; one is edited; the rest are suggestions only
  const REVIEW = { approve:['T1','T2','T3','T4','T5'], edited:{ id:'T1', change:'rename → "Login (happy path)"' },
                   skipped:['T6'], pointedAt:'eye', screenshotOn:'submit' };

  // ---- PRE-REGISTERED expectations (authored from the PLAN's promises, BEFORE the run — K36e) ----
  // resolution: heal|cached|abstain|fail · final: PASS|PASS_HEALED|FAILED|ABSTAIN · category from taxonomy
  const EXPECTED = {
    report: {
      testsGenerated: 6, testsApproved: 5,
      falseHealTotal: 0,                       // the gating ceiling
      // per (test, drift) final outcomes we expect:
      finals: {
        'T1|pristine':'PASS', 'T1|restyle':'PASS_HEALED', 'T1|localize':'PASS',  // submit #id breaks on restyle (heal), survives localize (cached)
        'T2|pristine':'PASS',                                  // negative: error shown = pass
        'T3|pristine':'ABSTAIN',                               // nameless icon → ambiguous
        'T4|pristine':'PASS', 'T5|pristine':'PASS',
        'T1|appbug':'FAILED'                                   // assertion fails after a real click → APP_BUG
      },
      categories: { 'T3|pristine':'AMBIGUITY', 'T1|appbug':'APP_BUG' }
    },
    hitl: {
      // which steps must raise a card, and why
      fires: [
        { when:'record',  step:'eye', flag:'no-anchor' },
        { when:'execute', test:'T3', category:'AMBIGUITY' }
      ]
    },
    brain: {
      // after T1 runs once, these step keys must be cached and prime run-2
      cachedKeys: ['T1:email', 'T1:password', 'T1:submit'],
      run2Primed: true
    }
  };

  // ---- Non-login FORM fixture (P1 gate): a contact form with required + optional fields + inline validation
  const CONTACT_DOM = `
    <form id="contactForm" class="auth-form" novalidate>
      <h2>Contact us</h2>
      <label for="cName">Name</label>
      <input id="cName" name="name" type="text" required class="inp" data-oracle="name" placeholder="Your name">
      <label for="cEmail">Email</label>
      <input id="cEmail" name="email" type="email" required class="inp" data-oracle="email" placeholder="you@example.com">
      <label for="cPhone">Phone (optional)</label>
      <input id="cPhone" name="phone" type="tel" class="inp" data-oracle="phone" placeholder="555-1234">
      <label for="cMsg">Message</label>
      <textarea id="cMsg" name="message" required class="inp" data-oracle="message" placeholder="How can we help?"></textarea>
      <button type="submit" id="cSubmit" class="btn primary" data-oracle="submit">Send message</button>
    </form>`;
  const CONTACT_SUCCESS_DOM = `<div id="thanks"><h1>Thanks!</h1><p>Your message was sent.</p></div>`;

  // ---- TABLES/LISTS archetype fixture (P2 T4.1): an orders LIST whose per-row action buttons
  // ("Edit"/"Cancel") share the SAME accessible name across all 3 rows — ambiguous by name alone
  // (margin 0, matchStep would abstain). The only thing that tells the rows apart is their own
  // row-text (the customer name) — the proven K19/K27 lever (candidate-generation.js
  // disambiguateByContext). Cancelling a row is a REAL, observable effect (status flips to
  // "Cancelled") — if the runtime ever resolved the wrong row, a NEIGHBOR row would flip instead,
  // which is exactly the false-heal shape this archetype is designed to catch.
  //
  // DELIBERATE <ul><li> CHOICE, not a literal <table><tr><td>: candidate-generation.js's containerOf()
  // includes 'td'/'th' in its ROW_TAGS stop-list, so on a real multi-cell <tr> it stops at the
  // button's OWN <td> (the Actions cell) instead of climbing to the <tr> — the captured rowText would
  // be "Edit Cancel" on every row (identical, no disambiguating signal). That is a genuine gap in the
  // shared, heavily-tested containerOf() this session does not touch (broad blast radius, out of
  // scope for a fixture-level session). A <li> row with the action buttons nested one div deeper
  // sidesteps it correctly (li IS in ROW_TAGS; the intermediate div is not, so containerOf climbs
  // straight to the li and captures the customer name too) — an equally real "list" shape per the
  // T4.1 archetype name, and the one actually proven live in this codebase (Gong/AirPods evidence is
  // all div/li-based, never a literal <td>-per-action table).
  const ORDERS_DOM = `
    <div class="list-wrap">
      <h2>Orders</h2>
      <ul id="ordersList" class="orders-list">
        <li data-oracle="row-1001"><span class="cust">Alice Chen</span> <span class="status">Pending</span>
          <div class="actions"><button data-oracle="edit-1001">Edit</button> <button data-oracle="cancel-1001">Cancel</button></div></li>
        <li data-oracle="row-1002"><span class="cust">Bilal Khan</span> <span class="status">Pending</span>
          <div class="actions"><button data-oracle="edit-1002">Edit</button> <button data-oracle="cancel-1002">Cancel</button></div></li>
        <li data-oracle="row-1003"><span class="cust">Carla Nunes</span> <span class="status">Pending</span>
          <div class="actions"><button data-oracle="edit-1003">Edit</button> <button data-oracle="cancel-1003">Cancel</button></div></li>
      </ul>
    </div>`;

  // ---- NAV/MENUS archetype fixture (P2 T4.2): a sidebar nav whose links have DISTINCT names (no
  // disambiguation needed here — this archetype is about verify-by-effect on a URL+DOM change, not
  // row-text). Clicking a link switches the visible view AND updates location.hash — the runtime
  // checks BOTH (T4.2: "verify-by-effect on URL/DOM change"), the Amplitude-pilot pattern.
  const NAV_DOM = `
    <div class="app-shell">
      <nav class="sidenav" aria-label="Main" data-oracle="nav">
        <a href="#dashboard" data-oracle="nav-dashboard" class="nav-link active">Dashboard</a>
        <a href="#settings" data-oracle="nav-settings" class="nav-link">Settings</a>
        <a href="#billing" data-oracle="nav-billing" class="nav-link">Billing</a>
      </nav>
      <main id="viewport">
        <h1 id="viewTitle">Dashboard</h1>
        <p id="viewBody">Welcome back.</p>
      </main>
    </div>`;
  const NAV_VIEWS = {
    dashboard: { title: 'Dashboard', body: 'Welcome back.' },
    settings:  { title: 'Settings',  body: 'Manage your account preferences.' },
    billing:   { title: 'Billing',   body: 'View invoices and payment methods.' }
  };

  root.PRETOTYPE_FIXTURES = { LOGIN_DOM, DASHBOARD_DOM, ERROR_DOM, STUCK_DOM, TESTS, REVIEW, EXPECTED,
                              CONTACT_DOM, CONTACT_SUCCESS_DOM, ORDERS_DOM, NAV_DOM, NAV_VIEWS };
})(typeof window !== 'undefined' ? window : globalThis);
