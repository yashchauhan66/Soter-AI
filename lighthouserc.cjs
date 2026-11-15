// Local quality gates; this configuration never uploads to a hosted service.
const desktop = process.env.LHCI_FORM_FACTOR === 'desktop';
const formFactor = desktop ? 'desktop' : 'mobile';

module.exports = {
  ci: {
    collect: {
      numberOfRuns: 3,
      url: [process.env.LHCI_BASE_URL || 'http://127.0.0.1:3101'],
      settings: {
        ...(desktop ? { preset: 'desktop' } : {}),
        formFactor,
        throttlingMethod: 'simulate',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        chromeFlags: '--headless=new --disable-gpu --no-sandbox',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.95, aggregationMethod: 'median' }],
        'categories:accessibility': ['error', { minScore: 1, aggregationMethod: 'median' }],
        'categories:best-practices': ['error', { minScore: 1, aggregationMethod: 'median' }],
        'categories:seo': ['error', { minScore: 1, aggregationMethod: 'median' }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2000, aggregationMethod: 'median' }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.05, aggregationMethod: 'median' }],
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: `docs/redesign/evidence/qa-final/lighthouse-ci-${formFactor}`,
    },
  },
};
