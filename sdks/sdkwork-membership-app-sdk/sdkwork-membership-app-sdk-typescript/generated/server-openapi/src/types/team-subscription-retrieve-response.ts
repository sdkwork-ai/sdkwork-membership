import type { SdkWorkResourceDataTeamSubscriptionOverview } from './sdk-work-resource-data-team-subscription-overview';

export interface TeamSubscriptionRetrieveResponse {
  code: 0;
  data: unknown & SdkWorkResourceDataTeamSubscriptionOverview;
  /** Server-owned request correlation id. */
  traceId: string;
}
