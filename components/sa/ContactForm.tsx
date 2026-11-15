'use client';

import { useId, useRef, useState } from 'react';

/**
 * Security-review request form. Posts to the existing /api/ops/contact route, which
 * validates every field again on the server and rate limits by email.
 *
 * What the old form lacked, and this one has:
 *  - A visible <label> on every field. Placeholders disappear once you type and are
 *    not a label for screen readers.
 *  - The server's message on failure. The old form showed `result.message` without
 *    checking that the body was JSON, so a 502 from a proxy showed nothing.
 *  - A polite live region for the result, focus moved to the message, and the submit
 *    button disabled while the request is in flight so a double click sends one request.
 *  - No claim about who reads it or how fast they answer. Nobody has measured either.
 */
type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'ok' } | { kind: 'error'; message: string };

const INTERESTS = [
  { value: 'security-review', label: 'Security review of my AI app' },
  { value: 'enterprise', label: 'Team or enterprise plan' },
  { value: 'self-hosted', label: 'Self-hosting' },
  { value: 'agency', label: 'Agency or partner' },
  { value: 'other', label: 'Something else' },
];

const DEPLOYMENTS = [
  { value: 'cloud', label: 'Hosted by SoterAI' },
  { value: 'self-hosted', label: 'Self-hosted' },
  { value: 'hybrid', label: 'Not sure yet' },
];

export function ContactForm() {
  const uid = useId();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const messageRef = useRef<HTMLDivElement>(null);
  const id = (name: string) => `${uid}-${name}`;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status.kind === 'sending') return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const monthly = String(data.get('monthlyMessages') ?? '').trim();
    setStatus({ kind: 'sending' });
    try {
      const response = await fetch('/api/ops/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.get('name'),
          email: data.get('email'),
          company: data.get('company'),
          role: String(data.get('role') ?? '').trim() || undefined,
          monthlyMessages: monthly ? Number(monthly) : undefined,
          interest: data.get('interest'),
          deploymentPreference: data.get('deploymentPreference'),
          message: data.get('message'),
        }),
      });
      let body: { message?: unknown } | null = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      if (response.ok) {
        form.reset();
        setStatus({ kind: 'ok' });
      } else {
        const serverMessage = typeof body?.message === 'string' ? body.message : '';
        setStatus({
          kind: 'error',
          message:
            serverMessage ||
            `The request did not go through (status ${response.status}). Email support@soterai.in instead.`,
        });
      }
    } catch {
      setStatus({ kind: 'error', message: 'The network request failed. Check your connection or email support@soterai.in.' });
    }
    // Move focus to the result so keyboard and screen reader users land on it.
    requestAnimationFrame(() => messageRef.current?.focus());
  }

  return (
    <form className="sa-form sa-form--2" onSubmit={onSubmit} noValidate={false} aria-describedby={id('note')}>
      <div className="sa-field">
        <label htmlFor={id('name')}>
          Name <span className="sa-field__req" aria-hidden="true">*</span>
        </label>
        <input className="sa-input" id={id('name')} name="name" required minLength={2} maxLength={120} autoComplete="name" />
      </div>
      <div className="sa-field">
        <label htmlFor={id('email')}>
          Work email <span className="sa-field__req" aria-hidden="true">*</span>
        </label>
        <input className="sa-input" id={id('email')} name="email" type="email" required maxLength={254} autoComplete="email" />
      </div>
      <div className="sa-field">
        <label htmlFor={id('company')}>
          Company <span className="sa-field__req" aria-hidden="true">*</span>
        </label>
        <input className="sa-input" id={id('company')} name="company" required minLength={2} maxLength={160} autoComplete="organization" />
      </div>
      <div className="sa-field">
        <label htmlFor={id('role')}>Role</label>
        <input className="sa-input" id={id('role')} name="role" maxLength={100} autoComplete="organization-title" />
      </div>
      <div className="sa-field">
        <label htmlFor={id('interest')}>What do you want to talk about?</label>
        <select className="sa-select" id={id('interest')} name="interest" defaultValue="security-review">
          {INTERESTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="sa-field">
        <label htmlFor={id('deployment')}>Where should it run?</label>
        <select className="sa-select" id={id('deployment')} name="deploymentPreference" defaultValue="cloud">
          {DEPLOYMENTS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="sa-field">
        <label htmlFor={id('monthly')}>AI messages per month</label>
        <input className="sa-input" id={id('monthly')} name="monthlyMessages" type="number" inputMode="numeric" min={1} max={1000000000} step={1} aria-describedby={id('monthly-help')} />
        <p className="sa-field__help" id={id('monthly-help')}>
          A rough number is fine. Leave it empty if you do not know.
        </p>
      </div>
      <div className="sa-field sa-field--wide">
        <label htmlFor={id('message')}>
          What are you protecting, and what matters most? <span className="sa-field__req" aria-hidden="true">*</span>
        </label>
        <textarea className="sa-textarea" id={id('message')} name="message" required minLength={10} maxLength={3000} aria-describedby={id('note')} />
        <p className="sa-field__help" id={id('note')}>
          Do not paste credentials, raw secrets or customer conversations. Describe the setup instead. Required fields are marked
          with an asterisk.
        </p>
      </div>
      <div className="sa-field sa-field--wide">
        <button type="submit" className="sa-btn sa-btn--primary sa-btn--lg" disabled={status.kind === 'sending'} aria-busy={status.kind === 'sending'}>
          {status.kind === 'sending' ? 'Sending' : 'Send request'}
        </button>
      </div>
      <div className="sa-field sa-field--wide" aria-live="polite" ref={messageRef} tabIndex={-1} style={{ outline: 'none' }}>
        {status.kind === 'ok' ? (
          <div className="sa-callout sa-callout--note">
            <p className="sa-callout__title">Received</p>
            <div className="sa-callout__body">
              Your request was saved. If you do not hear back, email support@soterai.in with the same details.
            </div>
          </div>
        ) : null}
        {status.kind === 'error' ? (
          <div className="sa-callout sa-callout--error" role="alert">
            <p className="sa-callout__title">Not sent</p>
            <div className="sa-callout__body">{status.message}</div>
          </div>
        ) : null}
      </div>
    </form>
  );
}
