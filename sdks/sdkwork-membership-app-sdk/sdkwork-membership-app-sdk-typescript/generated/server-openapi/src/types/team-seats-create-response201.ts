import type { SdkWorkResourceDataTeamSeatAssignment } from './sdk-work-resource-data-team-seat-assignment';

export interface TeamSeatsCreateResponse201 {
  code: 0;
  data: unknown & SdkWorkResourceDataTeamSeatAssignment;
  /** Server-owned request correlation id. */
  traceId: string;
}
