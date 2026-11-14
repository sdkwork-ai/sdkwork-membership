/** Result of one member-removal seat reconciliation sweep. Membership-owned seat counters only; `revokedCount` is 0 on a repeat call because reconciliation is idempotent. */
export interface TeamSeatReconciliation {
  /** Seat assignments revoked because their user left the organization. */
  revokedCount: number;
  seatsUsed: number;
  seatsPurchased: number;
}
