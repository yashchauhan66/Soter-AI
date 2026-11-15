import { cx } from './SaRoot';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonStyleProps {
  variant?: ButtonVariant;
  large?: boolean;
  block?: boolean;
}

/** Shared by the <button> and the <a> versions so they cannot drift apart. */
export function buttonClass({ variant = 'primary', large, block }: ButtonStyleProps, extra?: string) {
  return cx('sa-btn', `sa-btn--${variant}`, large && 'sa-btn--lg', block && 'sa-btn--block', extra);
}
