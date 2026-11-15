import type { ReactNode } from 'react';
import { Stamp } from './primitives';
import {
  VERDICT_LABEL,
  VERDICT_MEANING,
  type AnalyzeResult,
  type ReviewModel,
  type Verdict,
} from '@/lib/sa/review';

/**
 * Review Mode: the visitor's own text with the engine's findings marked on it,
 * plus one margin note per mark.
 *
 *  - Marks come from the engine's own start/end offsets. Nothing is drawn that
 *    the engine did not report.
 *  - Every mark has a number that links to its note, and the note holds the text
 *    equivalent (label, severity, score, the engine's message). Colour is never
 *    the only signal: each verdict also has its own line style.
 *  - <bdi> isolates each mark so right-to-left and left-to-right text can sit side
 *    by side without the numbering jumping around.
 */

const MAX_TEXT_NOTES_SHOWN = 4;

export function ReviewDocument({
  model,
  idPrefix,
  animate = false,
}: {
  model: ReviewModel;
  idPrefix: string;
  animate?: boolean;
}) {
  let markIndex = 0;
  return (
    <div className="sa-review" data-animate={animate ? 'true' : 'false'}>
      <p className="sa-doc" dir="auto" lang="und">
        {model.segments.map((segment, i) => {
          if (segment.kind === 'plain' || !segment.mark) return <span key={i}>{segment.text}</span>;
          const mark = segment.mark;
          const n = ++markIndex;
          return (
            <bdi key={mark.id}>
              <mark
                className="sa-mark"
                data-verdict={mark.verdict}
                style={{ ['--sa-i' as string]: n - 1 }}
                aria-describedby={`${idPrefix}-note-${n}`}
              >
                <span className="sa-mark__text">{segment.text}</span>
                <sup className="sa-mark__ref">
                  <a href={`#${idPrefix}-note-${n}`} aria-label={`Note ${n}: ${VERDICT_LABEL[mark.verdict]}`}>
                    {n}
                  </a>
                </sup>
              </mark>
            </bdi>
          );
        })}
      </p>
    </div>
  );
}

export function ReviewNotes({ model, idPrefix }: { model: ReviewModel; idPrefix: string }) {
  const shown = model.textNotes.slice(0, MAX_TEXT_NOTES_SHOWN);
  const rest = model.textNotes.slice(MAX_TEXT_NOTES_SHOWN);

  return (
    <div className="sa-stack">
      {model.notes.length > 0 ? (
        <ol className="sa-notes" aria-label="Notes on marked text">
          {model.notes.map((note) => (
            <li key={note.markId} className="sa-note" id={`${idPrefix}-note-${note.index}`} data-verdict={note.verdict}>
              <div className="sa-note__head">
                <span className="sa-note__index">{note.index}</span>
                <span className="sa-note__label">{note.label}</span>
                <span className="sa-note__meta">
                  {VERDICT_LABEL[note.verdict]} · {note.severity} · score {note.score}
                </span>
              </div>
              {note.message ? <p className="sa-note__msg">{note.message}</p> : null}
              {note.alsoFlaggedAs.length > 0 ? (
                <p className="sa-note__more">Also flagged as: {note.alsoFlaggedAs.join(', ')}.</p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}

      {model.textNotes.length > 0 ? (
        <div>
          <p className="sa-label" style={{ margin: '0 0 var(--sa-space-2)' }}>
            About the whole text
          </p>
          <ul className="sa-notes" aria-label="Findings about the whole text">
            {shown.map((note) => (
              <TextNoteItem key={note.label} note={note} />
            ))}
          </ul>
          {rest.length > 0 ? (
            <details style={{ marginTop: 'var(--sa-space-2)' }}>
              <summary className="sa-link" style={{ cursor: 'pointer' }}>
                Show {rest.length} more
              </summary>
              <ul className="sa-notes" style={{ marginTop: 'var(--sa-space-2)' }} aria-label="More findings about the whole text">
                {rest.map((note) => (
                  <TextNoteItem key={note.label} note={note} />
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}

      {model.notes.length === 0 && model.textNotes.length === 0 ? (
        <p className="sa-muted" style={{ margin: 0 }}>
          {model.clean ? 'The engine found nothing to act on in this text.' : 'The engine reported no findings.'}
        </p>
      ) : null}
    </div>
  );
}

function TextNoteItem({ note }: { note: ReviewModel['textNotes'][number] }) {
  return (
    <li className="sa-note" data-verdict={note.verdict}>
      <div className="sa-note__head">
        <span className="sa-note__label">{note.label}</span>
        <span className="sa-note__meta">
          {note.severity} · score {note.score}
        </span>
      </div>
      {note.message ? <p className="sa-note__msg">{note.message}</p> : null}
    </li>
  );
}

/** Split a string on the engine's replacement tokens, e.g. [REDACTED_EMAIL]. */
function renderWithTokens(text: string): ReactNode[] {
  const parts = text.split(/(\[(?:REDACTED|REMOVED)_[A-Z_]+\])/g);
  return parts.map((part, i) =>
    /^\[(?:REDACTED|REMOVED)_[A-Z_]+\]$/.test(part) ? (
      <span key={i} className="sa-token">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

/**
 * What happens to the text next, using only what the engine actually returned:
 * `redactedText` for redactions, `safeText` for rewrites. For BLOCK and REVIEW
 * the engine returns no safe version, so none is invented.
 */
export function AfterView({ result, verdict }: { result: AnalyzeResult; verdict: Verdict }) {
  let body: ReactNode;
  switch (result.action) {
    case 'ALLOW':
      body = <span>Goes through unchanged.</span>;
      break;
    case 'ALLOW_WITH_REDACTION':
      body = result.redactedText ? (
        <span dir="auto">{renderWithTokens(result.redactedText)}</span>
      ) : (
        <span>Goes through with the marked values replaced.</span>
      );
      break;
    case 'REWRITE':
      body = result.safeText ? (
        <span dir="auto">{renderWithTokens(result.safeText)}</span>
      ) : (
        <span>Goes through in a safer form.</span>
      );
      break;
    case 'BLOCK':
      body = <span>Does not go through. Nothing is passed on.</span>;
      break;
    case 'HUMAN_REVIEW':
      body = <span>Held. The engine asks for a person to look at it before it goes through.</span>;
      break;
  }
  return (
    <div>
      <p className="sa-label" style={{ margin: '0 0 var(--sa-space-2)' }}>
        What happens next
      </p>
      <p className="sa-doc" style={{ minHeight: 0, lineHeight: 1.8 }} data-verdict={verdict}>
        {body}
      </p>
      {result.reason ? (
        <p className="sa-muted" style={{ margin: 'var(--sa-space-2) 0 0', fontSize: 'var(--sa-text-sm)' }}>
          Engine reason: {result.reason}
        </p>
      ) : null}
    </div>
  );
}

/** Legend of the five verdicts, with the mark style and meaning of each. */
export function VerdictLegend() {
  const order: Verdict[] = ['allow', 'redact', 'rewrite', 'block', 'review'];
  return (
    <dl style={{ margin: 0, display: 'grid', gap: 'var(--sa-space-2)' }}>
      {order.map((v) => (
        <div key={v} style={{ display: 'flex', gap: 'var(--sa-space-3)', alignItems: 'baseline', flexWrap: 'wrap' }}>
          <dt style={{ minWidth: '5.5rem' }}>
            <Stamp verdict={v} />
          </dt>
          <dd style={{ margin: 0, flex: 1, minWidth: '14rem' }}>{VERDICT_MEANING[v]}</dd>
        </div>
      ))}
    </dl>
  );
}
