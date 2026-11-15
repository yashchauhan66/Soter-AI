export interface FaqItem {
  q: string;
  /** Plain text only, so the visible answer and the structured data cannot differ. */
  a: string;
}

/**
 * Visible FAQ. Uses native <details>, so it works without JavaScript and is
 * keyboard operable by default.
 */
export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <div className="sa-faq">
      {items.map((item) => (
        <details key={item.q}>
          <summary>{item.q}</summary>
          <div className="sa-faq__answer">
            <p className="sa-body" style={{ margin: 0 }}>
              {item.a}
            </p>
          </div>
        </details>
      ))}
    </div>
  );
}

/**
 * FAQPage JSON-LD built from the same array the page renders. Google requires the
 * markup to match visible content; deriving both from one source guarantees it.
 */
export function faqJsonLd(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}
