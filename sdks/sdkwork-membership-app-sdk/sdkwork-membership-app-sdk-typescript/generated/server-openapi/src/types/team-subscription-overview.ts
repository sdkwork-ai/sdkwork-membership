/** Organization (team) subscription overview with membership-owned facts only. `hasSubscription=false` is a normal 200 response for an organization without an active team subscription. A platform/personal session (no organization, or the platform organization `0`) is also a normal 200 response: it answers the caller's unbound team subscription with an empty `organizationId` and `organizationBindingStatus='unbound'`, and never `403 organization_scope_required`. Organization identity, the viewer's role, and member license counts are IAM facts composed by the caller. */
export interface TeamSubscriptionOverview {
  /** IAM organization id resolved from the authenticated principal, never from a request header. Empty when the answer is the caller's unbound subscription (a team subscription bought before an organization was chosen). */
  organizationId: string;
  /** Organization binding lifecycle of the reported subscription. `unbound` means the buyer paid for team seats before choosing an organization: seats cannot be assigned until `POST /team/subscription/bind` binds the subscription to an organization. Absent when the caller has no team subscription. */
  organizationBindingStatus?: 'bound' | 'unbound';
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
