import { cx } from './SaRoot';
import { DataTable, SaLinkButton } from './primitives';
import { PLANS_STATEMENT, type Plan } from '@/lib/sa/pricing';

/**
 * Plan cards.
 *
 * Self-serve plans sit in a row (one column on phones, two on tablets, four on
 * wide screens). A plan marked `wide` is sales-led, not self-serve, so it gets a
 * full-width band underneath instead of being squeezed into a fifth column where
 * its button text wraps.
 *
 * Each card is a labelled section, so screen readers announce the plan name, price
 * and features together.
 */
export function PricingPlans({ plans }: { plans: Plan[] }) {
  return (
    <>
      <div className="sa-plans-intro">
        <p><strong>Create an account first.</strong> Choose a paid plan in Billing after signing in. &ldquo;Start free&rdquo; does not preselect a paid plan or open checkout.</p>
        <a className="sa-link" href="#compare">Compare all plans <span aria-hidden="true">↓</span></a>
      </div>
    <ul className="sa-plans" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {plans.map((plan) => (
        <li key={plan.id} className={cx(plan.wide && 'sa-plans__item--wide')}>
          <section
            className={cx('sa-plan', plan.wide && 'sa-plan--wide')}
            aria-labelledby={`plan-${plan.id}`}
            style={{ height: '100%' }}
          >
            <div className="sa-plan__head">
              <h3 className="sa-h3" id={`plan-${plan.id}`}>
                {plan.name}
              </h3>
              <p className="sa-plan__price">
                {plan.price}
                {plan.period ? <span className="sa-plan__period">{plan.period}</span> : null}
              </p>
              <p className="sa-body sa-muted" style={{ fontSize: 'var(--sa-text-base)' }}>
                {plan.audience}
              </p>
            </div>
            <ul className="sa-plan__list">
              {plan.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <div className="sa-plan__cta">
              <SaLinkButton href={plan.cta.href} variant={plan.wide ? 'secondary' : 'primary'} block>
                {plan.cta.label}
                <span className="sa-sr-only"> for {plan.name}</span>
              </SaLinkButton>
              {plan.cta.href === '/signup' ? <p className="sa-plan__next">Account first, not checkout.</p> : null}
            </div>
          </section>
        </li>
      ))}
    </ul>
    </>
  );
}

/** Compare the actual published terms, never infer an unlisted entitlement. */
export function PricingComparison({ plans }: { plans: Plan[] }) {
  const rows = [
    {
      feature: 'Price',
      ...Object.fromEntries(plans.map((plan) => [plan.id, (
        <span key={plan.id}>
          <span className="sa-num">{plan.price}</span>
          {plan.period ? <span className="sa-plan__period">{plan.period}</span> : null}
        </span>
      )])),
    },
    { feature: 'Built for', ...Object.fromEntries(plans.map((plan) => [plan.id, plan.audience])) },
    {
      feature: 'Published benefits',
      ...Object.fromEntries(plans.map((plan) => [plan.id, (
        <ul className="sa-plan__list" key={plan.id}>
          {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
        </ul>
      )])),
    },
    {
      feature: 'Next step',
      ...Object.fromEntries(plans.map((plan) => [plan.id, (
        <SaLinkButton key={plan.id} href={plan.cta.href} variant="secondary">
          {plan.cta.label}<span className="sa-sr-only"> for {plan.name}</span>
        </SaLinkButton>
      )])),
    },
  ];

  return (
    <section className="sa-section sa-pricing-comparison" aria-labelledby="compare">
      <div className="sa-section__head">
        <h2 className="sa-h2" id="compare">Compare every plan</h2>
        <p className="sa-body">{PLANS_STATEMENT}</p>
        <p className="sa-body sa-muted">Published prices, audiences and benefits, side by side. These are plan highlights, not a complete entitlement list; an unlisted feature does not mean it is excluded.</p>
      </div>
      <DataTable
        caption="All plans: published prices and benefits"
        columns={[{ key: 'feature', header: 'Compare' }, ...plans.map((plan) => ({ key: plan.id, header: plan.name }))]}
        rows={rows}
      />
    </section>
  );
}
