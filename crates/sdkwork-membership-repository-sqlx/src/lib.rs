pub mod catalog;
mod entity_id;
pub mod pagination;
mod postgres;
mod read_model;
pub mod shared;
mod types;

pub use entity_id::TimestampMembershipEntityIdGenerator;
pub use postgres::PostgresCommerceMembershipStore;
/// IAM-owned in-process organization directory port, re-exported so test
/// doubles can replace the sqlx implementation through
/// [`PostgresCommerceMembershipStore::with_organization_directory`].
///
/// Membership consumes this port instead of reading IAM tables
/// (`MODULE_SPEC.md` §4.2.1, `DOMAIN_SPEC.md` §5).
pub use sdkwork_iam_directory_repository_sqlx::{
    IamDirectoryError, IamDirectoryFuture, IamOrganizationDirectory, IamOrganizationMemberQuery,
    IamOrganizationMemberRecord, IamOrganizationRecord, SqlxIamOrganizationDirectory,
};
pub use types::{
    admin_membership_catalog_meta, is_valid_membership_audience, is_valid_membership_category,
    is_valid_membership_seat_policy, membership_role_can_manage_seats, AdminMembershipCatalogMeta,
    AdminMembershipEntitlementItem, AdminMembershipFuture, AdminMembershipMemberItem,
    AdminMembershipPackageGroupItem, AdminMembershipPackageGroupMutation,
    AdminMembershipPackageItem, AdminMembershipPackageMutation, AdminMembershipPlanItem,
    AdminMembershipPlanMutation, AdminMembershipStore, AdminMembershipSubject,
    AppMembershipBenefitItem, AppMembershipCommandFuture, AppMembershipDailyRewardResponse,
    AppMembershipDailyRewardStatusResponse, AppMembershipEntityIdGenerator,
    AppMembershipFulfillmentFuture, AppMembershipInfoResponse, AppMembershipListQuery,
    AppMembershipPackageGroupItem, AppMembershipPackageItem, AppMembershipPlanItem,
    AppMembershipPointsBalanceResponse, AppMembershipPointsHistoryItem,
    AppMembershipPointsHistoryQuery, AppMembershipPrivilegeUsageResponse,
    AppMembershipPurchaseOutcome, AppMembershipReadFuture, AppMembershipResult,
    AppMembershipStatusResponse, AppMembershipStore, AppMembershipSubject, AppMembershipTeamScope,
    AssignTeamSeatCommand, ConsumeSubscriptionQuotaCommand, CouponSubscriptionFulfillmentFuture,
    CouponSubscriptionFulfillmentOutcome, CreateAdminMembershipPackageCommand,
    CreateAdminMembershipPackageGroupCommand, CreateAdminMembershipPlanCommand,
    DeleteAdminMembershipPackageCommand, DeleteAdminMembershipPackageGroupCommand,
    DeleteAdminMembershipPlanCommand, FeatureAccessCheckOutcome, FeatureAccessCheckQuery,
    FulfillMembershipPurchaseCommand, FulfillMembershipPurchaseOutcome,
    FulfillPaidMembershipPurchaseCommand, GrantCouponSubscriptionCommand,
    ListAdminMembershipEntitlementsQuery, ListAdminMembershipMembersQuery,
    ListAdminMembershipPackageGroupsQuery, ListAdminMembershipPackagesQuery,
    ListAdminMembershipPlansQuery, MembershipLifecycleSweepOutcome,
    RechargeSubscriptionQuotaCommand, RetrieveAdminMembershipMemberQuery, RevokeTeamSeatCommand,
    SubmitMembershipPurchaseCommand, SubscriptionQuotaConsumptionFuture,
    SubscriptionQuotaConsumptionOutcome, SubscriptionQuotaRechargeFuture,
    SubscriptionQuotaRechargeOutcome, TeamSeatAssignmentItem, TeamSeatMember, TeamSeatsQuery,
    TeamSubscriptionOverview, TeamSubscriptionQuery, UpdateAdminMembershipMemberStatusCommand,
    UpdateAdminMembershipPackageCommand, UpdateAdminMembershipPackageGroupCommand,
    UpdateAdminMembershipPlanCommand, UpdateTeamSeatPolicyCommand, MEMBERSHIP_AUDIENCES,
    MEMBERSHIP_SEAT_ASSIGNMENT_STATES, MEMBERSHIP_SEAT_POLICIES, MEMBERSHIP_TEAM_ROLES,
};
