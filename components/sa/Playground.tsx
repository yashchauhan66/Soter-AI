'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { CodeBlock } from './CodeBlock';
import { AfterView, ReviewDocument, ReviewNotes } from './ReviewView';
import { Callout, DataTable, SaButton, Stamp } from './primitives';
import { Tabs } from './Tabs';
import { GENERAL_LIMIT, PRIVACY_NOTE } from '@/lib/sa/claims';
import {
  ALL_PRESETS,
  ATTACK_PRESETS,
  LANGUAGE_LIMIT,
  LANGUAGE_PRESETS,
  SAFE_PRESETS,
  type Preset,
} from '@/lib/sa/presets';
import { requestAnalysis, secondsUntil } from '@/lib/sa/client';
import { buildReview, type AnalyzeOutcome, type AnalyzeResult, type Direction } from '@/lib/sa/review';

/** Must match MAX_TEXT_LENGTH in lib/guard/constants.ts (the server rejects longer text). */
const MAX_CHARS = 8000;
const REPRESENTATIVE_IDS = ['injection', 'personal-data', 'reply-leak', 'safe'];
const REPRESENTATIVE_PRESETS = REPRESENTATIVE_IDS.map((id) => ALL_PRESETS.find((preset) => preset.id === id))
  .filter((preset): preset is Preset => Boolean(preset));

type Phase =
  | { kind: 'idle' }
  | { kind: 'cancelled' }
  | { kind: 'loading' }
  | { kind: 'done'; outcome: Extract<AnalyzeOutcome, { kind: 'result' }>; sent: string; direction: Direction; extraLimit?: string }
  | { kind: 'rate-limited'; until: number }
  | { kind: 'rejected'; message: string }
  | { kind: 'unavailable'; message: string };

/**
 * The live demo. It calls the real engine and shows what comes back.
 *
 * Rules this component follows, each learned from the engine itself:
 *  - Send `text.trim()` and render that same string. The server trims before it
 *    analyses, so offsets are relative to the trimmed text.
 *  - Check the HTTP status before the body. A 429 body looks like a BLOCK verdict.
 *  - Never show canned output. On any failure, say what failed.
 *  - Show both times: server handling (from the response) and the round trip this
 *    browser measured.
 */
export function Playground({ initialPresetId }: { initialPresetId?: string }) {
  const uid = useId();
  const initial = ALL_PRESETS.find((p) => p.id === initialPresetId);

  const [text, setText] = useState(initial?.text ?? '');
  const [direction, setDirection] = useState<Direction>(initial?.direction ?? 'INPUT');
  const [activePreset, setActivePreset] = useState<string | null>(initial?.id ?? null);
  const [extraLimit, setExtraLimit] = useState<string | undefined>(initial?.limit);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [secondsLeft, setSecondsLeft] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const trimmed = text.trim();
  const overLimit = trimmed.length > MAX_CHARS;
  const empty = trimmed.length === 0;
  const loading = phase.kind === 'loading';

  // Countdown while rate limited. State is only set from the timer callback.
  const limitedUntil = phase.kind === 'rate-limited' ? phase.until : 0;
  useEffect(() => {
    if (!limitedUntil) return;
    const tick = () => {
      const left = secondsUntil(limitedUntil);
      setSecondsLeft(left);
      if (left === 0) setPhase((p) => (p.kind === 'rate-limited' ? { kind: 'idle' } : p));
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [limitedUntil]);

  // Cancel any request still in flight when the component goes away.
  useEffect(() => () => controller.current?.abort(), []);

  function invalidateResult() {
    controller.current?.abort();
    controller.current = null;
    // Editing is not a way around the server's rate-limit window.
    setPhase((current) => current.kind === 'rate-limited' ? current : { kind: 'idle' });
  }

  function choose(preset: Preset) {
    invalidateResult();
    setText(preset.text);
    setDirection(preset.direction);
    setActivePreset(preset.id);
    setExtraLimit(preset.limit);
  }

  function chooseLanguage(code: string) {
    const lang = LANGUAGE_PRESETS.find((l) => l.code === code);
    if (!lang) return;
    invalidateResult();
    setText(lang.text);
    setDirection('INPUT');
    setActivePreset(`lang-${lang.code}`);
    setExtraLimit(LANGUAGE_LIMIT);
  }

  function cancel() {
    controller.current?.abort();
    controller.current = null;
    setPhase({ kind: 'cancelled' });
    inputRef.current?.focus();
  }

  async function run() {
    if (empty || overLimit || loading || phase.kind === 'rate-limited') return;
    controller.current?.abort();
    const ctl = new AbortController();
    controller.current = ctl;

    const sent = trimmed;
    const sentDirection = direction;
    setPhase({ kind: 'loading' });

    const analysis = await requestAnalysis(sent, sentDirection, ctl.signal);
    if (analysis.aborted || controller.current !== ctl) return; // a newer request replaced this one

    const outcome = analysis.outcome;
    switch (outcome.kind) {
      case 'result':
        setPhase({ kind: 'done', outcome, sent, direction: sentDirection, extraLimit });
        break;
      case 'rate-limited':
        setPhase({ kind: 'rate-limited', until: analysis.retryAtMs ?? 0 });
        break;
      case 'rejected':
        setPhase({ kind: 'rejected', message: outcome.message });
        break;
      case 'unavailable':
        setPhase({ kind: 'unavailable', message: outcome.message });
        break;
    }
  }

  const counterId = `${uid}-count`;
  const inputId = `${uid}-input`;

  return (
    <div className="sa-play">
      <div className="sa-stack sa-play__editor">
        <div className="sa-field">
          <span className="sa-label" id={`${uid}-dir-label`}>
            What are you checking?
          </span>
          <div className="sa-segmented" role="group" aria-labelledby={`${uid}-dir-label`}>
            <button type="button" aria-pressed={direction === 'INPUT'} onClick={() => {
              if (direction === 'INPUT') return;
              invalidateResult();
              setDirection('INPUT');
              setActivePreset(null);
              setExtraLimit(undefined);
            }}>
              A prompt
            </button>
            <button type="button" aria-pressed={direction === 'OUTPUT'} onClick={() => {
              if (direction === 'OUTPUT') return;
              invalidateResult();
              setDirection('OUTPUT');
              setActivePreset(null);
              setExtraLimit(undefined);
            }}>
              A model reply
            </button>
          </div>
        </div>

        <div className="sa-field">
          <label className="sa-label" htmlFor={inputId}>
            Text to check
          </label>
          <textarea
            id={inputId}
            ref={inputRef}
            className="sa-textarea"
            value={text}
            onChange={(e) => {
              invalidateResult();
              setText(e.target.value);
              setActivePreset(null);
              setExtraLimit(undefined);
            }}
            aria-describedby={counterId}
            aria-invalid={overLimit || undefined}
            spellCheck={false}
            dir="auto"
            placeholder="Paste a prompt, a reply, or a tool request."
          />
          <div className="sa-field__meta" id={counterId}>
            <span>{PRIVACY_NOTE}</span>
            <span data-invalid={overLimit} aria-live="polite">
              {trimmed.length.toLocaleString('en-US')} / {MAX_CHARS.toLocaleString('en-US')}
              {overLimit ? ' (too long)' : ''}
            </span>
          </div>
        </div>

        <div className="sa-play__action">
          <SaButton
            variant="primary"
            large
            block
            loading={loading}
            loadingLabel="Checking"
            disabled={empty || overLimit || phase.kind === 'rate-limited'}
            onClick={run}
          >
            {phase.kind === 'rate-limited' ? `Try again in ${secondsLeft}s` : loading ? 'Checking' : 'Check this text'}
          </SaButton>
          {loading ? <SaButton variant="secondary" onClick={cancel}>Cancel check</SaButton> : null}
          {empty ? (
            <p className="sa-muted" style={{ margin: 'var(--sa-space-2) 0 0', fontSize: 'var(--sa-text-sm)' }}>
              Add some text or pick an example to begin.
            </p>
          ) : null}
        </div>

        <div className="sa-field sa-play__examples">
          <span className="sa-label" id={`${uid}-examples`}>
            Or start with an example
          </span>
          <ul className="sa-chips" aria-labelledby={`${uid}-examples`}>
            {REPRESENTATIVE_PRESETS.map((p) => (
              <li key={p.id}>
                <button type="button" className="sa-chip" aria-pressed={activePreset === p.id} onClick={() => choose(p)}>
                  {p.label}
                </button>
              </li>
            ))}
          </ul>

          <details className="sa-disclosure sa-examples__more">
            <summary>More examples <span className="sa-muted">· attacks, safe text &amp; languages</span></summary>
            <span className="sa-label" id={`${uid}-attacks`}>Try an attack</span>
            <ul className="sa-chips" aria-labelledby={`${uid}-attacks`}>
              {ATTACK_PRESETS.filter((p) => !REPRESENTATIVE_IDS.includes(p.id)).map((p) => (
                <li key={p.id}>
                  <button type="button" className="sa-chip" aria-pressed={activePreset === p.id} onClick={() => choose(p)}>
                    {p.label}
                  </button>
                </li>
              ))}
            </ul>
            <div className="sa-field" style={{ marginTop: 'var(--sa-space-4)' }}>
              <label className="sa-label" htmlFor={`${uid}-lang`}>Same instruction override in another language</label>
              <select
                id={`${uid}-lang`}
                className="sa-select"
                value={activePreset?.startsWith('lang-') ? activePreset.slice(5) : ''}
                onChange={(e) => e.target.value && chooseLanguage(e.target.value)}
              >
                <option value="">Another language…</option>
                {LANGUAGE_PRESETS.map((l) => (
                  <option key={l.code} value={l.code}>{l.name}</option>
                ))}
              </select>
            </div>
            <span className="sa-label" id={`${uid}-safe`} style={{ marginTop: 'var(--sa-space-4)' }}>Safe examples</span>
            <ul className="sa-chips" aria-labelledby={`${uid}-safe`}>
              {SAFE_PRESETS.filter((p) => !REPRESENTATIVE_IDS.includes(p.id)).map((p) => (
                <li key={p.id}>
                  <button type="button" className="sa-chip" aria-pressed={activePreset === p.id} onClick={() => choose(p)}>
                    {p.label}
                  </button>
                </li>
              ))}
            </ul>
          </details>

          {(() => {
            const p = ALL_PRESETS.find((x) => x.id === activePreset);
            return p?.note ? (
              <p className="sa-muted" style={{ margin: 'var(--sa-space-2) 0 0', fontSize: 'var(--sa-text-sm)' }}>
                {p.note}
              </p>
            ) : null;
          })()}
        </div>
      </div>

      <section className="sa-play__result" aria-labelledby={`${uid}-result-title`}>
        <div className="sa-play__result-head">
          <h2 className="sa-h3" id={`${uid}-result-title`}>Inspection result</h2>
          {phase.kind === 'done' ? <span className="sa-badge sa-badge--stable">Live engine result</span> : null}
        </div>
        <div aria-live="polite" aria-atomic="false">
          <Result phase={phase} secondsLeft={secondsLeft} />
        </div>
      </section>
    </div>
  );
}

function Result({ phase, secondsLeft }: { phase: Phase; secondsLeft: number }) {
  const uid = useId();

  if (phase.kind === 'cancelled') {
    return <div className="sa-empty"><p style={{ margin: 0 }}>Check cancelled. No verdict is shown.</p></div>;
  }
  if (phase.kind === 'idle') {
    return (
      <div className="sa-empty">
        <p style={{ margin: 0 }}>The result appears here, marked on your own text.</p>
      </div>
    );
  }
  if (phase.kind === 'loading') {
    return (
      <div className="sa-empty" aria-busy="true">
        <p style={{ margin: 0 }}>Checking with the live engine…</p>
      </div>
    );
  }
  if (phase.kind === 'rate-limited') {
    return (
      <Callout kind="limit" title="Rate limit reached">
        The public playground allows a limited number of checks per minute. This is a usage limit, not a verdict on
        your text. You can try again in {secondsLeft} seconds.
      </Callout>
    );
  }
  if (phase.kind === 'rejected') {
    return <Callout kind="error" title="The text was not accepted">{phase.message}</Callout>;
  }
  if (phase.kind === 'unavailable') {
    return (
      <Callout kind="error" title="No result">
        {phase.message} No result is shown, because this page never invents one.
      </Callout>
    );
  }

  const { outcome, sent, direction, extraLimit } = phase;
  const result = outcome.result;
  const model = buildReview(sent, result);

  const summary = `Result: ${model.verdict}, risk ${model.riskScore} out of 100. ${model.marks.length} ${
    model.marks.length === 1 ? 'part' : 'parts'
  } of your text marked.`;

  return (
    <div className="sa-stack">
      <p className="sa-sr-only">{summary}</p>

      <Tabs
        label="Result views"
        items={[
          {
            id: 'review',
            label: 'Review',
            content: (
              <div className="sa-stack">
                <ReviewDocument model={model} idPrefix={`${uid}-r`} animate />
                <ReviewNotes model={model} idPrefix={`${uid}-r`} />
                <AfterView result={result} verdict={model.verdict} />
              </div>
            ),
          },
          { id: 'findings', label: 'Findings', content: <FindingsTable result={result} /> },
          {
            id: 'raw',
            label: 'Raw JSON',
            content: (
              <CodeBlock
                label="Response as received"
                language="json"
                code={JSON.stringify(result, null, 2)}
              />
            ),
          },
          {
            id: 'code',
            label: 'Code',
            content: (
              <div className="sa-stack">
                <CodeBlock label="curl" language="bash" code={curlFor(sent, direction)} />
                <p className="sa-muted" style={{ margin: 0, fontSize: 'var(--sa-text-sm)' }}>
                  This is the public, rate-limited route. With an API key, use the input and output guard routes in the
                  REST API docs.
                </p>
              </div>
            ),
          },
        ]}
      />

      <div className="sa-result__foot">
        <Stamp verdict={model.verdict} risk={model.riskScore} />
        {/* The explicit spaces keep copied text readable ("engine 14 ms round trip 344 ms"). */}
        <dl className="sa-timing" style={{ margin: 0 }}>
          <dt>engine</dt>{' '}
          <dd>{typeof outcome.serverMs === 'number' ? `${outcome.serverMs} ms` : 'not reported'}</dd>{' '}
          <dt>round trip</dt>{' '}
          <dd>{outcome.roundTripMs} ms</dd>{' '}
          {typeof outcome.remaining === 'number' && typeof outcome.limit === 'number' ? (
            <>
              <dt>requests left</dt>{' '}
              <dd>
                {outcome.remaining} of {outcome.limit}
              </dd>
            </>
          ) : null}
        </dl>
      </div>

      <Callout kind="limit">
        {extraLimit ? <>{extraLimit} </> : null}
        {GENERAL_LIMIT}
      </Callout>
    </div>
  );
}

function FindingsTable({ result }: { result: AnalyzeResult }) {
  const rows = useMemo(
    () =>
      (result.findings ?? []).map((f) => ({
        label: f.label,
        severity: f.severity,
        score: String(f.score),
        span: typeof f.start === 'number' && typeof f.end === 'number' ? `${f.start} to ${f.end}` : 'whole text',
      })),
    [result],
  );
  return (
    <DataTable
      caption={`${rows.length} ${rows.length === 1 ? 'finding' : 'findings'} reported by the engine`}
      columns={[
        { key: 'label', header: 'Finding' },
        { key: 'severity', header: 'Severity' },
        { key: 'score', header: 'Score', numeric: true },
        { key: 'span', header: 'Characters', numeric: true },
      ]}
      rows={rows}
      empty="The engine reported no findings."
    />
  );
}

/** A curl command that is safe to paste into a POSIX shell. */
export function curlFor(text: string, direction: Direction): string {
  const json = JSON.stringify({ text, direction });
  const shellSafe = json.replace(/'/g, `'\\''`);
  return [
    'curl -X POST https://soterai.in/api/guard/analyze \\',
    '  -H "Content-Type: application/json" \\',
    `  -d '${shellSafe}'`,
  ].join('\n');
}
