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
      if(typeof value !== 'string'){ return '#31d7c8'; }
      var trimmed = value.trim();
      if(/^#[0-9a-fA-F]{3,8}$/.test(trimmed)){ return trimmed; }
      if(/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/.test(trimmed)){ return trimmed; }
      if(/^hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/.test(trimmed)){ return trimmed; }
      return '#31d7c8';
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
      'padding:8px 14px','border-radius:9999px',
      'font-family:system-ui,-apple-system,sans-serif','font-size:13px','font-weight:600',
      'color:'+color,'background:rgba(8,17,31,0.92)',
      'border:1px solid '+color,
      'text-decoration:none','box-shadow:0 0 16px rgba(49,215,200,0.18)'
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
      "X-Content-Type-Options": "nosniff",
    },
  });
}
