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
    var color = data.brandColor || '#31d7c8';
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
    node.innerHTML = '<span style="width:8px;height:8px;border-radius:9999px;background:'+color+';display:inline-block;"></span>'
      + 'CyberRakshak Guard · ' + label;
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
