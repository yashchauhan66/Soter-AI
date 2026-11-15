'use client';

import { useEffect, useRef, useState } from 'react';

type CopyState = 'idle' | 'copied' | 'failed';

/**
 * Code block with a copy button.
 * States: idle, copied, failed. A failed copy says so; it never pretends to have
 * worked. The status is announced through a polite live region.
 * The visible label is mono text, not an icon, so it has a text name.
 */
export function CodeBlock({
  code,
  label,
  language = 'text',
}: {
  code: string;
  /** Short title shown in the bar, for example "curl" or "Request". */
  label: string;
  language?: string;
}) {
  const [state, setState] = useState<CopyState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    let next: CopyState = 'failed';
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
        next = 'copied';
      }
    } catch {
      next = 'failed';
    }
    setState(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 2500);
  }

  const buttonText = state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy';
  const status =
    state === 'copied'
      ? 'Copied to clipboard.'
      : state === 'failed'
        ? 'Copy failed. Select the text and copy it yourself.'
        : '';

  return (
    <figure className="sa-code" style={{ margin: 0 }}>
      <figcaption className="sa-code__bar">
        <span className="sa-label">{label}</span>
        <button type="button" className="sa-code__copy" onClick={copy}>
          {buttonText}
          <span className="sa-sr-only"> {label}</span>
        </button>
      </figcaption>
      <pre className="sa-code__pre" tabIndex={0}>
        <code className={`language-${language}`}>{code}</code>
      </pre>
      <span className="sa-sr-only" role="status" aria-live="polite">
        {status}
      </span>
    </figure>
  );
}
