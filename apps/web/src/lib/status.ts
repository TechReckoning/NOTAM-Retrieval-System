/** Operational activation status of a NOTAM at the chosen operational time. */

import { activationStatus, type ActivationStatus } from '@notam/parser';
import type { LoadedNotam } from './types';

export type { ActivationStatus };

export function statusFor(n: LoadedNotam, opTimeIso: string): ActivationStatus {
  return activationStatus(n.schedules, Date.parse(opTimeIso));
}

export const STATUS_LABEL: Record<ActivationStatus, string> = {
  active: 'Active',
  upcoming: 'Upcoming',
  expired: 'Expired',
};

export const STATUS_COLOR: Record<ActivationStatus, string> = {
  active: '#3fbf6f',
  upcoming: '#e6b22b',
  expired: '#7a8699',
};
