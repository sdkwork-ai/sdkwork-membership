/** Organization (team) subscription overview. `hasSubscription=false` is a normal 200 response for an organization without an active team subscription. */
export interface TeamSubscriptionOverview {
  /** IAM organization id resolved from the authenticated principal, never from a request header. */
  organizationId: string;
  organizationName?: string;
  organizationKind?: string;
  /** Viewer's IAM organization membership kind (`owner` | `admin` | `member`). */
  viewerRole?: string;
  /** True when the viewer role is `owner` or `admin`. */
  canManageSeats: boolean;
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
  membersTotal: number;
  licensedMembers: number;
  unlicensedMembers: number;
  overSeat: boolean;
  overSeatCount: number;
}
