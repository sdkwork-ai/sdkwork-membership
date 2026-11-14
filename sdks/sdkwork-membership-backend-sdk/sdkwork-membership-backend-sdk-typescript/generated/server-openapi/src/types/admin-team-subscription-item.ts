import type { TeamSubscriptionStatus } from './team-subscription-status';

/** One organization (team) subscription. Membership-owned facts only: organization identity is the subscription subject (the IAM organization id) and IAM profiles, organization roles, and member rows are composed by the caller from the IAM surface. */
export interface AdminTeamSubscriptionItem {
  subscriptionId: string;
  /** IAM organization id the subscription is licensed to. */
  organizationId: string;
  planId: string;
  planName?: string | null;
  status: TeamSubscriptionStatus;
  startsAt: string;
  expiresAt: string;
  seatsPurchased: string;
  seatsUsed: string;
  seatsAvailable: string;
  /** `strict` refuses assignments beyond seatsPurchased; `flex_overflow` allows billable over-assignment. */
  seatPolicy: 'strict' | 'flex_overflow';
  autoAssignSeat: boolean;
  /** IAM user id of the subscription owner. */
  ownerUserId: string;
  createdAt: string;
  updatedAt: string;
}
