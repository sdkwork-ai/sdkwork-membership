import type { SdkWorkPageDataTeamSeatAssignments } from './sdk-work-page-data-team-seat-assignments';

export interface TeamSeatsListResponse {
  code: 0;
  data: unknown & SdkWorkPageDataTeamSeatAssignments;
  /** Server-owned request correlation id. */
  traceId: string;
}
