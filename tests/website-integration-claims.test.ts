import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, resolve, sep } from 'node:path';
import test from 'node:test';
import { runInThisContext } from 'node:vm';
import type { Metadata } from 'next';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { toPublicGuardResult } from '../lib/guard/publicResult';
import type { GuardAction, GuardResult } from '../lib/guard/types';

const root = process.cwd();
const nativeRequire = createRequire(resolve(root, 'package.json'));
type PageModule = { default: ComponentType; metadata: Metadata };
const modules = new Map<string, { exports: Record<string, unknown> }>();

/**
 * Execute the real server components without launching Next or a server.
 * CSS and next/font/local are build-only adapters; nothing that makes product
 * decisions, emits schema, renders controls or handles installation is mocked.
 * The loader is restricted to local source under this checkout.
 */
function loadSource(file: string): Record<string, unknown> {
  const path = resolve(file);
  assert.ok(path.startsWith(root + sep), 'render fixture must stay in this checkout');
  const cached = modules.get(path);
  if (cached) return cached.exports;
  const module = { exports: {} as Record<string, unknown> };
  modules.set(path, module);
  const source = readFileSync(path, 'utf8');
  const compiled = ts.transpileModule(source, {
    fileName: path,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    reportDiagnostics: true,
  });
  assert.equal(compiled.diagnostics?.length ?? 0, 0, `invalid source: ${path}`);
  const localRequire = (id: string): unknown => {
    if (id.endsWith('.css')) return {};
    if (id === 'next/font/local') return (options: { variable: string }) => ({ variable: options.variable });
    if (id.startsWith('@/') || id.startsWith('.')) {
      const target = id.startsWith('@/') ? resolve(root, id.slice(2)) : resolve(dirname(path), id);
      const candidates = extname(target) ? [target] : [target + '.ts', target + '.tsx', target + '/index.ts'];
      const found = candidates.find((candidate) => existsSync(candidate));
      assert.ok(found, `local dependency not found: ${id}`);
      if (extname(found) === '.json') return JSON.parse(readFileSync(found, 'utf8'));
      return loadSource(found);
    }
    return nativeRequire(id);
  };
  const execute = runInThisContext(
    `(function(exports, require, module) {${compiled.outputText}\n})`,
    { filename: path },
  );
  execute(module.exports, localRequire, module);
  return module.exports;
}

function page(route: string) {
  const candidates = [resolve(root, 'app' + route, 'page.tsx'), resolve(root, 'app/(public)' + route, 'page.tsx')];
  const files = candidates.filter((file) => existsSync(file));
  assert.equal(files.length, 1, `the public ${route} route must have exactly one page file`);
  const file = files[0];
  const loaded = loadSource(file) as PageModule;
  const html = renderToStaticMarkup(createElement(loaded.default));
  const text = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/\s+/g, ' ').trim();
  return { html, text, metadata: loaded.metadata };
}

function markupPage(html: string) {
  assert.match(html, /data-sa-theme="light"/, 'use the existing light Mark-up root');
  assert.match(html, /class="sa-page"/, 'use the existing Mark-up page layout');
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1, 'one visible H1 per route');
}

function metadataFits(metadata: Metadata, route: string) {
  const title = typeof metadata.title === 'string'
    ? metadata.title + ' | soterai.in'
    : (metadata.title as { absolute?: string })?.absolute ?? '';
  assert.ok(title.length > 0 && title.length <= 60, `title including suffix is ${title.length}: ${title}`);
  assert.ok(metadata.description && metadata.description.length <= 155, 'description must fit 155 characters');
  assert.equal(metadata.alternates?.canonical, route, 'canonical route must be preserved');
}

function schemaNodes(html: string): Array<Record<string, unknown>> {
  return [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .map((match) => JSON.parse(match[1]));
}

function hasLinks(html: string, links: string[]) {
  for (const href of links) {
    assert.ok(html.includes(`href="${href.replace(/&/g, '&amp;')}"`), `keep working link ${href}`);
  }
}

test('case studies index identifies the analysis as illustrative, not customer proof', () => {
  const result = page('/case-studies');
  assert.match(result.text, /illustrative/i, 'the index must label the unverified scenario before readers open it');
  assert.match(result.text, /not (?:a |verified )?customer/i, 'do not imply a verified customer deployment');
  assert.doesNotMatch(result.text + ' ' + JSON.stringify(result.metadata), /real AI security (?:incidents|deployments)|zero configuration|guard layer made the difference/i);
  markupPage(result.html);
  metadataFits(result.metadata, '/case-studies');
  hasLinks(result.html, ['/case-studies/prompt-injection-leaks-database', '/contact-sales']);
});

test('the illustrative scenario route makes no measured customer or prevention claim', () => {
  const result = page('/case-studies/prompt-injection-leaks-database');
  assert.match(result.text, /illustrative/i);
  assert.match(result.text, /not a (?:verified )?customer/i);
  assert.match(result.text, /no (?:verified|measured)/i);
  assert.match(result.text, /authorization/i, 'a guard is not a substitute for database access control');
  assert.doesNotMatch(result.text + ' ' + JSON.stringify(result.metadata), /zero[- ]configuration|could have prevented|entire enterprise database|\b\d+%\b/i);
  markupPage(result.html);
  metadataFits(result.metadata, '/case-studies/prompt-injection-leaks-database');
  hasLinks(result.html, ['/case-studies', '/docs/rest-api', '/limitations', '/contact-sales', '/signup']);
  const article = schemaNodes(result.html).find((node) => node['@type'] === 'Article' || node['@type'] === 'BlogPosting');
  assert.ok(article, 'keep an editorial structured-data node');
  assert.match(String(article.headline) + ' ' + String(article.description), /illustrative/i);
});

function visibleFaqMatches(result: ReturnType<typeof page>, questions: string[]) {
  const faq = schemaNodes(result.html).find((node) => node['@type'] === 'FAQPage');
  assert.ok(faq, 'preserve the FAQ structured data');
  const entries = faq.mainEntity as Array<{ name: string; acceptedAnswer: { text: string } }>;
  assert.deepEqual(entries.map((entry) => entry.name), questions, 'preserve existing FAQ questions');
  for (const entry of entries) {
    assert.ok(result.text.includes(entry.name), `show the FAQ question ${entry.name}`);
    assert.ok(result.text.includes(entry.acceptedAnswer.text.replace(/\s+/g, ' ').trim()), `visible FAQ must match schema: ${entry.name}`);
  }
  assert.equal((result.html.match(/<details\b/g) ?? []).length, questions.length, 'FAQs stay keyboard-operable without JS');
  const howTo = schemaNodes(result.html).find((node) => node['@type'] === 'HowTo');
  assert.ok(howTo, 'preserve the installation HowTo schema');
  for (const step of howTo.step as Array<{ name: string; text: string }>) {
    assert.ok(result.text.includes(step.name) && result.text.includes(step.text), 'HowTo steps must remain visible');
  }
  assert.ok(schemaNodes(result.html).some((node) => node['@type'] === 'BreadcrumbList'), 'keep breadcrumb schema');
}

test('n8n is a bounded Beta guard with the same node install and routing controls', () => {
  const result = page('/integrations/n8n');
  assert.match(result.text, /Beta/, 'show the same maturity as the integrations hub');
  assert.match(result.text, /limited testing/i);
  assert.match(result.text, /bypass/i);
  assert.doesNotMatch(result.text + ' ' + JSON.stringify(result.metadata), /under 10 minutes|strongest workflow|no (?:command line or )?package install required|every AI step is (?:guarded|protected)/i);
  markupPage(result.html);
  metadataFits(result.metadata, '/integrations/n8n');
  hasLinks(result.html, ['https://www.npmjs.com/package/n8n-nodes-soterai', '/signup', '/ai-workflow-security', '/ai-agent-security', '/integrations', '/integrations/zapier', '/integrations/make', '/limitations']);
  for (const token of ['n8n-nodes-soterai', 'ck_live_', 'https://soterai.in', 'Universal AI Firewall (Best Protection)', 'Maximum Protection', 'On Threat = Block', 'Security Context', '{{ $json.outputText }}', 'Safe', 'Flagged']) {
    assert.ok(result.text.includes(token), `preserve the documented node value ${token}`);
  }
  visibleFaqMatches(result, [
    'Do I need to install a package to use the SoterAI node?',
    'Where is the SoterAI node available?',
    'Which n8n node types does SoterAI work with?',
    'Will SoterAI slow down my n8n workflows?',
    'Does SoterAI work with n8n self-hosted deployments?',
    'What happens when the node detects an attack?',
  ]);
});

test('Make is a Beta HTTP guide using documented requests and explicit verdict routing', () => {
  const result = page('/integrations/make');
  assert.match(result.text, /Beta/);
  assert.match(result.text, /not a native/i);
  assert.match(result.text, /bypass/i);
  assert.doesNotMatch(result.text + ' ' + JSON.stringify(result.metadata), /every AI step is guarded|\/(?:v1)\/guard\/(?:input|output)|Bearer YOUR_API_KEY|redactedInput|complete coverage/i);
  markupPage(result.html);
  metadataFits(result.metadata, '/integrations/make');
  hasLinks(result.html, ['/signup', '/docs/rest-api', '/ai-workflow-security', '/integrations/n8n', '/integrations/zapier', '/ai-agent-security', '/limitations']);
  for (const token of ['SOTER_BASE_URL', 'SOTER_API_KEY', '/api/guard/input', '/api/guard/output', 'x-api-key', '"message"', '"aiResponse"', 'ALLOW', 'ALLOW_WITH_REDACTION', 'HUMAN_REVIEW']) {
    assert.ok(result.text.includes(token), `use the existing REST contract value ${token}`);
  }
  visibleFaqMatches(result, [
    "Does SoterAI work with Make.com's native AI modules?",
    "Can I use SoterAI with Make's self-hosted (on-premise) edition?",
    'How does SoterAI handle Make error branches?',
    'What is the latency impact on Make scenarios?',
  ]);
});

test('Zapier is a Beta webhook guide without automatic protection or native-app promises', () => {
  const result = page('/integrations/zapier');
  assert.match(result.text, /Beta/);
  assert.match(result.text, /not a native/i);
  assert.match(result.text, /bypass/i);
  assert.doesNotMatch(result.text + ' ' + JSON.stringify(result.metadata), /every AI action is protected|\/(?:v1)\/guard\/(?:input|output)|native Zapier app is on the roadmap|Authorization: Bearer/i);
  markupPage(result.html);
  metadataFits(result.metadata, '/integrations/zapier');
  hasLinks(result.html, ['/signup', '/docs/rest-api', '/ai-workflow-security', '/integrations/n8n', '/integrations/make', '/ai-agent-security', '/limitations']);
  for (const token of ['Webhooks by Zapier', 'Filter by Zapier', 'SOTER_BASE_URL', 'SOTER_API_KEY', '/api/guard/input', '/api/guard/output', 'x-api-key', '"message"', '"aiResponse"', 'ALLOW', 'ALLOW_WITH_REDACTION', 'HUMAN_REVIEW']) {
    assert.ok(result.text.includes(token), `preserve or document the correct webhook control ${token}`);
  }
  visibleFaqMatches(result, [
    'How does SoterAI integrate with Zapier?',
    'Can SoterAI stop a Zapier workflow if it detects an attack?',
    'Does SoterAI detect India-specific PII in Zapier workflows?',
    'Is there a Zapier native app for SoterAI?',
  ]);
});

test('IDE install targets are distinct from scoped VS Code runtime coverage', () => {
  const result = page('/extensions/ide');
  assert.match(result.text, /Beta/);
  assert.match(result.text, /runtime coverage is scoped to VS Code/i);
  assert.doesNotMatch(result.text + ' ' + JSON.stringify(result.metadata), /open source|one guard\. six familiar editors|packaged runtime verified|without exposing your private data/i);
  markupPage(result.html);
  metadataFits(result.metadata, '/extensions/ide');
  hasLinks(result.html, ['/', '#editors', '/contact-sales', '/docs', '/support', 'mailto:support@soterai.in?subject=IDE%20Guard%20issue',
    'https://marketplace.visualstudio.com/items?itemName=soterai.soterai-ide-guard', 'https://open-vsx.org/extension/soterai/soterai-ide-guard',
    'https://open-vsx.org/api/soterai/soterai-ide-guard/0.6.3/file/soterai.soterai-ide-guard-0.6.3.vsix',
    'https://open-vsx.org/api/soterai/soterai-ide-guard/0.6.3/file/soterai.soterai-ide-guard-0.6.3.sha256']);
  const targets = [
    ['Visual Studio Code', 'vscode', 'code'], ['Cursor', 'cursor', 'cursor'], ['Windsurf', 'windsurf', 'windsurf'],
    ['Kiro', 'kiro', 'kiro'], ['Antigravity', 'antigravity', 'antigravity'], ['VSCodium', 'vscodium', 'codium'],
  ];
  for (const [name, protocol, command] of targets) {
    hasLinks(result.html, [`${protocol}:extension/soterai.soterai-ide-guard`]);
    assert.ok(result.text.includes(`${command} --install-extension soterai.soterai-ide-guard`), `keep the ${name} install command`);
    assert.ok(result.html.includes(`data-editor="${name}" data-runtime-coverage="${name === 'Visual Studio Code' ? 'scoped-vs-code' : 'untested'}"`), `honest runtime label for ${name}`);
  }
  assert.equal((result.html.match(/aria-label="Copy install command"/g) ?? []).length, 6, 'keep all copy controls');
  assert.match(result.html, /aria-label="Redirect to Visual Studio Code to install SoterAI IDE Guard"/, 'preserve the one-click install handler');
  assert.match(result.html, /id="editors"/);
  assert.match(result.html, /id="coverage-heading"/);
  assert.match(result.html, /control-panel-protection\.png/);
  const application = schemaNodes(result.html).find((node) => node['@type'] === 'SoftwareApplication');
  assert.ok(application, 'preserve the software application schema');
  assert.equal(application.softwareVersion, '0.6.3');
});

test('Browser Guard preserves both install guides while disclosing limited Beta coverage', () => {
  const result = page('/extensions/browser');
  assert.match(result.text, /Beta/);
  assert.match(result.text, /Chrome and Edge only/i);
  assert.match(result.text, /AI (?:tool|provider)/i);
  assert.doesNotMatch(result.text + ' ' + JSON.stringify(result.metadata), /guard every AI conversation|every prompt is inspected|20\+ AI tools covered|no configuration required|complete coverage/i);
  markupPage(result.html);
  metadataFits(result.metadata, '/extensions/browser');
  hasLinks(result.html, ['/', '/extensions/browser/chrome', '/extensions/browser/edge', '/privacy', '/extensions/ide', '/integrations', '/docs/rest-api']);
  assert.equal((result.html.match(/href="\/extensions\/browser\/chrome"/g) ?? []).length, 2, 'keep both Chrome install controls');
  assert.equal((result.html.match(/href="\/extensions\/browser\/edge"/g) ?? []).length, 2, 'keep both Edge install controls');
  for (const boundary of ['Raw prompt to SoterAI', 'Scanning location', 'Stored locally', 'Backend audit event']) {
    assert.ok(result.text.includes(boundary), `preserve privacy disclosure ${boundary}`);
  }
});

test('the illustrative-analysis pathname has only one App Router page', () => {
  const candidates = [
    'app/case-studies/prompt-injection-leaks-database/page.tsx',
    'app/(public)/case-studies/prompt-injection-leaks-database/page.tsx',
  ];
  assert.equal(candidates.filter((file) => existsSync(resolve(root, file))).length, 1,
    'route groups must not create a duplicate public pathname');
});

function guardActions(): GuardAction[] {
  const file = resolve(root, 'lib/guard/types.ts');
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const declaration = source.statements.find((node): node is ts.TypeAliasDeclaration =>
    ts.isTypeAliasDeclaration(node) && node.name.text === 'GuardAction');
  assert.ok(declaration && ts.isUnionTypeNode(declaration.type), 'read the actual server GuardAction union');
  return declaration.type.types.map((node) => {
    assert.ok(ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal), 'GuardAction must consist of exact strings');
    return node.literal.text as GuardAction;
  });
}

test('the public guard serializer preserves the real action, permission flag and cleaned-text fields', () => {
  const actions = guardActions();
  assert.deepEqual(actions, ['ALLOW', 'ALLOW_WITH_REDACTION', 'REWRITE', 'BLOCK', 'HUMAN_REVIEW']);
  assert.ok(!actions.includes('REDACT' as GuardAction), 'the hero display verdict is not a raw API action');
  for (const action of actions) {
    for (const allowed of [true, false]) {
      // Explicitly synthetic adapter fixture, NOT a measured engine/HTTP response.
      const fixture: GuardResult = {
        action, allowed, riskScore: 0, riskTypes: [], findings: [],
        reason: 'Synthetic public-adapter contract fixture; not an engine response',
        originalText: 'Synthetic original text',
        redactedText: action === 'ALLOW_WITH_REDACTION' ? 'Synthetic cleaned text' : undefined,
        safeText: action === 'REWRITE' ? 'Synthetic rewritten text' : undefined,
      };
      const result = toPublicGuardResult(fixture);
      assert.equal(result.action, action);
      assert.equal(result.allowed, allowed, 'the action alone is not permission');
      assert.equal(result.redactedText, fixture.redactedText);
      assert.equal(result.safeText, fixture.safeText);
      assert.equal('originalText' in result, false);
    }
  }
});

function renderedRoutingMatchesContract(route: '/integrations/make' | '/integrations/zapier') {
  const result = page(route);
  const howTo = schemaNodes(result.html).find((node) => node['@type'] === 'HowTo');
  assert.ok(howTo);
  const steps = howTo.step as Array<{ name: string; text: string }>;
  const setup = result.html.match(/<section\b[^>]*aria-labelledby="setup"[^>]*>([\s\S]*?)<\/section>/)?.[1];
  assert.ok(setup, 'assert the actual rendered setup section, not hidden schema text');
  const visibleBodies = [...setup.matchAll(/<p class="sa-body">([^<]*)<\/p>/g)].map((match) => match[1]
    .replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&gt;/g, '>').replace(/&lt;/g, '<'));
  assert.deepEqual(visibleBodies, steps.map((step) => step.text), 'visible HowTo bodies must exactly match structured data');
  const routing = visibleBodies[3];
  const limitsHtml = result.html.match(/<section\b[^>]*aria-labelledby="limits"[^>]*>([\s\S]*?)<\/section>/)?.[1];
  assert.ok(limitsHtml);
  const limits = limitsHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const actions = guardActions();
  const evidence = process.env.SOTER_REPAIR_PHASE
    ? resolve(root, 'docs/redesign/evidence/repair-cycle-1', process.env.SOTER_REPAIR_PHASE) : null;
  const observation = { route, actions, routing, limits, visible_bodies: visibleBodies, howto_bodies: steps.map((step) => step.text), passed: false };
  try {
    assert.doesNotMatch(routing + ' ' + limits, /\bREDACT\b/, 'never route on the hero display verdict REDACT');
    // Prose acronyms such as AI are not raw action values.
    const actionPattern = new RegExp('\\b(?:' + [...actions, 'REDACT'].join('|') + ')\\b', 'g');
    const documentedActions = [...new Set(routing.match(actionPattern) ?? [])].sort();
    assert.deepEqual(documentedActions, [...actions].sort(), 'routing must cover exactly the real API action contract');
    assert.match(routing, /allowed exactly true and action exactly ALLOW\b/, 'ordinary continuation needs an exact boolean grant and ALLOW action');
    assert.match(routing, /For action ALLOW_WITH_REDACTION, require allowed exactly true and a non-empty redactedText or safeText; pass only that cleaned text/, 'redaction needs permission AND returned cleaned text, never the raw input');
    assert.match(routing, /For action REWRITE, require allowed exactly true and a non-empty safeText; pass only that rewritten text/, 'rewriting requires the actual rewritten safeText, not merely redactedText');
    assert.match(routing, /Stop(?: or send for review)? on BLOCK or HUMAN_REVIEW/);
    assert.match(routing, /Stop when allowed is false or missing, the action is unknown or missing, required cleaned text is absent, or the result is invalid or unavailable/, 'malformed, unpermitted and unavailable results must stop');
    for (const action of actions) assert.match(limits, new RegExp('\\b' + action + '\\b'), `exercise the real ${action} action in the limitations checklist`);
    assert.match(limits, /missing or empty cleaned text/);
    assert.match(limits, /allowed false or missing/);
    assert.match(limits, /invalid or unavailable responses and API failures/);
    observation.passed = true;
  } finally {
    if (evidence) {
      assert.match(process.env.SOTER_REPAIR_PHASE!, /^[a-z][a-z0-9-]*$/);
      mkdirSync(evidence, { recursive: true });
      const name = route.endsWith('/make') ? 'make' : 'zapier';
      writeFileSync(resolve(evidence, name + '.rendered.html'), result.html);
      writeFileSync(resolve(evidence, name + '.routing-observed.json'), JSON.stringify(observation, null, 2) + '\n');
    }
  }
}

test('Make renders exact API branches with permission, cleaned-text and fail-closed requirements', () => {
  renderedRoutingMatchesContract('/integrations/make');
});

test('Zapier renders exact API branches with permission, cleaned-text and fail-closed requirements', () => {
  renderedRoutingMatchesContract('/integrations/zapier');
});
