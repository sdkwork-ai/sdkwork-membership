/** Result of assigning a licensed seat to an organization member. */
export interface TeamSeatAssignmentItem {
  userId: string;
  seatNo: number;
  assignedAt: string;
  displayName?: string;
  membershipId?: string;
}
