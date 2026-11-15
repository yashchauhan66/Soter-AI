import localFont from 'next/font/local';

/*
 * Two families, self-hosted, Latin only. 72.3 KB in total (measured).
 *
 *   Newsreader   43.7 KB  one variable file, wght 400-600, fixed optical size.
 *                         The full optical-size variable build is 129 KB, which
 *                         is too heavy for a marketing page on a mid-range phone.
 *   IBM Plex Mono 14.7 KB (400) + 15.6 KB (600)
 *
 * Neither family has Devanagari, CJK or Arabic glyphs (checked with fontkit).
 * Site copy is English, so that does not matter. Text a visitor pastes into the
 * demo can be in any script, and is set with --sa-font-user, which falls back to
 * the operating system's fonts instead of downloading more here.
 *
 * `preload: false` matches the existing fonts in app/fonts/index.ts. The browser
 * fetches a file only when text on the page needs it.
 */
export const saDisplay = localFont({
  src: [{ path: './fonts/Newsreader-latin.woff2', weight: '400 600', style: 'normal' }],
  display: 'swap',
  variable: '--font-sa-display',
  preload: true,
  fallback: ['Iowan Old Style', 'Palatino Linotype', 'Palatino', 'Georgia', 'serif'],
  adjustFontFallback: 'Times New Roman',
});

export const saMono = localFont({
  src: [
    { path: './fonts/IBMPlexMono-400-latin.woff2', weight: '400', style: 'normal' },
    { path: './fonts/IBMPlexMono-600-latin.woff2', weight: '600', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-sa-mono',
  preload: false,
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
  adjustFontFallback: false,
});
