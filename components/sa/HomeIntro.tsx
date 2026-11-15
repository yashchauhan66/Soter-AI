import React from 'react';
import Link from 'next/link';
import { PLAYGROUND_CTA_LABEL } from '@/lib/marketing/cta';
import { buttonClass } from './buttonStyles';

/** Clear first-screen choices; the actual demo and safety disclosures stay intact. */
export function HomeIntro() {
  return (
    <div className="soter-home__intro">
      <p className="sa-eyebrow soter-home__eyebrow">AI security for apps, agents &amp; teams</p>
      <h1 className="sa-h1 soter-home__title" id="hero-title">
        Detect prompt injection.{' '}
        <span>Redact sensitive data.</span>
      </h1>
      <p className="soter-home__lead" data-home-summary="true">
        Check prompts and AI replies, redact detected secrets and personal data, and hold risky agent actions for review.
      </p>
      <div className="sa-hero__actions soter-home__actions">
        <Link href="/playground" className={buttonClass({ large: true })}>
          {PLAYGROUND_CTA_LABEL} <span aria-hidden="true">↗</span>
        </Link>
        <Link href="/signup" className={buttonClass({ variant: 'secondary', large: true })}>
          Create a free account
        </Link>
      </div>
      <p className="soter-home__privacy">
        The public playground runs on our server and is rate limited. Use sample data, not real secrets.
      </p>
      <nav className="soter-home__audiences" aria-label="Choose your starting point">
        <Link href="/docs/quickstart">
          For developers <span aria-hidden="true">↗</span>
        </Link>
        <Link href="/ai-user-security">
          For security teams <span aria-hidden="true">↗</span>
        </Link>
      </nav>
    </div>
  );
}
