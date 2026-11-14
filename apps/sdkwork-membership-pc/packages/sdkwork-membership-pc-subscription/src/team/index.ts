/**
 * Organization (team) subscription surface shared by every membership host.
 *
 * A host wires the team surface by implementing
 * {@link SdkworkTeamSubscriptionPort} with its own generated SDK clients and
 * passing it through `SdkworkSubscriptionCatalogPage`'s `team` prop. Nothing in
 * this barrel imports an HTTP client or an SDK: membership-, IAM-, and
 * order-owned facts arrive only through the port, so the personal catalog and
 * the team seat surface cannot drift between apps.
 */

export {
  SdkworkSubscriptionAudienceTabs,
  type SdkworkSubscriptionAudience,
  type SdkworkSubscriptionAudienceLabels,
  type SdkworkSubscriptionAudienceTabsProps,
} from "./team-audience-tabs";
export {
  canManageTeamSeats,
  composeTeamSeatComposition,
  joinTeamSeatDirectory,
  normalizeSdkworkTeamMembershipKind,
  parseOwnMemberships,
  resolveTeamOrganizationId,
  resolveTeamViewerRole,
  teamOrganizationRoleLabelKey,
  teamRosterDisplayName,
  type SdkworkTeamRoleCopy,
  type SdkworkTeamSeatComposition,
  type SdkworkTeamSeatDirectoryRow,
} from "./team-roster-composition";
export {
  resolveTeamPlanErrorCopy,
  type SdkworkTeamErrorCopy,
} from "./team-plan-error-copy";
export {
  clampTeamSeatCount,
  computeTeamSeatTotal,
  formatTeamCnyAmount,
  groupTeamPlanPackages,
  parseTeamSeatInput,
  resolveAdditionalSeatBounds,
  resolveDefaultAdditionalSeatCount,
  resolveDefaultTeamSeatCount,
  resolveTeamSeatBounds,
  selectTeamPlanPackage,
  toTeamBillingCycle,
  type SdkworkTeamBillingCycle,
  type SdkworkTeamPlanGroup,
  type SdkworkTeamPlanPackageLike,
  type SdkworkTeamSeatBounds,
} from "./team-plan-pricing";
export {
  SdkworkTeamOrganizationBindPanel,
  type SdkworkTeamOrganizationBindPanelProps,
} from "./team-organization-bind-panel";
export {
  SdkworkTeamOrganizationSelector,
  type SdkworkTeamOrganizationSelectorProps,
} from "./team-organization-selector";
export {
  SdkworkTeamPlanCards,
  type SdkworkTeamBuyRequest,
  type SdkworkTeamPlanCardsProps,
} from "./team-plan-cards";
export { SdkworkTeamSeatDirectory, type SdkworkTeamSeatDirectoryProps } from "./team-seat-directory";
export {
  SdkworkTeamSeatPolicyPanel,
  type SdkworkTeamSeatPolicyPanelProps,
} from "./team-seat-policy";
export {
  SdkworkTeamSubscriptionSummary,
  type SdkworkTeamSubscriptionSummaryProps,
} from "./team-subscription-summary";
export { SdkworkTeamSubscriptionSurface } from "./team-subscription-surface";
export {
  SdkworkTeamSurfaceProvider,
  formatSdkworkTeamCopy,
  useSdkworkTeamSurfaceRuntime,
  useSdkworkTeamTranslate,
  type SdkworkTeamNotify,
  type SdkworkTeamSurfaceProviderProps,
  type SdkworkTeamSurfaceRuntime,
} from "./team-surface-context";
export {
  SDKWORK_TEAM_ERROR_REASONS,
  SDKWORK_TEAM_PLATFORM_ORGANIZATION_ID,
  SdkworkTeamSubscriptionError,
  isSdkworkTeamSubscriptionUnbound,
  loadSdkworkTeamRoster,
  loadSdkworkTeamSnapshot,
  normalizeSdkworkTeamError,
  readSdkworkTeamPackageNumericId,
  resolveTeamOrganizationChoices,
  type SdkworkTeamCheckoutAction,
  type SdkworkTeamCheckoutInput,
  type SdkworkTeamCheckoutPayment,
  type SdkworkTeamErrorReason,
  type SdkworkTeamMembershipKind,
  type SdkworkTeamOrganizationBindingStatus,
  type SdkworkTeamOwnMembership,
  type SdkworkTeamOrganizationChoice,
  type SdkworkTeamPackage,
  type SdkworkTeamRosterMember,
  type SdkworkTeamRosterPage,
  type SdkworkTeamRosterQuery,
  type SdkworkTeamSeatAssignment,
  type SdkworkTeamSeatAssignmentResult,
  type SdkworkTeamSeatPolicy,
  type SdkworkTeamSeatPolicyInput,
  type SdkworkTeamSeatReconciliationResult,
  type SdkworkTeamSnapshot,
  type SdkworkTeamSubscriptionOverview,
  type SdkworkTeamSubscriptionPort,
} from "./team-subscription-port";
