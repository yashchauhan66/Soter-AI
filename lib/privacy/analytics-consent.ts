export const ANALYTICS_CONSENT_KEY = 'soterai:optional-analytics:v1';
export type AnalyticsConsent = 'granted' | 'denied' | null;

/** No default, legacy or truthy value is permission to load optional trackers. */
export function isAnalyticsAllowed(value: unknown): value is 'granted' {
  return value === 'granted';
}

export type AnalyticsSnapshot = 'granted' | 'denied' | 'unknown' | 'blocked';

export function readAnalyticsPreference(getItem: () => string | null): AnalyticsSnapshot {
  try {
    const value = getItem();
    return value === 'granted' || value === 'denied' ? value : 'unknown';
  } catch {
    return 'blocked';
  }
}
