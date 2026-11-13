import type { SdkWorkPageDataTeamSeatMembers } from './sdk-work-page-data-team-seat-members';

export interface TeamSeatsListResponse {
  code: 0;
  data: unknown & SdkWorkPageDataTeamSeatMembers;
  /** Server-owned request correlation id. */
  traceId: string;
}
