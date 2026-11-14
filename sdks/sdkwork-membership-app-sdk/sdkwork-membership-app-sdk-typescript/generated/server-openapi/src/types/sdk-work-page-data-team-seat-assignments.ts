import type { PageInfo } from './page-info';
import type { TeamSeatAssignment } from './team-seat-assignment';

/** Typed page data wrapper for the organization seat assignments. */
export interface SdkWorkPageDataTeamSeatAssignments {
  items: TeamSeatAssignment[];
  pageInfo: PageInfo;
}
