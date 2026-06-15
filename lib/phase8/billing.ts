import type { SubscriptionStatus } from "@prisma/client";

export const TRIAL_DAYS = 14;
export const PAYMENT_GRACE_DAYS = 7;

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function evaluateSubscriptionLifecycle(input: {
  status: SubscriptionStatus;
  now?: Date;
  trialEndsAt?: Date | null;
  gracePeriodEndsAt?: Date | null;
  cancelAt?: Date | null;
}) {
  const now = input.now ?? new Date();
  if (input.status === "TRIAL" && input.trialEndsAt && input.trialEndsAt <= now) return "EXPIRED" as const;
  if ((input.status === "PAST_DUE" || input.status === "GRACE_PERIOD") && input.gracePeriodEndsAt && input.gracePeriodEndsAt <= now) return "EXPIRED" as const;
  if (input.status === "CANCELLED" && input.cancelAt && input.cancelAt <= now) return "EXPIRED" as const;
  return input.status;
}

export function trialWindow(startedAt: Date) {
  return { startedAt, trialEndsAt: addDays(startedAt, TRIAL_DAYS) };
}

export function failedPaymentWindow(failedAt: Date) {
  return { paymentFailedAt: failedAt, gracePeriodEndsAt: addDays(failedAt, PAYMENT_GRACE_DAYS) };
}
