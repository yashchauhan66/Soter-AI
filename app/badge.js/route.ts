import { BRAND, INK } from "@/lib/brand";

/**
 * Embeddable "Protected by SoterAI" badge.
 *
 * ## Why the colours are literals
 *
 * This script runs on the **customer's** page, so our stylesheet does not exist
 * there — no Tailwind, no CSS variables. Values come from `lib/brand.ts`, which is
 * also why this file kept the old teal `#31d7c8` long after the site went light:
 * a literal cannot be reached by a theme change.
 *
 * ## Why the badge paints its own white pill
 *
 * It has to be legible on a host page whose background we do not control and
 * cannot measure. The previous version was a near-black pill with the customer's
 * brand colour as the *text*, which had two problems: it clashed with light host
 * pages, and a customer whose brand colour is pale (or white) got an unreadable
 * badge with no way to know.
 *
 * The white pill with a hairline border reads on any background, and the tenant's
 * colour now drives only the **dot and the border** — decorative roles where any
 * hue is acceptable. The label stays at a fixed, known-legible ink.
 *
 * `safeColor` is a security control, not styling: `data-project-id` and the
 * fetched `brandColor` are attacker-influencable, and this value is assigned to
 * `style.cssText`. The allowlist keeps a hostile value from injecting extra CSS
 * declarations.
 */
const SCRIPT = String.raw`(function(){
  var current = document.currentScript;
  if(!current){return;}
  var slug = current.getAttribute('data-project-id') || current.getAttribute('data-slug');
  if(!slug){return;}
  var origin = (function(){
    try { return new URL(current.src).origin; } catch(e) { return ''; }
  })();
  var endpoint = origin + '/api/badge/' + encodeURIComponent(slug);
  var statusUrl = origin + '/security-status/' + encodeURIComponent(slug);
  fetch(endpoint, { credentials: 'omit' }).then(function(r){ return r.ok ? r.json() : null; }).then(function(data){
    if(!data){return;}
    function safeColor(value){
      if(typeof value !== 'string'){ return '${BRAND}'; }
      var trimmed = value.trim();
      if(/^#[0-9a-fA-F]{3,8}$/.test(trimmed)){ return trimmed; }
      if(/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/.test(trimmed)){ return trimmed; }
      if(/^hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/.test(trimmed)){ return trimmed; }
      return '${BRAND}';
    }
    var color = safeColor(data.brandColor);
    var label = ({
      PROTECTED: 'Protected',
      MONITORING_ACTIVE: 'Monitoring active',
      ISSUES_FOUND: 'Risks blocked',
      INACTIVE: 'Inactive'
    })[data.status] || 'Monitoring';
    var node = document.createElement('a');
    node.href = statusUrl;
    node.target = '_blank';
    node.rel = 'noopener noreferrer';
    node.style.cssText = [
      'display:inline-flex','align-items:center','gap:8px',
      'padding:8px 14px','border-radius:6px',
      'font-family:system-ui,-apple-system,sans-serif','font-size:13px','font-weight:600',
      'color:${INK.body}','background:${INK.page}',
      'border:1px solid '+color,
      'text-decoration:none','box-shadow:0 1px 2px rgba(15,23,42,0.06)'
    ].join(';');
    var dot = document.createElement('span');
    dot.style.cssText = 'width:8px;height:8px;border-radius:9999px;display:inline-block;';
    dot.style.background = color;
    node.appendChild(dot);
    node.appendChild(document.createTextNode('SoterAI - ' + label));
    if(current.parentNode){ current.parentNode.insertBefore(node, current); }
  }).catch(function(){});
})();`;

export const dynamic = "force-static";

export async function GET() {
  return new Response(SCRIPT, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Access-Control-Allow-Origin": "*",
      "Vary": "Origin",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
