// Strips the ground-truth marker from any DOM string before it reaches a judge.
// Used on both per-candidate outerHTML (see descriptor.mjs) and any raw nearby-DOM
// slice passed as extra context, since the marker is stamped once per case and can
// land inside either.
export function redactTruthMarker(html) {
  return html.replace(/\s*data-eval-truth="1"/g, '');
}
