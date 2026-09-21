/* self-heal/pretotype/payment-fixtures.js — S0 COMPLEX-screen stress fixtures.
 *
 * A hardcoded checkout/payment screen that packs the ledger's known-hard patterns into one DOM so we
 * can see whether the real pipeline (match / gate / disambiguate / diagnose / HITL) holds on complexity:
 *   - popup OVER popup (confirm dialog whose backdrop covers a button on the modal beneath) -> gate
 *   - identical-twin saved-card rows (two "Edit" / "Remove") -> Clue-2 row-text disambiguation (K19)
 *   - role-less portal dropdown (listbox options are bare <div>s) -> not a candidate (K32)
 *   - nameless gear icon (no accessible name) -> no-anchor (HITL)
 *   - disabled CTA (Pay) -> dropped pre-rank (K15/K16)
 *   - drift (restyle) on the modal -> heal through a broken #id
 * data-oracle survives drift -> ground truth for correct-heal vs FALSE-HEAL.
 */
(function (root) {
  const GEAR = '<svg width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="6"></circle></svg>';

  function checkout(payEnabled) {
    return `
      <div class="checkout">
        <button data-oracle="gear" style="width:28px;height:28px;float:right">${GEAR}</button>
        <h2>Checkout</h2>
        <div class="cards">
          <div class="card-row"><span>Visa ending 1234</span>
            <button data-oracle="edit-1234">Edit</button><button data-oracle="remove-1234">Remove</button></div>
          <div class="card-row"><span>Visa ending 5678</span>
            <button data-oracle="edit-5678">Edit</button><button data-oracle="remove-5678">Remove</button></div>
        </div>
        <label class="lbl">Country</label>
        <div class="dropdown" data-oracle="country-trigger" role="button" tabindex="0">Select country</div>
        <label class="lbl"><input type="checkbox" ${payEnabled ? 'checked' : ''}> I agree to terms</label>
        <button data-oracle="pay" data-testid="pay-btn" ${payEnabled ? '' : 'disabled'}>Pay $99.00</button>
      </div>`;
  }

  function modal1() {
    return checkout(true) + `
      <div class="backdrop" style="position:absolute;inset:0;background:rgba(0,0,0,.30);z-index:10"></div>
      <div class="modal" style="position:absolute;top:28px;left:28px;width:300px;background:#fff;border:1px solid #bbb;border-radius:8px;padding:12px;z-index:11">
        <h3>Add card</h3>
        <input data-oracle="cardnum" name="cardNumber" placeholder="Card number" class="inp">
        <button data-oracle="savecard" id="saveCard">Save card</button>
        <button data-oracle="cancel">Cancel</button>
      </div>`;
  }

  // popup OVER popup: a confirm dialog + its own backdrop (z-index 20) covering the Save-card beneath (z 11)
  function modal2over() {
    return modal1() + `
      <div class="backdrop2" style="position:absolute;inset:0;background:rgba(0,0,0,.45);z-index:20"></div>
      <div class="modal2" style="position:absolute;top:70px;left:70px;width:280px;background:#fff;border:1px solid #bbb;border-radius:8px;padding:12px;z-index:21">
        <h3>Confirm payment of $99?</h3>
        <button data-oracle="confirm">Confirm</button><button data-oracle="goback">Go back</button>
      </div>`;
  }

  function countryOpen() {
    return checkout(false) + `
      <div role="listbox" class="portal" style="position:absolute;top:150px;left:18px;background:#fff;border:1px solid #bbb;z-index:15">
        <div class="opt" data-oracle="opt-india">India</div><div class="opt">United States</div><div class="opt">Germany</div>
      </div>`;
  }

  const STATES = {
    checkoutEnabled:  () => checkout(true),
    checkoutDisabled: () => checkout(false),
    modal1, modal2over, countryOpen
  };

  // each case: capture in `cap` state, execute in `exec` state (+ optional drift / context), expect `want`
  const CASES = [
    { id:'C1', label:'Disabled CTA (Pay)', hard:'target disabled in exec state (K15/K16)',
      cap:'checkoutEnabled', oracle:'pay', exec:'checkoutDisabled', want:{final:'ABSTAIN', category:'REMOVAL', note:'disabled→dropped pre-rank; abstains with reason'} },
    { id:'C2', label:'Popup OVER popup (blocked Save card)', hard:'confirm backdrop covers Save card → not topmost',
      cap:'modal1', oracle:'savecard', exec:'modal2over', want:{final:'ABSTAIN', category:'STATE_ISSUE'} },
    { id:'C3', label:'Identical twin card rows (Edit)', hard:'two identical Edit buttons (margin 0)',
      cap:'checkoutDisabled', oracle:'edit-5678', exec:'checkoutDisabled', context:true, want:{final:'PASS', category:'DRIFT', via:'context'} },
    { id:'C4', label:'Role-less portal option', hard:'listbox options are bare <div>s (K32)',
      cap:'countryOpen', oracle:'opt-india', exec:'countryOpen', want:{final:'FAILED', category:'REMOVAL', note:'route to search-and-pick (P2)'} },
    { id:'C5', label:'Nameless gear icon', hard:'no accessible name/anchor',
      cap:'checkoutDisabled', oracle:'gear', exec:'checkoutDisabled', want:{final:'ABSTAIN', category:'AMBIGUITY', recordFlag:'no-anchor'} },
    { id:'C6', label:'Drift on modal (Save card)', hard:'restyle hashes #saveCard',
      cap:'modal1', oracle:'savecard', exec:'modal1', drift:'restyle', want:{final:'PASS_HEALED', category:'DRIFT'} }
  ];

  root.PAYMENT_FIXTURES = { STATES, CASES };
})(typeof window !== 'undefined' ? window : globalThis);
