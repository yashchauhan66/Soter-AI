'use client';

import type { ButtonHTMLAttributes } from 'react';
import { buttonClass, type ButtonStyleProps } from './buttonStyles';

export interface SaButtonProps
  extends ButtonStyleProps,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  loading?: boolean;
  /** Text for assistive tech while loading. */
  loadingLabel?: string;
}

/**
 * Button.
 * States: default, hover, active, focus-visible, disabled, loading.
 *
 * This is a client component because it handles clicks. A loading button stays
 * focusable, so keyboard focus is not lost mid-action, but it ignores clicks.
 */
export function SaButton({
  variant,
  large,
  block,
  loading = false,
  loadingLabel = 'Working',
  disabled,
  onClick,
  children,
  type = 'button',
  ...rest
}: SaButtonProps) {
  const inert = Boolean(disabled || loading);
  return (
    <button
      {...rest}
      type={type}
      className={buttonClass({ variant, large, block })}
      disabled={disabled}
      aria-disabled={inert || undefined}
      aria-busy={loading || undefined}
      onClick={(event) => {
        if (inert) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      {loading ? <span className="sa-spinner" aria-hidden="true" /> : null}
      <span>{children}</span>
      {loading ? <span className="sa-sr-only"> {loadingLabel}</span> : null}
    </button>
  );
}
