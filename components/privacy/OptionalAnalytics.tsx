'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import Script from 'next/script';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { ANALYTICS_CONSENT_KEY, isAnalyticsAllowed, readAnalyticsPreference, type AnalyticsConsent } from '@/lib/privacy/analytics-consent';

const GoogleAnalytics = dynamic(
  () => import('@next/third-parties/google').then((module) => module.GoogleAnalytics),
  { ssr: false },
);

/**
 * Optional measurement is off before a visitor chooses. This does not alter
 * authentication cookies or product audit records. Reloading is required to stop
 * a tracker that has already executed; do not pretend that removing a script tag
 * unloads its listeners or timers.
 */
const CONSENT_CHANGE = 'soterai:analytics-preference-change';
// Browser-module lifetime matches the document, including preference-UI remounts.
// Only a client effect sets this; consent changes cannot unload executed scripts.
let trackersEnabledInDocument = false;
function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(CONSENT_CHANGE, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CONSENT_CHANGE, onChange);
  };
}
function getSnapshot() {
  return typeof window === 'undefined' ? 'unknown' : readAnalyticsPreference(() => window.localStorage.getItem(ANALYTICS_CONSENT_KEY));
}
const getServerSnapshot = () => 'unknown' as const;

export function OptionalAnalytics({ gaId, cloudflareToken }: { gaId: string; cloudflareToken: string }) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [localChoice, setLocalChoice] = useState<AnalyticsConsent>(null);
  const [writeBlocked, setWriteBlocked] = useState(false);
  const trackersEnabled = trackersEnabledInDocument;
  const consent = localChoice ?? (snapshot === 'granted' || snapshot === 'denied' ? snapshot : null);
  const storageBlocked = writeBlocked || snapshot === 'blocked';
  const allowed = isAnalyticsAllowed(consent);
  const reloadNeeded = trackersEnabled && !allowed;

  useEffect(() => {
    if (allowed && (gaId || cloudflareToken)) trackersEnabledInDocument = true;
  }, [allowed, gaId, cloudflareToken]);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== ANALYTICS_CONSENT_KEY && event.key !== null) return;
      // Another tab supersedes even a page-only choice made with blocked storage.
      setLocalChoice(null);
      setWriteBlocked(false);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  function choose(value: Exclude<AnalyticsConsent, null>) {
    try {
      localStorage.setItem(ANALYTICS_CONSENT_KEY, value);
      setWriteBlocked(false);
      setLocalChoice(snapshot === 'blocked' ? value : null);
      window.dispatchEvent(new Event(CONSENT_CHANGE));
    } catch {
      setWriteBlocked(true);
      setLocalChoice(value);
    }
  }

  return (
    <>
      <section aria-label="Optional analytics preferences" className="border-t border-slate-800 bg-white text-sm text-slate-300">
        <div className="container-page flex flex-col gap-4 py-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <h2 className="font-semibold text-slate-100">Optional analytics</h2>
            <p className="mt-1 leading-6">
              Google Analytics, when configured, and Cloudflare Web Analytics load only if you allow them. Sign-in cookies and product audit records are separate.{' '}
              <Link className="font-medium text-cyan underline underline-offset-2" href="/privacy">Privacy policy</Link>
            </p>
            <p role="status" aria-live="polite" className="mt-2 font-medium text-slate-200">
              {reloadNeeded ? 'Reload required to finish turning off already-loaded trackers.' : allowed ? 'Optional analytics is on.' : 'Optional analytics is off.'}
            </p>
            {storageBlocked && <p className="mt-2 text-amber-300">Your browser blocked saving this choice. It applies to this page; a previously saved preference may return on your next visit.</p>}
            {reloadNeeded && (
              <div className="mt-2">
                <p className="leading-6">Save any unsent text before reloading. Already-loaded trackers may continue until then.</p>
                <button type="button" onClick={() => window.location.reload()} className="mt-2 min-h-11 rounded-lg border border-slate-700 px-4 py-2 font-medium text-slate-200 transition-colors hover:bg-slate-900">Reload to apply</button>
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button type="button" onClick={() => choose('denied')} aria-pressed={consent === 'denied'} className="min-h-11 rounded-lg border border-slate-700 px-4 py-2 font-medium text-slate-200 transition-colors hover:bg-slate-900">Keep analytics off</button>
            <button type="button" onClick={() => choose('granted')} aria-pressed={allowed} className="min-h-11 rounded-lg border border-cyan bg-cyan px-4 py-2 font-medium text-white transition-colors hover:bg-cyan-press">Allow analytics</button>
          </div>
        </div>
      </section>
      {allowed && (
        <>
          {gaId ? <GoogleAnalytics gaId={gaId} /> : null}
          {cloudflareToken ? <Script src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon={JSON.stringify({ token: cloudflareToken })} strategy="afterInteractive" /> : null}
        </>
      )}
    </>
  );
}
