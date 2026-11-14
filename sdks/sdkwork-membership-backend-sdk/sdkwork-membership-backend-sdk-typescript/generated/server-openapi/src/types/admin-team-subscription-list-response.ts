import type { AdminTeamSubscriptionItem } from './admin-team-subscription-item';
import type { PageInfo } from './page-info';

export interface AdminTeamSubscriptionListResponse {
  code: 0;
  data: unknown & { items: AdminTeamSubscriptionItem[]; pageInfo: PageInfo; };
  /** Server-owned request correlation id. */
  traceId: string;
}
