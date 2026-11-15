use std::future::Future;
use std::pin::Pin;

use sdkwork_contract_service::CommerceServiceError;
use sdkwork_utils_rust::{SdkWorkCommandData, SdkWorkPageData};
use serde::{Deserialize, Serialize};

pub use crate::pagination::MembershipListQuery as AppMembershipListQuery;

/// Membership category vocabulary (wire/storage values).
///
/// The catalog is classified into plan families: `token` (Token Plan
/// compute-credit plans) and `community` (circle/community membership
/// plans). Future categories are added here and in the matching database
/// CHECK constraints via migration.
pub const MEMBERSHIP_CATEGORIES: [&str; 2] = ["token", "community"];

/// Returns true when `value` is a declared membership category.
pub fn is_valid_membership_category(value: &str) -> bool {
    MEMBERSHIP_CATEGORIES.contains(&value)
}

/// Catalog lifecycle status vocabulary shared by plan, package group, and
/// package rows. `disabled` is the soft-delete marker written by admin
/// delete commands.
pub const MEMBERSHIP_CATALOG_STATUSES: [&str; 3] = ["active", "inactive", "disabled"];

/// Billing / recurrence cycle vocabulary for package groups and packages.
pub const MEMBERSHIP_BILLING_CYCLES: [&str; 6] =
    ["once", "day", "week", "month", "quarter", "year"];

/// Benefit type vocabulary for benefit definitions.
pub const MEMBERSHIP_BENEFIT_TYPES: [&str; 5] = ["points", "feature", "queue", "quota", "service"];

/// Subscription status vocabulary aligned with the domain state machine.
pub const MEMBERSHIP_SUBSCRIPTION_STATUSES: [&str; 6] = [
    "pending",
    "pending_activation",
    "active",
    "grace_period",
    "expired",
    "cancelled",
];

/// Catalog audience vocabulary: `personal` catalog rows serve a single user,
/// `team` rows serve an organization with licensed seats (`API` surface
/// `audience` query parameter, default `personal`).
pub const MEMBERSHIP_AUDIENCES: [&str; 2] = ["personal", "team"];

/// Returns true when `value` is a declared catalog audience.
pub fn is_valid_membership_audience(value: &str) -> bool {
    MEMBERSHIP_AUDIENCES.contains(&value)
}

/// Seat policy vocabulary: `strict` refuses assignments beyond
/// `seats_purchased`, `flex_overflow` allows over-assignment (billable
/// overflow) while still tracking `seats_used` above the licensed capacity.
pub const MEMBERSHIP_SEAT_POLICIES: [&str; 2] = ["strict", "flex_overflow"];

/// Returns true when `value` is a declared seat policy.
pub fn is_valid_membership_seat_policy(value: &str) -> bool {
    MEMBERSHIP_SEAT_POLICIES.contains(&value)
}

/// Seat assignment lifecycle vocabulary.
pub const MEMBERSHIP_SEAT_ASSIGNMENT_STATES: [&str; 2] = ["active", "revoked"];

/// Paid-order action that expands an existing organization subscription's
/// licensed seat capacity.
///
/// `add_seats` is fulfilled by incrementing
/// `membership_subscription.seats_purchased` for the buyer organization's
/// active/`grace_period` subscription of the same plan family. It never creates
/// a new subscription or period, never touches `starts_at`/`expires_at`/
/// `current_period_id`, and never changes `seats_used`; the audit row is written
/// as `seat_purchase` with metadata `{"seats":N,"mode":"add_seats"}`.
///
/// `renew` remains the period-extension action, so "buy more seats" can no
/// longer reuse it.
pub const MEMBERSHIP_PURCHASE_ACTION_ADD_SEATS: &str = "add_seats";

/// Static catalog enum reference served to admin surfaces as the single
/// source of truth for dropdown options (kept in sync with the database
/// CHECK constraints).
#[derive(Debug, Clone, Default, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AdminMembershipCatalogMeta {
    pub categories: Vec<String>,
    pub plan_statuses: Vec<String>,
    pub package_statuses: Vec<String>,
    pub package_group_statuses: Vec<String>,
    pub billing_cycles: Vec<String>,
    pub benefit_types: Vec<String>,
    pub subscription_statuses: Vec<String>,
}

/// Builds the admin catalog enum reference.
pub fn admin_membership_catalog_meta() -> AdminMembershipCatalogMeta {
    AdminMembershipCatalogMeta {
        categories: MEMBERSHIP_CATEGORIES
            .iter()
            .map(|value| (*value).to_owned())
            .collect(),
        plan_statuses: MEMBERSHIP_CATALOG_STATUSES
            .iter()
            .map(|value| (*value).to_owned())
            .collect(),
        package_statuses: MEMBERSHIP_CATALOG_STATUSES
            .iter()
            .map(|value| (*value).to_owned())
            .collect(),
        package_group_statuses: MEMBERSHIP_CATALOG_STATUSES
            .iter()
            .map(|value| (*value).to_owned())
            .collect(),
        billing_cycles: MEMBERSHIP_BILLING_CYCLES
            .iter()
            .map(|value| (*value).to_owned())
            .collect(),
        benefit_types: MEMBERSHIP_BENEFIT_TYPES
            .iter()
            .map(|value| (*value).to_owned())
            .collect(),
        subscription_statuses: MEMBERSHIP_SUBSCRIPTION_STATUSES
            .iter()
            .map(|value| (*value).to_owned())
            .collect(),
    }
}

pub type AppMembershipResult<T> = Result<T, CommerceServiceError>;

pub type AppMembershipReadFuture<'a, T> =
    Pin<Box<dyn Future<Output = AppMembershipResult<T>> + Send + 'a>>;
pub type AppMembershipCommandFuture<'a> =
    Pin<Box<dyn Future<Output = AppMembershipResult<AppMembershipPurchaseOutcome>> + Send + 'a>>;
pub type AppMembershipFulfillmentFuture<'a> = Pin<
    Box<dyn Future<Output = AppMembershipResult<FulfillMembershipPurchaseOutcome>> + Send + 'a>,
>;
pub type CouponSubscriptionFulfillmentFuture<'a> = Pin<
    Box<dyn Future<Output = AppMembershipResult<CouponSubscriptionFulfillmentOutcome>> + Send + 'a>,
>;
pub type SubscriptionQuotaConsumptionFuture<'a> = Pin<
    Box<dyn Future<Output = AppMembershipResult<SubscriptionQuotaConsumptionOutcome>> + Send + 'a>,
>;
pub type SubscriptionQuotaRechargeFuture<'a> = Pin<
    Box<dyn Future<Output = AppMembershipResult<SubscriptionQuotaRechargeOutcome>> + Send + 'a>,
>;
pub type AdminMembershipFuture<'a, T> =
    Pin<Box<dyn Future<Output = AppMembershipResult<T>> + Send + 'a>>;

pub trait AppMembershipEntityIdGenerator {
    fn generate_entity_uuid(&self) -> AppMembershipResult<String>;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AppMembershipSubject {
    pub tenant_id: i64,
    pub organization_id: i64,
    pub user_id: i64,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct AppMembershipPointsHistoryQuery {
    pub page: Option<i64>,
    pub page_size: Option<i64>,
    pub cursor: Option<String>,
}

impl AppMembershipPointsHistoryQuery {
    pub fn limit(&self) -> i64 {
        self.page_size.unwrap_or(20).clamp(1, 200)
    }

    pub fn offset(&self) -> i64 {
        let page = self.page.unwrap_or(1).max(1);
        (page - 1) * self.limit()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AdminMembershipSubject {
    pub tenant_id: i64,
    pub organization_id: i64,
    pub operator_id: i64,
    pub operator_type: i32,
}

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppMembershipBenefitItem {
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub id: i64,
    pub name: String,
    pub benefit_key: Option<String>,
    pub r#type: Option<String>,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub claimed: bool,
    #[serde(with = "sdkwork_utils_rust::serde_int64::option", default)]
    pub usage_limit: Option<i64>,
    #[serde(with = "sdkwork_utils_rust::serde_int64::option", default)]
    pub used_count: Option<i64>,
    /// Raw text value of the benefit grant quantity. Used for non-numeric
    /// comparison table cells like "2K", "4K/8K", "8折算力积分", "标准生成通道".
    /// When the grant_quantity is a pure number, display_value is None and
    /// usage_limit holds the parsed integer. When it is a text value,
    /// usage_limit is None and display_value holds the raw text.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub display_value: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppMembershipPlanItem {
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub id: i64,
    /// Catalog classification of this plan (`token` | `community`).
    pub category: String,
    pub name: String,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub rank: i64,
    #[serde(with = "sdkwork_utils_rust::serde_int64::option", default)]
    pub required_points: Option<i64>,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub badge: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppMembershipInfoResponse {
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub plan_rank: i64,
    pub plan_name: String,
    pub membership_status: String,
    pub started_at: Option<String>,
    pub expires_at: Option<String>,
    #[serde(with = "sdkwork_utils_rust::serde_int64::option", default)]
    pub remaining_days: Option<i64>,
    #[serde(with = "sdkwork_utils_rust::serde_int64::option", default)]
    pub total_days: Option<i64>,
    pub total_spent: Option<String>,
    #[serde(with = "sdkwork_utils_rust::serde_int64::option", default)]
    pub points: Option<i64>,
    #[serde(with = "sdkwork_utils_rust::serde_int64::option", default)]
    pub growth_value: Option<i64>,
    #[serde(with = "sdkwork_utils_rust::serde_int64::option", default)]
    pub upgrade_growth_value: Option<i64>,
    pub benefits: Vec<AppMembershipBenefitItem>,
}

#[derive(Debug, Clone, Default, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppMembershipStatusResponse {
    pub active: bool,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub plan_rank: i64,
    pub expires_at: Option<String>,
    #[serde(with = "sdkwork_utils_rust::serde_int64::option", default)]
    pub point_balance: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppMembershipPackageItem {
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub id: i64,
    /// Catalog package group this package belongs to, as served by
    /// `AppMembershipPackageGroupItem.id` (the group's external id).
    ///
    /// Hosts use it to pick the package that belongs to the billing-cycle group
    /// the buyer selected, instead of inferring the cycle from `recurrence_cycle`.
    pub package_group_id: String,
    /// Catalog classification of this package (`token` | `community`),
    /// snapshotted from its package group.
    pub category: String,
    /// Catalog audience of this package (`personal` | `team`).
    pub audience: String,
    pub name: String,
    pub description: Option<String>,
    pub price: String,
    pub original_price: Option<String>,
    /// Per-seat pricing mode: `package` (one price for the whole package) or
    /// `seat` (price is the unit price of one seat for one billing period).
    pub price_unit: String,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub point_amount: i64,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub duration_days: i64,
    pub plan_name: Option<String>,
    /// Storage id of the plan this package grants.
    pub plan_id: String,
    /// Plan rank as served by `AppMembershipPlanItem.id`.
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub plan_rank: i64,
    /// Billing recurrence of this package (`once` | `day` | `week` | `month` | `quarter` | `year`).
    pub recurrence_cycle: Option<String>,
    /// Minimum purchasable seat quantity for per-seat team packages.
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub seat_min: i64,
    /// Maximum purchasable seat quantity for per-seat team packages.
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub seat_max: i64,
    /// Membership points every assigned seat receives per billing period.
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub seat_points_amount: i64,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub sort_weight: i64,
    pub recommended: bool,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppMembershipPackageGroupItem {
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub id: i64,
    /// Catalog classification of this group (`token` | `community`).
    pub category: String,
    /// Catalog audience of this group (`personal` | `team`).
    pub audience: String,
    pub name: String,
    pub description: Option<String>,
    /// Billing cycle of this group (`once` | `day` | `week` | `month` | `quarter` | `year`).
    pub billing_cycle: Option<String>,
    /// Billing duration in days for this group.
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub duration_days: i64,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub sort_weight: i64,
    pub packages: Vec<AppMembershipPackageItem>,
}

#[derive(Debug, Clone, Default, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppMembershipPointsBalanceResponse {
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub points: i64,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub available_points: i64,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub frozen_points: i64,
}

#[derive(Debug, Clone, Default, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppMembershipPointsHistoryItem {
    pub id: String,
    pub change_type: String,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub change_amount: i64,
    #[serde(with = "sdkwork_utils_rust::serde_int64::option", default)]
    pub before_balance: Option<i64>,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub after_balance: i64,
    pub source_type: String,
    pub remark: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppMembershipDailyRewardStatusResponse {
    pub can_claim: bool,
    pub claimed_today: bool,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub consecutive_days: i64,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub total_days: i64,
}

#[derive(Debug, Clone, Default, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppMembershipDailyRewardResponse {
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub reward_points: i64,
    pub claimed_at: Option<String>,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub consecutive_days: i64,
}

#[derive(Debug, Clone, Default, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppMembershipPrivilegeUsageResponse {
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub speed_up_used: i64,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub speed_up_limit: i64,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub priority_queue_used: i64,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub priority_queue_limit: i64,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub exclusive_model_used: i64,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub exclusive_model_limit: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SubmitMembershipPurchaseCommand {
    pub subject: AppMembershipSubject,
    pub package_id: i64,
    pub order_uuid: String,
    pub membership_uuid: String,
    pub order_no: String,
    pub idempotency_key: String,
    pub requested_at: String,
    pub action: String,
    /// Purchased seat quantity for a team (organization) plan order; `1` for
    /// every personal purchase. Team fulfillment multiplies the entitlement
    /// grant quantity by this value.
    pub seats: i64,
    /// Raw IAM organization id carried by the order. When absent, the numeric
    /// organization scope of `subject` is used as the subscription
    /// `subject_id`.
    pub organization_subject_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FulfillMembershipPurchaseCommand {
    pub subject: AppMembershipSubject,
    pub order_id: String,
    pub request_no: String,
    pub idempotency_key: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FulfillPaidMembershipPurchaseCommand {
    pub subject: AppMembershipSubject,
    pub package_id: i64,
    pub order_id: String,
    pub membership_id: String,
    pub order_no: String,
    pub request_no: String,
    pub idempotency_key: String,
    pub paid_at: String,
    pub action: String,
    /// Seat quantity from the paid order (team plans). Must be at least 1 and
    /// is ignored by personal plans, which always license a single seat.
    ///
    /// For `action = "add_seats"` this is the number of seats to ADD to the
    /// organization's existing subscription (`seats_purchased += seats`), not the
    /// resulting seat total.
    pub seats: i64,
    /// Raw IAM organization id from the paid order. Used as the subscription
    /// `subject_id` when the purchased plan audience is `team`.
    pub organization_subject_id: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FulfillMembershipPurchaseOutcome {
    pub accepted: bool,
    pub replayed: bool,
    pub fulfillment_status: String,
}

#[derive(Debug, Clone, Default, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppMembershipPurchaseOutcome {
    pub request_no: String,
    pub order_id: String,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub package_id: i64,
    pub package_name: String,
    pub amount: String,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub duration_days: i64,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub target_plan_rank: i64,
    pub target_plan_name: String,
    pub status: String,
}

#[derive(Debug, Clone, Default, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AdminMembershipPlanItem {
    pub id: String,
    /// Catalog classification (`token` | `community`).
    pub category: String,
    pub code: String,
    pub name: String,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub rank: i64,
    pub benefits: Vec<AppMembershipBenefitItem>,
    pub status: String,
    pub description: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Default, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AdminMembershipPackageItem {
    pub id: String,
    /// Catalog classification (`token` | `community`), consistent with the
    /// package's group and plan.
    pub category: String,
    /// Backend-assigned package external id (the `packageId` order creation
    /// resolves by external id).
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub external_id: i64,
    pub code: String,
    pub package_group_id: String,
    pub plan_id: String,
    pub name: String,
    pub price_amount: String,
    pub currency_code: String,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub duration_days: i64,
    pub discount: i64,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Default, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AdminMembershipPackageGroupItem {
    pub id: String,
    /// Catalog classification (`token` | `community`).
    pub category: String,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub billing_cycle: String,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub duration_days: i64,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub sort_weight: i64,
    pub status: String,
}

#[derive(Debug, Clone, Default, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AdminMembershipMemberItem {
    pub id: String,
    pub owner_user_id: String,
    pub plan_code: String,
    pub status: String,
    pub started_at: String,
    pub expires_at: String,
}

/// One organization (team) subscription row for the admin/ops read model.
///
/// Membership-owned facts only. The organization identity is the subscription
/// `subject_id` (the IAM organization id licensed by the plan); IAM profiles,
/// organization roles, and member rows are never read or projected here.
#[derive(Debug, Clone, Default, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AdminTeamSubscriptionItem {
    /// Membership subscription storage id.
    pub subscription_id: String,
    /// IAM organization id the subscription is licensed to.
    pub organization_id: String,
    /// Membership plan storage id.
    pub plan_id: String,
    /// Display name of the joined plan (absent when the plan row is gone).
    pub plan_name: Option<String>,
    pub status: String,
    pub starts_at: String,
    pub expires_at: String,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub seats_purchased: i64,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub seats_used: i64,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub seats_available: i64,
    /// `strict` or `flex_overflow`.
    pub seat_policy: String,
    pub auto_assign_seat: bool,
    /// IAM user id of the subscription owner; IAM remains the owner of the
    /// user profile.
    pub owner_user_id: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Default, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AdminMembershipEntitlementItem {
    pub id: String,
    pub code: String,
    pub plan_id: String,
    pub membership_id: String,
    pub quota: String,
    pub status: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ListAdminMembershipPlansQuery {
    pub subject: AdminMembershipSubject,
    pub category: Option<String>,
    pub status: Option<String>,
    pub page: Option<i64>,
    pub page_size: Option<i64>,
    pub cursor: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ListAdminMembershipPackagesQuery {
    pub subject: AdminMembershipSubject,
    pub category: Option<String>,
    pub package_group_id: Option<String>,
    pub plan_id: Option<String>,
    pub status: Option<String>,
    pub page: Option<i64>,
    pub page_size: Option<i64>,
    pub cursor: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ListAdminMembershipPackageGroupsQuery {
    pub subject: AdminMembershipSubject,
    pub category: Option<String>,
    pub status: Option<String>,
    pub page: Option<i64>,
    pub page_size: Option<i64>,
    pub cursor: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ListAdminMembershipMembersQuery {
    pub subject: AdminMembershipSubject,
    pub user_id: Option<String>,
    pub plan_id: Option<String>,
    pub status: Option<String>,
    pub page: Option<i64>,
    pub page_size: Option<i64>,
    pub cursor: Option<String>,
}

/// Query for the admin/ops organization (team) subscription read model.
///
/// `subject` carries the tenant/organization scope resolved from the backend
/// principal, never from an ambient header. Only the tenant scopes the query:
/// this is a tenant-wide ops view, so the caller's own organization is not an
/// implicit filter. `organization_id` narrows explicitly to one IAM
/// organization id, and `q` is a free-text match over the subscription id,
/// organization id, and plan name.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ListAdminTeamSubscriptionsQuery {
    pub subject: AdminMembershipSubject,
    pub q: Option<String>,
    pub status: Option<String>,
    pub plan_id: Option<String>,
    pub organization_id: Option<String>,
    pub page: Option<i64>,
    pub page_size: Option<i64>,
    pub cursor: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GrantCouponSubscriptionCommand {
    pub subject: AppMembershipSubject,
    pub product_id: String,
    pub sku_id: String,
    pub package_id: i64,
    pub order_id: String,
    pub subscription_id: String,
    pub request_no: String,
    pub idempotency_key: String,
    pub requested_at: String,
    pub period: String,
    pub duration_days: i64,
    pub daily_quota: i64,
    pub total_quota: i64,
}

#[derive(Debug, Clone, Default, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CouponSubscriptionFulfillmentOutcome {
    pub accepted: bool,
    pub replayed: bool,
    pub subscription_id: String,
    pub starts_at: String,
    pub expires_at: String,
    pub fulfillment_status: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConsumeSubscriptionQuotaCommand {
    pub subject: AppMembershipSubject,
    pub amount: i64,
    pub request_no: String,
    pub idempotency_key: String,
    pub requested_at: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SubscriptionQuotaConsumptionOutcome {
    pub accepted: bool,
    pub replayed: bool,
    pub benefit_code: String,
    pub subscription_id: String,
    pub consumed_amount: i64,
    pub daily_quota: i64,
    pub used_daily_quota: i64,
    pub remaining_daily_quota: i64,
    pub total_quota: i64,
    pub remaining_total_quota: i64,
}

/// 会员订阅生命周期扫描结果（到期即过期处理）。
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct MembershipLifecycleSweepOutcome {
    pub expired_subscriptions: i64,
    pub expired_periods: i64,
    pub expired_grants: i64,
    pub expired_accounts: i64,
    /// true 表示本轮被 advisory lock 跳过（另一实例正在执行）。
    pub skipped: bool,
}

/// 订阅期权益额度充值命令（订单结算后由 order 通过端口调用）。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RechargeSubscriptionQuotaCommand {
    pub subject: AppMembershipSubject,
    pub order_id: String,
    pub quantity: i64,
    pub request_no: String,
    pub idempotency_key: String,
    pub requested_at: String,
}

/// 订阅期权益额度充值结果。
#[derive(Debug, Clone, Default, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SubscriptionQuotaRechargeOutcome {
    pub accepted: bool,
    pub replayed: bool,
    pub subscription_id: String,
    pub benefit_code: String,
    pub recharged_quantity: i64,
    pub balance_after: i64,
    pub expires_at: String,
}

/// 会员功能等级门槛校验查询。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FeatureAccessCheckQuery {
    pub subject: AppMembershipSubject,
    /// 功能码；缺省时按显式 required_rank 校验。
    pub feature_code: Option<String>,
    /// 显式所需等级；缺省时按功能码解析。
    pub required_rank: Option<i64>,
}

/// 会员功能等级门槛校验结果。
#[derive(Debug, Clone, Default, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FeatureAccessCheckOutcome {
    pub allowed: bool,
    pub active: bool,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub current_rank: i64,
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    pub required_rank: i64,
    pub status: String,
    pub expires_at: Option<String>,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RetrieveAdminMembershipMemberQuery {
    pub subject: AdminMembershipSubject,
    pub membership_id: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ListAdminMembershipEntitlementsQuery {
    pub subject: AdminMembershipSubject,
    pub plan_id: Option<String>,
    pub membership_id: Option<String>,
    pub status: Option<String>,
    pub page: Option<i64>,
    pub page_size: Option<i64>,
    pub cursor: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AdminMembershipPlanMutation {
    pub category: String,
    pub code: String,
    pub name: String,
    pub rank: i64,
    pub benefits: Option<Vec<AppMembershipBenefitItem>>,
    pub status: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AdminMembershipPackageMutation {
    pub category: String,
    pub code: String,
    pub package_group_id: String,
    pub plan_id: String,
    pub name: String,
    pub price_amount: String,
    pub currency_code: String,
    pub duration_days: i64,
    pub discount: i64,
    pub status: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AdminMembershipPackageGroupMutation {
    pub category: String,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub billing_cycle: String,
    pub duration_days: i64,
    pub sort_weight: i64,
    pub status: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CreateAdminMembershipPlanCommand {
    pub subject: AdminMembershipSubject,
    pub plan_id: String,
    pub input: AdminMembershipPlanMutation,
    pub request_id: String,
    pub requested_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UpdateAdminMembershipPlanCommand {
    pub subject: AdminMembershipSubject,
    pub plan_id: String,
    pub input: AdminMembershipPlanMutation,
    pub request_id: String,
    pub requested_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeleteAdminMembershipPlanCommand {
    pub subject: AdminMembershipSubject,
    pub plan_id: String,
    pub request_id: String,
    pub requested_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CreateAdminMembershipPackageCommand {
    pub subject: AdminMembershipSubject,
    pub package_id: String,
    pub input: AdminMembershipPackageMutation,
    pub request_id: String,
    pub requested_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UpdateAdminMembershipPackageCommand {
    pub subject: AdminMembershipSubject,
    pub package_id: String,
    pub input: AdminMembershipPackageMutation,
    pub request_id: String,
    pub requested_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeleteAdminMembershipPackageCommand {
    pub subject: AdminMembershipSubject,
    pub package_id: String,
    pub request_id: String,
    pub requested_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CreateAdminMembershipPackageGroupCommand {
    pub subject: AdminMembershipSubject,
    pub package_group_id: String,
    pub input: AdminMembershipPackageGroupMutation,
    pub request_id: String,
    pub requested_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UpdateAdminMembershipPackageGroupCommand {
    pub subject: AdminMembershipSubject,
    pub package_group_id: String,
    pub input: AdminMembershipPackageGroupMutation,
    pub request_id: String,
    pub requested_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeleteAdminMembershipPackageGroupCommand {
    pub subject: AdminMembershipSubject,
    pub package_group_id: String,
    pub request_id: String,
    pub requested_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UpdateAdminMembershipMemberStatusCommand {
    pub subject: AdminMembershipSubject,
    pub membership_id: String,
    pub status: String,
    pub request_id: String,
    pub requested_at: String,
}

/// Read scope for team (organization) seat operations.
///
/// `tenant_id` / `organization_id` / `user_id` are the **raw** principal
/// strings: the organization id is the IAM organization id and is used both
/// for the IAM directory projection and as the team subscription `subject_id`.
/// IAM remains the owner of organizations and memberships; membership only
/// reads them.
///
/// `organization_id` is **empty** for a platform/personal session (the session
/// runs in the platform organization `0`). Such a session is a valid reader of
/// the team surface: it resolves the caller's unbound team subscription
/// instead of an organization-scoped one, and it can bind that subscription to
/// an organization through [`BindTeamSubscriptionCommand`].
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AppMembershipTeamScope {
    pub tenant_id: String,
    pub organization_id: String,
    pub user_id: String,
}

/// Query for the current organization's team subscription overview.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TeamSubscriptionQuery {
    pub scope: AppMembershipTeamScope,
}

/// Query for the organization seat assignments (one row per active seat).
///
/// The IAM member directory is not read here: the organization roster is an
/// IAM-owned fact and the caller composes it through the IAM app SDK.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TeamSeatsQuery {
    pub scope: AppMembershipTeamScope,
    pub page: Option<i64>,
    pub page_size: Option<i64>,
}

/// Team subscription overview for the current organization.
///
/// `has_subscription=false` is a normal 200 response: the organization simply
/// has no active/pending team subscription yet.
///
/// `organization_id` is empty when the answer is the caller's unbound
/// subscription (bought before any organization was chosen); the surface then
/// renders the "bind an organization" step instead of the seat directory.
#[derive(Debug, Clone, Default, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TeamSubscriptionOverview {
    /// Raw IAM organization id (never a header; resolved from the principal).
    /// Empty on an unbound subscription.
    pub organization_id: String,
    pub has_subscription: bool,
    pub subscription_id: Option<String>,
    /// Catalog plan id as served by `GET /plans` (the plan rank).
    #[serde(with = "sdkwork_utils_rust::serde_int64::option", default)]
    pub plan_id: Option<i64>,
    pub plan_name: Option<String>,
    #[serde(with = "sdkwork_utils_rust::serde_int64::option", default)]
    pub plan_rank: Option<i64>,
    pub status: Option<String>,
    pub starts_at: Option<String>,
    pub expires_at: Option<String>,
    pub seats_purchased: i64,
    pub seats_used: i64,
    pub seats_available: i64,
    pub seat_policy: String,
    pub auto_assign_seat: bool,
    /// Organization binding lifecycle of the reported subscription
    /// (`bound` | `unbound`); absent when the caller has no team subscription.
    pub organization_binding_status: Option<String>,
}

/// One active organization seat assignment.
///
/// Membership owns the assignment row only. Member identity, role, and contact
/// data stay IAM-owned and are composed by the caller from the IAM roster.
#[derive(Debug, Clone, Default, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TeamSeatAssignment {
    /// IAM user id the seat is assigned to.
    pub user_id: String,
    /// IAM organization membership row id snapshotted at assignment time.
    pub membership_id: Option<String>,
    pub seat_no: i64,
    pub assigned_at: String,
}

/// Assign a seat to an active organization member.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AssignTeamSeatCommand {
    pub scope: AppMembershipTeamScope,
    pub target_user_id: String,
    pub requested_at: String,
}

/// Revoke the active seat assignment of an organization member.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RevokeTeamSeatCommand {
    pub scope: AppMembershipTeamScope,
    pub target_user_id: String,
    pub requested_at: String,
}

/// Update the team subscription seat policy / auto-assign flag.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UpdateTeamSeatPolicyCommand {
    pub scope: AppMembershipTeamScope,
    pub seat_policy: String,
    pub auto_assign_seat: bool,
    pub requested_at: String,
}

/// Reconcile the organization seat ledger with the IAM-owned roster.
///
/// IAM is the owner of organization membership, so membership never decides on
/// its own whether an assigned user is still an active member: the store asks
/// the injected [`IamOrganizationDirectory`](sdkwork_iam_directory_repository_sqlx::IamOrganizationDirectory)
/// port through `filter_active_member_ids`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReconcileTeamSeatsCommand {
    pub scope: AppMembershipTeamScope,
    pub requested_at: String,
}

/// Bind the caller's unbound team subscription to an IAM organization.
///
/// `scope.organization_id` is the **target** organization; `scope.user_id` is
/// the caller that must hold the IAM `TEAM_SEAT_MANAGE` capability there. The
/// subscription is resolved by `owner_user_id = scope.user_id` and
/// `organization_binding_status = 'unbound'`, so a caller can never bind
/// somebody else's unbound purchase.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BindTeamSubscriptionCommand {
    pub scope: AppMembershipTeamScope,
    pub requested_at: String,
}

/// Outcome of one seat reconciliation sweep.
///
/// Membership-owned facts only. `revoked_count = 0` is the normal answer for a
/// repeat call: reconciliation is idempotent and a second sweep revokes
/// nothing.
#[derive(Debug, Clone, Default, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TeamSeatReconciliation {
    /// Assignments revoked because their user left the organization.
    pub revoked_count: i64,
    /// Active seat count after the sweep.
    pub seats_used: i64,
    /// Licensed capacity of the current team subscription.
    pub seats_purchased: i64,
}

pub trait AppMembershipStore {
    fn load_info<'a>(
        &'a self,
        subject: Option<AppMembershipSubject>,
    ) -> AppMembershipReadFuture<'a, AppMembershipInfoResponse>;

    fn load_status<'a>(
        &'a self,
        subject: Option<AppMembershipSubject>,
    ) -> AppMembershipReadFuture<'a, AppMembershipStatusResponse>;

    fn load_plans<'a>(
        &'a self,
        catalog_subject: Option<AppMembershipSubject>,
        query: AppMembershipListQuery,
    ) -> AppMembershipReadFuture<'a, SdkWorkPageData<AppMembershipPlanItem>>;

    fn load_benefits<'a>(
        &'a self,
        subject: Option<AppMembershipSubject>,
        plan_id: Option<i64>,
        query: AppMembershipListQuery,
    ) -> AppMembershipReadFuture<'a, SdkWorkPageData<AppMembershipBenefitItem>>;

    fn load_packages<'a>(
        &'a self,
        catalog_subject: Option<AppMembershipSubject>,
        package_group_id: Option<i64>,
        plan_id: Option<i64>,
        query: AppMembershipListQuery,
    ) -> AppMembershipReadFuture<'a, SdkWorkPageData<AppMembershipPackageItem>>;

    fn load_package<'a>(
        &'a self,
        catalog_subject: Option<AppMembershipSubject>,
        package_id: i64,
        audience: String,
    ) -> AppMembershipReadFuture<'a, Option<AppMembershipPackageItem>>;

    fn load_package_groups<'a>(
        &'a self,
        catalog_subject: Option<AppMembershipSubject>,
        plan_id: Option<i64>,
        recommended_only: bool,
        query: AppMembershipListQuery,
    ) -> AppMembershipReadFuture<'a, SdkWorkPageData<AppMembershipPackageGroupItem>>;

    fn load_package_group<'a>(
        &'a self,
        catalog_subject: Option<AppMembershipSubject>,
        package_group_id: i64,
        audience: String,
    ) -> AppMembershipReadFuture<'a, Option<AppMembershipPackageGroupItem>>;

    fn load_points_balance<'a>(
        &'a self,
        subject: Option<AppMembershipSubject>,
    ) -> AppMembershipReadFuture<'a, AppMembershipPointsBalanceResponse>;

    fn load_points_history<'a>(
        &'a self,
        subject: Option<AppMembershipSubject>,
        query: AppMembershipPointsHistoryQuery,
    ) -> AppMembershipReadFuture<'a, SdkWorkPageData<AppMembershipPointsHistoryItem>>;

    fn load_daily_reward_status<'a>(
        &'a self,
        subject: Option<AppMembershipSubject>,
    ) -> AppMembershipReadFuture<'a, AppMembershipDailyRewardStatusResponse>;

    fn claim_daily_reward<'a>(
        &'a self,
        subject: AppMembershipSubject,
        requested_at: String,
    ) -> AppMembershipReadFuture<'a, AppMembershipDailyRewardResponse>;

    fn load_privilege_usage<'a>(
        &'a self,
        subject: Option<AppMembershipSubject>,
    ) -> AppMembershipReadFuture<'a, AppMembershipPrivilegeUsageResponse>;

    fn consume_speed_up<'a>(
        &'a self,
        subject: AppMembershipSubject,
        requested_at: String,
    ) -> AppMembershipReadFuture<'a, SdkWorkCommandData>;

    fn submit_purchase<'a>(
        &'a self,
        command: SubmitMembershipPurchaseCommand,
    ) -> AppMembershipCommandFuture<'a>;

    fn fulfill_purchase<'a>(
        &'a self,
        command: FulfillMembershipPurchaseCommand,
    ) -> AppMembershipFulfillmentFuture<'a>;

    fn fulfill_paid_purchase<'a>(
        &'a self,
        command: FulfillPaidMembershipPurchaseCommand,
    ) -> AppMembershipFulfillmentFuture<'a>;

    fn grant_coupon_subscription<'a>(
        &'a self,
        command: GrantCouponSubscriptionCommand,
    ) -> CouponSubscriptionFulfillmentFuture<'a>;

    fn consume_subscription_quota<'a>(
        &'a self,
        command: ConsumeSubscriptionQuotaCommand,
    ) -> SubscriptionQuotaConsumptionFuture<'a>;

    fn recharge_subscription_quota<'a>(
        &'a self,
        command: RechargeSubscriptionQuotaCommand,
    ) -> SubscriptionQuotaRechargeFuture<'a>;

    fn expire_due_memberships<'a>(
        &'a self,
    ) -> AppMembershipReadFuture<'a, MembershipLifecycleSweepOutcome>;

    fn check_feature_access<'a>(
        &'a self,
        query: FeatureAccessCheckQuery,
    ) -> AppMembershipReadFuture<'a, FeatureAccessCheckOutcome>;

    /// Team (organization) subscription overview for the current org.
    fn load_team_subscription<'a>(
        &'a self,
        query: TeamSubscriptionQuery,
    ) -> AppMembershipReadFuture<'a, TeamSubscriptionOverview>;

    /// Organization seat assignments: one row per active seat.
    fn load_team_seats<'a>(
        &'a self,
        query: TeamSeatsQuery,
    ) -> AppMembershipReadFuture<'a, SdkWorkPageData<TeamSeatAssignment>>;

    /// Assign the lowest free seat to an active organization member.
    fn assign_team_seat<'a>(
        &'a self,
        command: AssignTeamSeatCommand,
    ) -> AppMembershipReadFuture<'a, TeamSeatAssignment>;

    /// Revoke an active seat assignment.
    fn revoke_team_seat<'a>(
        &'a self,
        command: RevokeTeamSeatCommand,
    ) -> AppMembershipReadFuture<'a, ()>;

    /// Update the team subscription seat policy and auto-assign flag.
    fn update_team_seat_policy<'a>(
        &'a self,
        command: UpdateTeamSeatPolicyCommand,
    ) -> AppMembershipReadFuture<'a, TeamSubscriptionOverview>;

    /// Revoke the seat assignments of users that IAM no longer reports as
    /// active organization members.
    ///
    /// Idempotent: a second call finds no stale assignment and returns
    /// `revoked_count = 0`.
    fn reconcile_team_seats<'a>(
        &'a self,
        command: ReconcileTeamSeatsCommand,
    ) -> AppMembershipReadFuture<'a, TeamSeatReconciliation>;

    /// Bind the caller's unbound team subscription to an organization.
    ///
    /// Idempotent for a caller whose subscription is already bound to the same
    /// organization: the current bound overview is returned unchanged.
    fn bind_team_subscription<'a>(
        &'a self,
        command: BindTeamSubscriptionCommand,
    ) -> AppMembershipReadFuture<'a, TeamSubscriptionOverview>;
}

pub trait AdminMembershipStore {
    fn list_admin_membership_plans<'a>(
        &'a self,
        query: ListAdminMembershipPlansQuery,
    ) -> AdminMembershipFuture<'a, SdkWorkPageData<AdminMembershipPlanItem>>;

    fn create_admin_membership_plan<'a>(
        &'a self,
        command: CreateAdminMembershipPlanCommand,
    ) -> AdminMembershipFuture<'a, AdminMembershipPlanItem>;

    fn update_admin_membership_plan<'a>(
        &'a self,
        command: UpdateAdminMembershipPlanCommand,
    ) -> AdminMembershipFuture<'a, AdminMembershipPlanItem>;

    fn delete_admin_membership_plan<'a>(
        &'a self,
        command: DeleteAdminMembershipPlanCommand,
    ) -> AdminMembershipFuture<'a, bool>;

    fn list_admin_membership_packages<'a>(
        &'a self,
        query: ListAdminMembershipPackagesQuery,
    ) -> AdminMembershipFuture<'a, SdkWorkPageData<AdminMembershipPackageItem>>;

    fn list_admin_membership_package_groups<'a>(
        &'a self,
        query: ListAdminMembershipPackageGroupsQuery,
    ) -> AdminMembershipFuture<'a, SdkWorkPageData<AdminMembershipPackageGroupItem>>;

    fn create_admin_membership_package_group<'a>(
        &'a self,
        command: CreateAdminMembershipPackageGroupCommand,
    ) -> AdminMembershipFuture<'a, AdminMembershipPackageGroupItem>;

    fn update_admin_membership_package_group<'a>(
        &'a self,
        command: UpdateAdminMembershipPackageGroupCommand,
    ) -> AdminMembershipFuture<'a, AdminMembershipPackageGroupItem>;

    fn delete_admin_membership_package_group<'a>(
        &'a self,
        command: DeleteAdminMembershipPackageGroupCommand,
    ) -> AdminMembershipFuture<'a, bool>;

    fn create_admin_membership_package<'a>(
        &'a self,
        command: CreateAdminMembershipPackageCommand,
    ) -> AdminMembershipFuture<'a, AdminMembershipPackageItem>;

    fn update_admin_membership_package<'a>(
        &'a self,
        command: UpdateAdminMembershipPackageCommand,
    ) -> AdminMembershipFuture<'a, AdminMembershipPackageItem>;

    fn delete_admin_membership_package<'a>(
        &'a self,
        command: DeleteAdminMembershipPackageCommand,
    ) -> AdminMembershipFuture<'a, bool>;

    fn list_admin_membership_members<'a>(
        &'a self,
        query: ListAdminMembershipMembersQuery,
    ) -> AdminMembershipFuture<'a, SdkWorkPageData<AdminMembershipMemberItem>>;

    fn retrieve_admin_membership_member<'a>(
        &'a self,
        query: RetrieveAdminMembershipMemberQuery,
    ) -> AdminMembershipFuture<'a, AdminMembershipMemberItem>;

    fn update_admin_membership_member_status<'a>(
        &'a self,
        command: UpdateAdminMembershipMemberStatusCommand,
    ) -> AdminMembershipFuture<'a, AdminMembershipMemberItem>;

    fn list_admin_membership_entitlements<'a>(
        &'a self,
        query: ListAdminMembershipEntitlementsQuery,
    ) -> AdminMembershipFuture<'a, SdkWorkPageData<AdminMembershipEntitlementItem>>;

    /// Organization (team) subscription read model for admin/ops surfaces.
    ///
    /// Projects membership-owned facts only (`membership_subscription` joined to
    /// `membership_plan` for the plan name); the organization roster and caller
    /// roles stay IAM-owned and are composed by the caller.
    fn list_admin_team_subscriptions<'a>(
        &'a self,
        query: ListAdminTeamSubscriptionsQuery,
    ) -> AdminMembershipFuture<'a, SdkWorkPageData<AdminTeamSubscriptionItem>>;
}
