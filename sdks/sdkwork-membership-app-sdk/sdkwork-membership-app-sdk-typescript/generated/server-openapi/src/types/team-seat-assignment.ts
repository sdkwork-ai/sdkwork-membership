/** One active organization seat assignment. Member identity, role, and contact data stay IAM-owned and are composed by the caller from the IAM roster. */
export interface TeamSeatAssignment {
  /** IAM user id the seat is assigned to. */
  userId: string;
  /** IAM organization membership row id snapshotted at assignment time. */
  membershipId?: string;
  seatNo: number;
  assignedAt: string;
}
