/** One organization seat directory row (one row per active IAM organization membership). */
export interface TeamSeatMember {
  /** IAM user id. */
  userId: string;
  /** IAM organization membership row id. */
  membershipId: string;
  displayName?: string;
  email?: string;
  /** IAM organization role (`owner` | `admin` | `member`). */
  membershipKind: string;
  memberStatus?: string;
  seatState: 'active' | 'unassigned';
  seatNo?: number;
  assignedAt?: string;
}
