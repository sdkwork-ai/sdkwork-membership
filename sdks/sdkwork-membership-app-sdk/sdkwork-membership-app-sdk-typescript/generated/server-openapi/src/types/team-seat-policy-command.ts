/** Seat policy patch command. */
export interface TeamSeatPolicyCommand {
  seatPolicy: 'strict' | 'flex_overflow';
  autoAssignSeat: boolean;
}
