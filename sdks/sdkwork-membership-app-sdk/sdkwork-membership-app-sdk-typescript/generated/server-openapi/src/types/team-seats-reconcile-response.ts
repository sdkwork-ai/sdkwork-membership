import type { SdkWorkResourceDataTeamSeatReconciliation } from './sdk-work-resource-data-team-seat-reconciliation';

export interface TeamSeatsReconcileResponse {
  code: 0;
  data: unknown & SdkWorkResourceDataTeamSeatReconciliation;
  /** Server-owned request correlation id. */
  traceId: string;
}
