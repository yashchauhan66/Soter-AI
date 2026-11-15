'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AfterView, ReviewDocument, ReviewNotes } from './ReviewView';
import { Callout, SaButton, Stamp } from './primitives';
import { RECORDED_AT, RECORDED_RESULT, RECORDED_TEXT } from '@/lib/sa/recorded';
import { GENERAL_LIMIT } from '@/lib/sa/claims';
import { requestAnalysis } from '@/lib/sa/client';
import { ALL_PRESETS, type Preset } from '@/lib/sa/presets';
import { buildReview, type AnalyzeResult, type Direction } from '@/lib/sa/review';

/**
 * Home page hero demo.
 *
 * First paint shows a RECORDED response (dated, and labelled as recorded) so the
 * page has something real to look at without calling the engine for every visitor.
 * The moment the visitor runs their own text, it is replaced by a LIVE response from
 * the same endpoint the playground uses. The label changes with it, so a visitor can
 * always tell which one they are looking at.
 *
 * It does not auto-play, loop or fake typing. The old hero ran a scripted loop under
 * a "REAL-TIME" badge with invented latencies; none of that is here.
 */

const QUICK = ['injection', 'aadhaar-pan', 'api-key', 'hinglish', 'tool-call'] as const;

type Shown =
  | { kind: 'recorded' }
  | { kind: 'live'; text: string; result: AnalyzeResult; serverMs?: number; roundTripMs: number; extraLimit?: string }
  | { kind: 'busy' }
  | { kind: 'limited' }
  | { kind: 'error'; message: string };

export function HeroDemo() {
  const [shown, setShown] = useState<Shown>({ kind: 'recorded' });
  const [active, setActive] = useState<string>('personal-data');

  const quick: Preset[] = QUICK.map((id) => ALL_PRESETS.find((p) => p.id === id)).filter((p): p is Preset => Boolean(p));

  async function run(preset: Preset) {
    setActive(preset.id);
    setShown({ kind: 'busy' });
    const ctl = new AbortController();
    const analysis = await requestAnalysis(preset.text.trim(), preset.direction as Direction, ctl.signal);
    if (analysis.aborted) return;
    const o = analysis.outcome;
    if (o.kind === 'result') {
      setShown({ kind: 'live', text: preset.text.trim(), result: o.result, serverMs: o.serverMs, roundTripMs: o.roundTripMs, extraLimit: preset.limit });
    } else if (o.kind === 'rate-limited') {
      setShown({ kind: 'limited' });
    } else {
      setShown({ kind: 'error', message: o.message });
    }
  }

  const text = shown.kind === 'live' ? shown.text : RECORDED_TEXT;
  const result = shown.kind === 'live' ? shown.result : RECORDED_RESULT;
  const model = buildReview(text, result);
  const showResult = shown.kind === 'recorded' || shown.kind === 'live';

  const findingLabels = [...new Set((result.findings ?? []).map((finding) => finding.label))];

  return (
    <div className="sa-hero-demo">
      <div className="sa-hero-demo__bar">
        <span className="sa-label">One text, one decision</span>
        {shown.kind === 'live' ? (
          <span className="sa-badge sa-badge--stable">Live engine</span>
        ) : shown.kind === 'recorded' ? (
          <span className="sa-badge sa-badge--beta">Recorded {RECORDED_AT}</span>
        ) : (
          <span className="sa-label" role="status">{shown.kind === 'busy' ? 'Live request in progress' : 'No engine result'}</span>
        )}
      </div>

      <div aria-live="polite" aria-atomic="false">
        {showResult ? (
          <div className="sa-hero-demo__story">
            <div className="sa-field">
              <span className="sa-label">Input · marked by the engine</span>
              <ReviewDocument model={model} idPrefix="hero" animate={shown.kind === 'live'} />
            </div>
            <div className="sa-hero-demo__decision">
              <Stamp verdict={model.verdict} />
              <p className="sa-hero-demo__finding">
                {findingLabels.length > 0 ? <>Found: {findingLabels.join(' · ')}</> : 'The engine reported no findings.'}
              </p>
            </div>
            <AfterView result={result} verdict={model.verdict} />
            <details className="sa-disclosure sa-hero-demo__details">
              <summary>Findings, scores &amp; timings</summary>
              <div className="sa-stack">
                <ReviewNotes model={model} idPrefix="hero" />
                <div className="sa-result__foot">
                  <Stamp verdict={model.verdict} risk={model.riskScore} />
                  {shown.kind === 'live' ? (
                    <dl className="sa-timing" style={{ margin: 0 }}>
                      <dt>engine</dt>{' '}
                      <dd>{typeof shown.serverMs === 'number' ? `${shown.serverMs} ms` : 'not reported'}</dd>{' '}
                      <dt>round trip</dt> <dd>{shown.roundTripMs} ms</dd>
                    </dl>
                  ) : (
                    <p className="sa-muted" style={{ margin: 0, fontSize: 'var(--sa-text-sm)' }}>
                      Recorded from the live engine on {RECORDED_AT}. It took {RECORDED_RESULT.latencyMs} ms on the server.
                    </p>
                  )}
                </div>
                <p className="sa-hero-demo__limit">
                  {shown.kind === 'live' && shown.extraLimit ? <>{shown.extraLimit} </> : null}
                  One request, not a performance benchmark. {GENERAL_LIMIT}
                </p>
              </div>
            </details>
          </div>
        ) : shown.kind === 'busy' ? (
          <div className="sa-empty" aria-busy="true">
            <p style={{ margin: 0 }}>Checking with the live engine…</p>
          </div>
        ) : shown.kind === 'limited' ? (
          <Callout kind="limit" title="Rate limit reached">
            The public playground allows a limited number of checks per minute. That is a usage limit, not a verdict on
            your text. Try again in a moment.
          </Callout>
        ) : (
          <Callout kind="error" title="No result">
            {shown.kind === 'error' ? shown.message : ''} No result is shown, because this page never invents one.
          </Callout>
        )}
      </div>

      <details className="sa-disclosure sa-hero-demo__examples">
        <summary>Run a live example</summary>
        <div className="sa-field">
          <span className="sa-label" id="hero-presets">Sample text · public, rate-limited engine</span>
          <ul className="sa-chips" aria-labelledby="hero-presets">
            {quick.map((p) => (
              <li key={p.id}>
                <SaButton
                  variant="secondary"
                  aria-pressed={active === p.id && shown.kind !== 'recorded'}
                  disabled={shown.kind === 'busy'}
                  onClick={() => run(p)}
                >
                  {p.label}
                </SaButton>
              </li>
            ))}
          </ul>
        </div>
      </details>
      <p className="sa-hero-demo__limit">
        {shown.kind === 'live' && shown.extraLimit ? <>{shown.extraLimit} </> : null}
        {GENERAL_LIMIT}
      </p>
      <Link className="sa-link sa-hero-demo__next" href="/playground">
        Paste your own text in the playground.
      </Link>
    </div>
  );
}

export type { AnalyzeResult };
