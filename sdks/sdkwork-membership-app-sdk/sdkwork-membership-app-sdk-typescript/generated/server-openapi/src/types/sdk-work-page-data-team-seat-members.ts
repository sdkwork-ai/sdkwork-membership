import type { PageInfo } from './page-info';
import type { TeamSeatMember } from './team-seat-member';

/** Typed page data wrapper for the organization seat directory. */
export interface SdkWorkPageDataTeamSeatMembers {
  items: TeamSeatMember[];
  pageInfo: PageInfo;
}
