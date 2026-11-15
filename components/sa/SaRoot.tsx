import type { ReactNode } from 'react';
import './tokens.css';
import './sa.css';
import { saDisplay, saMono } from './fonts';

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export type SaTheme = 'light' | 'dark' | 'auto';

/**
 * Wrap any redesigned page or section in this. It applies the scoped tokens and
 * the two self-hosted font families. Nothing outside this element changes.
 */
export function SaRoot({
  children,
  theme = 'light',
  className,
}: {
  children: ReactNode;
  theme?: SaTheme;
  className?: string;
}) {
  return (
    <div
      className={cx('sa', saDisplay.variable, saMono.variable, className)}
      data-sa-theme={theme}
    >
      {children}
    </div>
  );
}
