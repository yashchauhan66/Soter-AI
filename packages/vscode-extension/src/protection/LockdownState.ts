export const LOCKDOWN_STATE_KEY = "soterai.lockdown";

export interface LockdownRecord {
    active: boolean;
    activatedAt?: string;
    reason?: string;
}