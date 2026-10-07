import http from 'node:http';

const activePassports = new Map();

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    let json = {};
    try { if (body) json = JSON.parse(body); } catch {}
    console.log(`[API MOCK] ${req.method} ${req.url}`);

    res.setHeader('Content-Type', 'application/json');
    const url = req.url;

    if (url === '/api/health') {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'ok', healthy: true }));
    } else if (url === '/api/guard/input') {
      res.writeHead(200);
      res.end(JSON.stringify({
        allowed: true,
        action: 'ALLOW',
        riskScore: 0,
        categories: ['LOW_RISK'],
        reason: 'Safe query passed cloud check'
      }));
    } else if (url === '/api/guard/output') {
      res.writeHead(200);
      res.end(JSON.stringify({
        allowed: true,
        action: 'ALLOW',
        riskScore: 0,
        safeText: json.text,
        reason: 'Safe output passed cloud check'
      }));
    } else if (url === '/api/agent/identity/create') {
      const isCustom = json.policyPreset === 'CUSTOM' || json.preset === 'CUSTOM';
      res.writeHead(200);
      res.end(JSON.stringify({
        id: 'agent_id_live_' + Date.now(),
        name: json.name || 'EnterpriseAgent',
        agentType: json.agentType || 'CHATBOT',
        status: 'ACTIVE',
        defaultPolicy: {
          allowedTools: isCustom ? [] : ['orders.read'],
          blockedTools: ['system.delete'],
          approvalRequiredTools: ['gmail.send']
        },
        enrolledAt: new Date().toISOString()
      }));
    } else if (url === '/api/agent/passport/issue') {
      const sessionId = json.sessionId || 'session_' + Date.now();
      const onConflict = json.onSessionConflict || json.conflictStrategy;
      if (onConflict === 'REUSE' && activePassports.has(sessionId)) {
        const existing = activePassports.get(sessionId);
        res.writeHead(200);
        res.end(JSON.stringify({
          passportId: existing.passportId,
          agentIdentityId: existing.agentIdentityId,
          sessionId: existing.sessionId,
          reused: true,
          status: 'ACTIVE',
          tokenSafety: 'Passport reused. Note: raw passportToken is only provided upon initial issue or rotation.'
        }));
        return;
      }

      const pass = {
        passportId: 'pass_live_' + Date.now(),
        agentIdentityId: json.agentIdentityId || 'agent_id_001',
        sessionId: sessionId,
        passportToken: 'sotp_live_' + Math.random().toString(36).slice(2, 14) + Date.now().toString(36),
        status: 'ACTIVE',
        expiresAt: new Date(Date.now() + (json.ttlSeconds || 3600) * 1000).toISOString()
      };
      activePassports.set(sessionId, pass);

      res.writeHead(200);
      res.end(JSON.stringify(pass));
    } else if (url === '/api/agent/passport/validate') {
      const isUnauthorized = json.toolName === 'unauthorized_admin_nuke' || json.tool === 'unauthorized_admin_nuke';
      res.writeHead(200);
      res.end(JSON.stringify({
        valid: !isUnauthorized,
        allowed: !isUnauthorized,
        decision: isUnauthorized ? 'BLOCK' : 'ALLOW',
        verdictCode: isUnauthorized ? 'TOOL_UNAUTHORIZED' : 'ALLOW',
        reason: isUnauthorized ? 'Tool unauthorized by passport policy' : 'Passport valid',
        agentIdentityId: 'agent_id_001',
        sessionId: json.sessionId || 'session_001',
        passportId: 'pass_live_001'
      }));
    } else if (url === '/api/agent/tool/check') {
      const tool = json.tool || json.toolName;
      const isApproval = (tool === 'gmail.send' || json.action === 'send_email_externally');
      const isAllowed = !isApproval;

      res.writeHead(200);
      res.end(JSON.stringify({
        allowed: isAllowed,
        decision: isApproval ? 'ASK_APPROVAL' : 'ALLOW',
        tool: tool || 'orders.read',
        action: json.action || 'read',
        passportId: 'pass_live_001',
        sessionId: json.sessionId || 'session_001',
        riskLevel: isApproval ? 'MEDIUM' : 'LOW',
        reason: isApproval ? 'Sending external email requires approval' : 'Read-only tool action allowed by policy'
      }));
    } else if (url === '/api/agent/passport/revoke') {
      // Bug 5 fix verification: revoking by sessionId alone MUST succeed cleanly
      if (json.sessionId) {
        activePassports.delete(json.sessionId);
      }
      res.writeHead(200);
      res.end(JSON.stringify({
        revoked: true,
        status: 'PASSPORT_REVOKED',
        sessionId: json.sessionId || null,
        passportId: json.passportId || 'pass_live_001',
        revokedAt: new Date().toISOString()
      }));
    } else if (url === '/api/workflow/audit') {
      res.writeHead(200);
      res.end(JSON.stringify({
        workflowScore: 85,
        riskLevel: 'LOW',
        findings: []
      }));
    } else {
      res.writeHead(200);
      res.end(JSON.stringify({ status: 'ok' }));
    }
  });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ SoterAI API test server listening on http://0.0.0.0:${PORT}`);
});
