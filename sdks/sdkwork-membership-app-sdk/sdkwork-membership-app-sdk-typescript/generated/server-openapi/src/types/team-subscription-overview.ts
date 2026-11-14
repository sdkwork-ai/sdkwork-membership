/** Organization (team) subscription overview with membership-owned facts only. `hasSubscription=false` is a normal 200 response for an organization without an active team subscription. Organization identity, the viewer's role, and member license counts are IAM facts composed by the caller. */
export interface TeamSubscriptionOverview {
  /** IAM organization id resolved from the authenticated principal, never from a request header. */
  organizationId: string;
  hasSubscription: boolean;
  subscriptionId?: string;
  /** Catalog plan id as served by `GET /plans` (the plan rank). */
  planId?: string;
  planName?: string;
  planRank?: string;
  status?: string;
  startsAt?: string;
  expiresAt?: string;
  seatsPurchased: number;
  seatsUsed: number;
  seatsAvailable: number;
  seatPolicy: 'strict' | 'flex_overflow';
  autoAssignSeat: boolean;
}
