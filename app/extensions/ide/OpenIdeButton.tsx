'use client';

import { useCallback, type ReactNode } from 'react';

type OpenIdeButtonProps = {
  ideName: string;
  deepLink: string;
  /**
   * Optional secondary protocol fired through a hidden iframe. Some editors
   * rebranded their URL handler (Windsurf -> Devin) and which one is registered
   * depends on the user's install history — dispatching both means the one that
   * exists on the machine opens the editor while the other fails silently.
   */
  altDeepLink?: string;
  className?: string;
  children?: ReactNode;
};

/**
 * One-click "Open in {IDE}". Clicking fires the editor deep link immediately —
 * no interstitial popup, no waiting screen. The browser/OS hands the link to the
 * installed editor, which opens straight to the SoterAI IDE Guard page.
 */
export function OpenIdeButton({
  ideName,
  deepLink,
  altDeepLink,
  className,
  children,
}: OpenIdeButtonProps) {
  const openIde = useCallback(() => {
    window.location.href = deepLink;
    if (altDeepLink) {
      window.setTimeout(() => {
        const frame = document.createElement('iframe');
        frame.style.display = 'none';
        frame.src = altDeepLink;
        document.body.appendChild(frame);
        window.setTimeout(() => frame.remove(), 4000);
      }, 300);
    }
  }, [deepLink, altDeepLink]);

  return (
    <button
      type="button"
      onClick={openIde}
      aria-label={`Redirect to ${ideName} to install SoterAI IDE Guard`}
      className={
        className ??
        'mt-4 inline-flex min-h-10 items-center justify-center gap-2 bg-cyan px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan/90'
      }
    >
      {children ?? `Open in ${ideName}`}
    </button>
  );
}