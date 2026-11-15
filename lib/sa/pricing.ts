/**
 * Plans, copied from the live pricing page (https://soterai.in/pricing) on
 * 2026-11-09. Names, prices and feature lines are unchanged. Two things were
 * deliberately NOT carried over:
 *
 *  - The live page marks Pro as "Most popular". There is no popularity data on
 *    the site, and the brand rule is never to invent a statistic. Dropped.
 *  - Currency is INR only because billing rejects any other currency
 *    (lib/billing/razorpay.ts). The note below says so instead of hiding it.
 */

export interface Plan {
  id: string;
  name: string;
  price: string;
  period?: string;
  audience: string;
  features: string[];
  cta: { label: string; href: string };
  /** Sales-led plan: shown as a full-width band, not a self-serve column. */
  wide?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: '\u20B90',
    period: 'forever',
    audience: 'Evaluate API Guard, the playground, and one project.',
    features: ['Input and output guard', 'Playground access', 'Basic logs'],
    cta: { label: 'Start free', href: '/signup' },
  },
  {
    id: 'starter',
    name: 'Starter',
    price: '\u20B9999',
    period: 'per month',
    audience: 'For a guarded AI app with operational alerts.',
    features: ['Signed webhooks', 'Monthly reports', '5 projects'],
    cta: { label: 'Start free', href: '/signup' },
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '\u20B92,999',
    period: 'per month',
    audience: 'For growing product and security teams.',
    features: ['Higher limits', 'Security badge', '20 projects'],
    cta: { label: 'Start free', href: '/signup' },
  },
  {
    id: 'agency',
    name: 'Agency',
    price: '\u20B99,999',
    period: 'per month',
    audience: 'For agencies protecting multiple client AI workflows.',
    features: ['Client management', 'White-label reports', 'Partner resources'],
    cta: { label: 'Start free', href: '/signup' },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: 'volume based',
    audience: 'For regulated, high-scale, self-hosted, or paid pilot deployments.',
    features: ['SAML and SCIM', 'SIEM and retention', 'Pilot and SLA review'],
    cta: { label: 'Book a security review', href: '/contact-sales' },
    wide: true,
  },
];

/**
 * INR denomination does not establish international payment eligibility.
 * Merchant payment availability has not been verified for this website review.
 */
export const BILLING_NOTE =
  'Prices are in Indian rupees. If you are buying from outside India, contact sales to confirm available payment methods before purchasing. The Free plan does not require a payment.';

export const PLANS_STATEMENT =
  'Every plan runs the same detection engine. Higher plans raise limits and add team controls. They do not unlock stronger detection.';
