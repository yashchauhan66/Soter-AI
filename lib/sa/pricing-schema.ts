import type { Plan } from './pricing';

/** Sales-quoted Enterprise is not represented as a numeric price or ceiling. */
export function pricingOffersLd(plans: readonly Plan[], siteUrl: string) {
  return plans.filter((plan) => !plan.wide && /^\u20b9[\d,]+$/.test(plan.price)).map((plan) => ({
    '@type': 'Offer' as const,
    name: plan.name,
    price: plan.price.replace(/[^\d]/g, ''),
    priceCurrency: 'INR' as const,
    url: `${siteUrl}/pricing`,
  }));
}
