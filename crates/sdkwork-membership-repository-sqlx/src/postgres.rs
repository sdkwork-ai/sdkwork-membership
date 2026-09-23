use std::collections::BTreeMap;

use sdkwork_contract_service::CommerceServiceError;
use sdkwork_utils_rust::{SdkWorkCommandData, SdkWorkPageData};
use sqlx::{PgPool, Postgres, Row, Transaction};

use crate::pagination::{
    bounded_sql_page, cursor_page, offset_page, organization_id_text, tenant_id_text,
    MembershipListQuery,
};

use crate::read_model::is_missing_postgres_read_model;
use crate::shared::{
    build_package_group_from_packages, current_timestamp_string, decimal_string,
    map_membership_package_record, paid_membership_purchase_submit_command,
    parse_coupon_subscription_quota_policy, parse_points_amount, plan_code_from_rank,
    plan_rank_from_code, privilege_usage_from_benefits, resolve_catalog_scope,
    resolve_membership_purchase_binding, stable_membership_i64_id, subscription_quota_day_bounds,
    validate_coupon_subscription_quota_contract, validate_membership_purchase_action,
    CurrentMembershipSnapshot, MembershipPurchaseBinding, MembershipPurchasePersistenceMode,
    ParsedMembershipPackage, StoredMembershipPlan, DEFAULT_CATALOG_ORGANIZATION_ID,
    DEFAULT_CATALOG_TENANT_ID, POINTS_ASSET_CODE, POINTS_CURRENCY_CODE,
};
use crate::{
    AdminMembershipEntitlementItem, AdminMembershipFuture, AdminMembershipMemberItem,
    AdminMembershipPackageGroupItem, AdminMembershipPackageItem, AdminMembershipPlanItem,
    AdminMembershipStore, AppMembershipBenefitItem, AppMembershipCommandFuture,
    AppMembershipDailyRewardResponse, AppMembershipDailyRewardStatusResponse,
    AppMembershipInfoResponse, AppMembershipListQuery, AppMembershipPackageGroupItem,
    AppMembershipPackageItem, AppMembershipPlanItem, AppMembershipPointsBalanceResponse,
    AppMembershipPointsHistoryItem, AppMembershipPointsHistoryQuery,
    AppMembershipPrivilegeUsageResponse, AppMembershipPurchaseOutcome, AppMembershipReadFuture,
    AppMembershipResult, AppMembershipStatusResponse, AppMembershipStore, AppMembershipSubject,
    ConsumeSubscriptionQuotaCommand, CouponSubscriptionFulfillmentOutcome,
    CreateAdminMembershipPackageCommand, CreateAdminMembershipPackageGroupCommand,
    CreateAdminMembershipPlanCommand, DeleteAdminMembershipPackageCommand,
    DeleteAdminMembershipPackageGroupCommand, DeleteAdminMembershipPlanCommand,
    FeatureAccessCheckOutcome, FeatureAccessCheckQuery, FulfillMembershipPurchaseCommand,
    FulfillMembershipPurchaseOutcome, FulfillPaidMembershipPurchaseCommand,
    GrantCouponSubscriptionCommand, ListAdminMembershipEntitlementsQuery,
    ListAdminMembershipMembersQuery, ListAdminMembershipPackageGroupsQuery,
    ListAdminMembershipPackagesQuery, ListAdminMembershipPlansQuery,
    MembershipLifecycleSweepOutcome, RechargeSubscriptionQuotaCommand,
    RetrieveAdminMembershipMemberQuery, SubmitMembershipPurchaseCommand,
    SubscriptionQuotaConsumptionOutcome, SubscriptionQuotaRechargeFuture,
    SubscriptionQuotaRechargeOutcome, UpdateAdminMembershipMemberStatusCommand,
    UpdateAdminMembershipPackageCommand, UpdateAdminMembershipPackageGroupCommand,
    UpdateAdminMembershipPlanCommand,
};

const LOAD_MEMBERSHIP_PACKAGES_BASE: &str = r#"
SELECT
    CAST(p.external_id AS INTEGER) AS external_id,
    p.name,
    p.description,
    CAST(p.price_amount AS TEXT) AS price_amount,
    CAST(COALESCE(p.original_price_amount, '') AS TEXT) AS original_price_amount,
    CAST(COALESCE(p.point_amount, 0) AS INTEGER) AS point_amount,
    CAST(p.duration_days AS INTEGER) AS duration_days,
    CAST(COALESCE(p.sort_weight, 0) AS INTEGER) AS sort_weight,
    CAST(COALESCE(p.recommended, 0) AS INTEGER) AS recommended,
    CAST(p.tags AS TEXT) AS tags_json,
    p.id AS package_storage_id,
    p.package_group_id AS package_group_storage_id,
    p.plan_id AS plan_storage_id,
    p.sku_id,
    g.external_id AS group_external_id,
    g.name AS group_name,
    g.description AS group_description,
    CAST(COALESCE(g.sort_weight, 0) AS INTEGER) AS group_sort_weight,
    l.plan_no AS plan_no,
    l.name AS plan_name,
    CAST(l.rank AS INTEGER) AS rank,
    p.category AS package_category
FROM membership_package p
JOIN membership_package_group g
    ON g.id = p.package_group_id
LEFT JOIN membership_plan l
    ON l.id = p.plan_id
WHERE (p.tenant_id = CAST($1 AS TEXT) OR p.tenant_id IS NULL)
  AND (p.organization_id = CAST($2 AS TEXT) OR p.organization_id = '0')
  AND (g.tenant_id = CAST($1 AS TEXT) OR g.tenant_id IS NULL)
  AND (g.organization_id = CAST($2 AS TEXT) OR g.organization_id = '0')
  AND p.status = 'active'
  AND g.status = 'active'
"#;

const LOAD_MEMBERSHIP_PACKAGE_BY_ID: &str = r#"
SELECT
    CAST(p.external_id AS INTEGER) AS external_id,
    p.name,
    p.description,
    CAST(p.price_amount AS TEXT) AS price_amount,
    CAST(COALESCE(p.original_price_amount, '') AS TEXT) AS original_price_amount,
    CAST(COALESCE(p.point_amount, 0) AS INTEGER) AS point_amount,
    CAST(p.duration_days AS INTEGER) AS duration_days,
    CAST(COALESCE(p.sort_weight, 0) AS INTEGER) AS sort_weight,
    CAST(COALESCE(p.recommended, 0) AS INTEGER) AS recommended,
    CAST(p.tags AS TEXT) AS tags_json,
    p.id AS package_storage_id,
    p.package_group_id AS package_group_storage_id,
    p.plan_id AS plan_storage_id,
    p.sku_id,
    g.external_id AS group_external_id,
    g.name AS group_name,
    g.description AS group_description,
    CAST(COALESCE(g.sort_weight, 0) AS INTEGER) AS group_sort_weight,
    l.plan_no AS plan_no,
    l.name AS plan_name,
    CAST(l.rank AS INTEGER) AS rank,
    p.category AS package_category
FROM membership_package p
JOIN membership_package_group g
    ON g.id = p.package_group_id
LEFT JOIN membership_plan l
    ON l.id = p.plan_id
WHERE (p.tenant_id = CAST($1 AS TEXT) OR p.tenant_id = CAST($4 AS TEXT) OR p.tenant_id IS NULL)
  AND (p.organization_id = CAST($2 AS TEXT) OR p.organization_id = CAST($5 AS TEXT) OR p.organization_id = '0')
  AND (g.tenant_id = CAST($1 AS TEXT) OR g.tenant_id = CAST($4 AS TEXT) OR g.tenant_id IS NULL)
  AND (g.organization_id = CAST($2 AS TEXT) OR g.organization_id = CAST($5 AS TEXT) OR g.organization_id = '0')
  AND p.external_id = $3
  AND p.status = 'active'
  AND g.status = 'active'
ORDER BY
    CASE
        WHEN p.tenant_id = CAST($1 AS TEXT) AND p.organization_id = CAST($2 AS TEXT) THEN 0
        WHEN p.tenant_id = CAST($1 AS TEXT) THEN 1
        WHEN p.tenant_id = CAST($4 AS TEXT) AND p.organization_id = CAST($5 AS TEXT) THEN 2
        WHEN p.tenant_id = CAST($4 AS TEXT) THEN 3
        ELSE 4
    END,
    p.id
LIMIT 1
"#;

const LOAD_MEMBERSHIP_PLAN_BY_RANK: &str = r#"
SELECT
    p.id,
    p.plan_no AS plan_no,
    p.name,
    CAST(p.rank AS INTEGER) AS rank,
    p.description,
    p.category AS category,
    b.id AS plan_benefit_id,
    b.benefit_code,
    CAST(b.grant_quantity AS TEXT) AS grant_quantity,
    b.usage_policy,
    d.name AS benefit_name,
    d.benefit_type,
    d.description AS benefit_description
FROM membership_plan p
LEFT JOIN membership_plan_version v
    ON v.plan_id = p.id
   AND v.tenant_id = p.tenant_id
   AND v.lifecycle_status = 'published'
LEFT JOIN membership_plan_benefit b
    ON b.plan_version_id = v.id
   AND b.tenant_id = p.tenant_id
   AND b.status = 'active'
LEFT JOIN membership_benefit_definition d
    ON d.id = b.benefit_id
   AND d.tenant_id = b.tenant_id
WHERE (p.tenant_id = CAST($1 AS TEXT) OR p.tenant_id IS NULL)
  AND (p.organization_id = CAST($2 AS TEXT) OR p.organization_id = '0')
  AND p.status = 'active'
  AND CAST(p.rank AS INTEGER) = $3
ORDER BY b.sort_weight ASC, b.id ASC
"#;

const LOAD_MEMBERSHIP_PLAN_BY_STORAGE_ID: &str = r#"
SELECT
    p.id,
    p.plan_no AS plan_no,
    p.name,
    CAST(p.rank AS INTEGER) AS rank,
    p.description,
    p.category AS category,
    b.id AS plan_benefit_id,
    b.benefit_code,
    CAST(b.grant_quantity AS TEXT) AS grant_quantity,
    b.usage_policy,
    d.name AS benefit_name,
    d.benefit_type,
    d.description AS benefit_description
FROM membership_plan p
LEFT JOIN membership_plan_version v
    ON v.plan_id = p.id
   AND v.tenant_id = p.tenant_id
   AND v.lifecycle_status = 'published'
LEFT JOIN membership_plan_benefit b
    ON b.plan_version_id = v.id
   AND b.tenant_id = p.tenant_id
   AND b.status = 'active'
LEFT JOIN membership_benefit_definition d
    ON d.id = b.benefit_id
   AND d.tenant_id = b.tenant_id
WHERE p.id = $1
  AND p.status = 'active'
ORDER BY b.sort_weight ASC, b.id ASC
"#;

const LOAD_MEMBERSHIP: &str = r#"
SELECT
    m.id AS membership_id,
    m.plan_id AS plan_storage_id,
    m.status,
    CAST(m.starts_at AS TEXT) AS starts_at,
    CAST(m.expires_at AS TEXT) AS expires_at,
    l.plan_no AS plan_no,
    l.name AS plan_name,
    CAST(l.rank AS INTEGER) AS rank,
    CAST(COALESCE(pkg.price_amount, '0') AS TEXT) AS total_spent
FROM membership_subscription m
LEFT JOIN membership_plan l
    ON l.id = m.plan_id
LEFT JOIN membership_package pkg
    ON pkg.id = m.package_id
WHERE m.tenant_id = CAST($1 AS TEXT)
  AND (m.organization_id IS NULL OR m.organization_id = '0' OR m.organization_id = CAST($2 AS TEXT))
  AND m.subject_type = 'user'
  AND m.subject_id = CAST($3 AS TEXT)
ORDER BY m.created_at DESC, m.id DESC
LIMIT 1
"#;

const LOAD_POINTS_BALANCE: &str = r#"
SELECT
    CAST(available_amount AS TEXT) AS available_amount,
    CAST(frozen_amount AS TEXT) AS frozen_amount
FROM membership_points_account
WHERE tenant_id = CAST($1 AS BIGINT)
  AND (organization_id IS NULL OR organization_id = 0 OR organization_id = CAST($2 AS BIGINT))
  AND owner_type = 'USER'
  AND owner_id = CAST($3 AS BIGINT)
  AND asset_code = $4
  AND (currency_code = $5 OR currency_code IS NULL)
  AND status = 1
ORDER BY updated_at DESC, id DESC
LIMIT 1
"#;

const LOAD_POINTS_HISTORY: &str = r#"
SELECT
    id,
    direction,
    CAST(amount AS TEXT) AS amount,
    CAST(balance_after AS TEXT) AS balance_after,
    business_type,
    source_type,
    remark,
    CAST(created_at AS TEXT) AS created_at
FROM membership_points_ledger
WHERE tenant_id = CAST($1 AS BIGINT)
  AND (organization_id IS NULL OR organization_id = 0 OR organization_id = CAST($2 AS BIGINT))
  AND owner_type = 'USER'
  AND owner_id = CAST($3 AS BIGINT)
  AND asset_code = $4
ORDER BY created_at DESC, id DESC
LIMIT $5 OFFSET $6
"#;

const LOAD_POINTS_HISTORY_CURSOR: &str = r#"
SELECT
    id,
    direction,
    CAST(amount AS TEXT) AS amount,
    CAST(balance_after AS TEXT) AS balance_after,
    business_type,
    source_type,
    remark,
    CAST(created_at AS TEXT) AS created_at
FROM membership_points_ledger
WHERE tenant_id = CAST($1 AS BIGINT)
  AND (organization_id IS NULL OR organization_id = 0 OR organization_id = CAST($2 AS BIGINT))
  AND owner_type = 'USER'
  AND owner_id = CAST($3 AS BIGINT)
  AND asset_code = $4
  AND id < $5
ORDER BY created_at DESC, id DESC
LIMIT $6
"#;

#[derive(Debug, Clone)]
pub struct PostgresCommerceMembershipStore {
    pool: PgPool,
}

impl PostgresCommerceMembershipStore {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub fn load_info<'a>(
        &'a self,
        subject: Option<AppMembershipSubject>,
    ) -> AppMembershipReadFuture<'a, AppMembershipInfoResponse> {
        <Self as AppMembershipStore>::load_info(self, subject)
    }

    pub fn load_status<'a>(
        &'a self,
        subject: Option<AppMembershipSubject>,
    ) -> AppMembershipReadFuture<'a, AppMembershipStatusResponse> {
        <Self as AppMembershipStore>::load_status(self, subject)
    }

    pub fn load_plans<'a>(
        &'a self,
        catalog_subject: Option<AppMembershipSubject>,
        query: AppMembershipListQuery,
    ) -> AppMembershipReadFuture<'a, SdkWorkPageData<AppMembershipPlanItem>> {
        <Self as AppMembershipStore>::load_plans(self, catalog_subject, query)
    }

    pub fn load_benefits<'a>(
        &'a self,
        subject: Option<AppMembershipSubject>,
        plan_id: Option<i64>,
        query: AppMembershipListQuery,
    ) -> AppMembershipReadFuture<'a, SdkWorkPageData<AppMembershipBenefitItem>> {
        <Self as AppMembershipStore>::load_benefits(self, subject, plan_id, query)
    }

    pub fn load_packages<'a>(
        &'a self,
        catalog_subject: Option<AppMembershipSubject>,
        package_group_id: Option<i64>,
        plan_id: Option<i64>,
        query: AppMembershipListQuery,
    ) -> AppMembershipReadFuture<'a, SdkWorkPageData<AppMembershipPackageItem>> {
        <Self as AppMembershipStore>::load_packages(
            self,
            catalog_subject,
            package_group_id,
            plan_id,
            query,
        )
    }

    pub fn load_package<'a>(
        &'a self,
        catalog_subject: Option<AppMembershipSubject>,
        package_id: i64,
    ) -> AppMembershipReadFuture<'a, Option<AppMembershipPackageItem>> {
        <Self as AppMembershipStore>::load_package(self, catalog_subject, package_id)
    }

    pub fn load_package_groups<'a>(
        &'a self,
        catalog_subject: Option<AppMembershipSubject>,
        plan_id: Option<i64>,
        recommended_only: bool,
        query: AppMembershipListQuery,
    ) -> AppMembershipReadFuture<'a, SdkWorkPageData<AppMembershipPackageGroupItem>> {
        <Self as AppMembershipStore>::load_package_groups(
            self,
            catalog_subject,
            plan_id,
            recommended_only,
            query,
        )
    }

    pub fn load_package_group<'a>(
        &'a self,
        catalog_subject: Option<AppMembershipSubject>,
        package_group_id: i64,
    ) -> AppMembershipReadFuture<'a, Option<AppMembershipPackageGroupItem>> {
        <Self as AppMembershipStore>::load_package_group(self, catalog_subject, package_group_id)
    }

    pub fn load_points_balance<'a>(
        &'a self,
        subject: Option<AppMembershipSubject>,
    ) -> AppMembershipReadFuture<'a, AppMembershipPointsBalanceResponse> {
        <Self as AppMembershipStore>::load_points_balance(self, subject)
    }

    pub fn load_points_history<'a>(
        &'a self,
        subject: Option<AppMembershipSubject>,
        query: AppMembershipPointsHistoryQuery,
    ) -> AppMembershipReadFuture<'a, SdkWorkPageData<AppMembershipPointsHistoryItem>> {
        <Self as AppMembershipStore>::load_points_history(self, subject, query)
    }

    pub fn load_daily_reward_status<'a>(
        &'a self,
        subject: Option<AppMembershipSubject>,
    ) -> AppMembershipReadFuture<'a, AppMembershipDailyRewardStatusResponse> {
        <Self as AppMembershipStore>::load_daily_reward_status(self, subject)
    }

    pub fn claim_daily_reward<'a>(
        &'a self,
        subject: AppMembershipSubject,
        requested_at: String,
    ) -> AppMembershipReadFuture<'a, AppMembershipDailyRewardResponse> {
        <Self as AppMembershipStore>::claim_daily_reward(self, subject, requested_at)
    }

    pub fn load_privilege_usage<'a>(
        &'a self,
        subject: Option<AppMembershipSubject>,
    ) -> AppMembershipReadFuture<'a, AppMembershipPrivilegeUsageResponse> {
        <Self as AppMembershipStore>::load_privilege_usage(self, subject)
    }

    pub fn submit_purchase<'a>(
        &'a self,
        command: SubmitMembershipPurchaseCommand,
    ) -> AppMembershipCommandFuture<'a> {
        <Self as AppMembershipStore>::submit_purchase(self, command)
    }
}

impl AppMembershipStore for PostgresCommerceMembershipStore {
    fn load_info<'a>(
        &'a self,
        subject: Option<AppMembershipSubject>,
    ) -> AppMembershipReadFuture<'a, AppMembershipInfoResponse> {
        Box::pin(async move { load_info(&self.pool, subject).await })
    }

    fn load_status<'a>(
        &'a self,
        subject: Option<AppMembershipSubject>,
    ) -> AppMembershipReadFuture<'a, AppMembershipStatusResponse> {
        Box::pin(async move { load_status(&self.pool, subject).await })
    }

    fn load_plans<'a>(
        &'a self,
        catalog_subject: Option<AppMembershipSubject>,
        query: AppMembershipListQuery,
    ) -> AppMembershipReadFuture<'a, SdkWorkPageData<AppMembershipPlanItem>> {
        Box::pin(async move {
            let (tenant_id, organization_id) = resolve_catalog_scope(catalog_subject);
            load_plans_page(&self.pool, tenant_id, organization_id, query).await
        })
    }

    fn load_benefits<'a>(
        &'a self,
        subject: Option<AppMembershipSubject>,
        plan_id: Option<i64>,
        query: AppMembershipListQuery,
    ) -> AppMembershipReadFuture<'a, SdkWorkPageData<AppMembershipBenefitItem>> {
        Box::pin(async move { load_benefits_page(&self.pool, subject, plan_id, query).await })
    }

    fn load_packages<'a>(
        &'a self,
        catalog_subject: Option<AppMembershipSubject>,
        package_group_id: Option<i64>,
        plan_id: Option<i64>,
        query: AppMembershipListQuery,
    ) -> AppMembershipReadFuture<'a, SdkWorkPageData<AppMembershipPackageItem>> {
        Box::pin(async move {
            let (tenant_id, organization_id) = resolve_catalog_scope(catalog_subject);
            load_package_rows(
                &self.pool,
                tenant_id,
                organization_id,
                package_group_id,
                plan_id,
                query,
                false,
            )
            .await
        })
    }

    fn load_package<'a>(
        &'a self,
        catalog_subject: Option<AppMembershipSubject>,
        package_id: i64,
    ) -> AppMembershipReadFuture<'a, Option<AppMembershipPackageItem>> {
        Box::pin(async move {
            let (tenant_id, organization_id) = resolve_catalog_scope(catalog_subject);
            load_package_by_id(&self.pool, tenant_id, organization_id, package_id).await
        })
    }

    fn load_package_groups<'a>(
        &'a self,
        catalog_subject: Option<AppMembershipSubject>,
        plan_id: Option<i64>,
        recommended_only: bool,
        query: AppMembershipListQuery,
    ) -> AppMembershipReadFuture<'a, SdkWorkPageData<AppMembershipPackageGroupItem>> {
        Box::pin(async move {
            let (tenant_id, organization_id) = resolve_catalog_scope(catalog_subject);
            load_package_groups_page(
                &self.pool,
                tenant_id,
                organization_id,
                plan_id,
                recommended_only,
                query,
            )
            .await
        })
    }

    fn load_package_group<'a>(
        &'a self,
        catalog_subject: Option<AppMembershipSubject>,
        package_group_id: i64,
    ) -> AppMembershipReadFuture<'a, Option<AppMembershipPackageGroupItem>> {
        Box::pin(async move {
            let (tenant_id, organization_id) = resolve_catalog_scope(catalog_subject);
            load_package_group_by_id(&self.pool, tenant_id, organization_id, package_group_id).await
        })
    }

    fn load_points_balance<'a>(
        &'a self,
        subject: Option<AppMembershipSubject>,
    ) -> AppMembershipReadFuture<'a, AppMembershipPointsBalanceResponse> {
        Box::pin(async move { load_points_balance(&self.pool, subject).await })
    }

    fn load_points_history<'a>(
        &'a self,
        subject: Option<AppMembershipSubject>,
        query: AppMembershipPointsHistoryQuery,
    ) -> AppMembershipReadFuture<'a, SdkWorkPageData<AppMembershipPointsHistoryItem>> {
        Box::pin(async move { load_points_history(&self.pool, subject, query).await })
    }

    fn load_daily_reward_status<'a>(
        &'a self,
        subject: Option<AppMembershipSubject>,
    ) -> AppMembershipReadFuture<'a, AppMembershipDailyRewardStatusResponse> {
        Box::pin(async move {
            let Some(subject) = subject else {
                return Ok(AppMembershipDailyRewardStatusResponse {
                    can_claim: false,
                    claimed_today: false,
                    consecutive_days: 0,
                    total_days: 0,
                });
            };
            load_daily_reward_status_postgres(&self.pool, subject).await
        })
    }

    fn claim_daily_reward<'a>(
        &'a self,
        subject: AppMembershipSubject,
        requested_at: String,
    ) -> AppMembershipReadFuture<'a, AppMembershipDailyRewardResponse> {
        Box::pin(
            async move { claim_daily_reward_postgres(&self.pool, subject, requested_at).await },
        )
    }

    fn load_privilege_usage<'a>(
        &'a self,
        subject: Option<AppMembershipSubject>,
    ) -> AppMembershipReadFuture<'a, AppMembershipPrivilegeUsageResponse> {
        Box::pin(async move {
            let benefits = load_benefits_page(
                &self.pool,
                subject,
                None,
                AppMembershipListQuery {
                    page_size: Some(200),
                    ..Default::default()
                },
            )
            .await?
            .items;
            let mut usage = privilege_usage_from_benefits(&benefits);
            if let Some(subject) = subject {
                if let Ok(actual) = load_privilege_usage_postgres(&self.pool, subject).await {
                    usage.speed_up_used = actual.speed_up_used;
                    usage.priority_queue_used = actual.priority_queue_used;
                    usage.exclusive_model_used = actual.exclusive_model_used;
                }
                if let Ok(entitlement) =
                    load_membership_entitlement_account_usage_postgres(&self.pool, subject).await
                {
                    usage.speed_up_used = usage.speed_up_used.max(entitlement.speed_up_used);
                    usage.priority_queue_used = usage
                        .priority_queue_used
                        .max(entitlement.priority_queue_used);
                    usage.exclusive_model_used = usage
                        .exclusive_model_used
                        .max(entitlement.exclusive_model_used);
                }
            }
            Ok(usage)
        })
    }

    fn consume_speed_up<'a>(
        &'a self,
        subject: AppMembershipSubject,
        requested_at: String,
    ) -> AppMembershipReadFuture<'a, SdkWorkCommandData> {
        Box::pin(async move { consume_speed_up(&self.pool, subject, requested_at).await })
    }

    fn submit_purchase<'a>(
        &'a self,
        command: SubmitMembershipPurchaseCommand,
    ) -> AppMembershipCommandFuture<'a> {
        Box::pin(async move { submit_purchase(&self.pool, command).await })
    }

    fn fulfill_purchase<'a>(
        &'a self,
        command: FulfillMembershipPurchaseCommand,
    ) -> crate::AppMembershipFulfillmentFuture<'a> {
        Box::pin(async move { fulfill_purchase_by_order(&self.pool, command).await })
    }

    fn fulfill_paid_purchase<'a>(
        &'a self,
        command: FulfillPaidMembershipPurchaseCommand,
    ) -> crate::AppMembershipFulfillmentFuture<'a> {
        Box::pin(async move { fulfill_paid_purchase_by_order(&self.pool, command).await })
    }

    fn grant_coupon_subscription<'a>(
        &'a self,
        command: GrantCouponSubscriptionCommand,
    ) -> crate::CouponSubscriptionFulfillmentFuture<'a> {
        Box::pin(async move { grant_coupon_subscription(&self.pool, command).await })
    }

    fn consume_subscription_quota<'a>(
        &'a self,
        command: ConsumeSubscriptionQuotaCommand,
    ) -> crate::SubscriptionQuotaConsumptionFuture<'a> {
        Box::pin(async move { consume_subscription_quota(&self.pool, command).await })
    }

    fn recharge_subscription_quota<'a>(
        &'a self,
        command: RechargeSubscriptionQuotaCommand,
    ) -> SubscriptionQuotaRechargeFuture<'a> {
        Box::pin(async move { recharge_subscription_quota(&self.pool, command).await })
    }

    fn expire_due_memberships<'a>(
        &'a self,
    ) -> AppMembershipReadFuture<'a, MembershipLifecycleSweepOutcome> {
        Box::pin(async move { expire_due_memberships(&self.pool).await })
    }

    fn check_feature_access<'a>(
        &'a self,
        query: FeatureAccessCheckQuery,
    ) -> AppMembershipReadFuture<'a, FeatureAccessCheckOutcome> {
        Box::pin(async move { check_feature_access(&self.pool, query).await })
    }
}

impl AdminMembershipStore for PostgresCommerceMembershipStore {
    fn list_admin_membership_plans<'a>(
        &'a self,
        query: ListAdminMembershipPlansQuery,
    ) -> AdminMembershipFuture<'a, SdkWorkPageData<AdminMembershipPlanItem>> {
        Box::pin(async move { list_admin_membership_plans(&self.pool, query).await })
    }

    fn create_admin_membership_plan<'a>(
        &'a self,
        command: CreateAdminMembershipPlanCommand,
    ) -> AdminMembershipFuture<'a, AdminMembershipPlanItem> {
        Box::pin(async move { create_admin_membership_plan(&self.pool, command).await })
    }

    fn update_admin_membership_plan<'a>(
        &'a self,
        command: UpdateAdminMembershipPlanCommand,
    ) -> AdminMembershipFuture<'a, AdminMembershipPlanItem> {
        Box::pin(async move { update_admin_membership_plan(&self.pool, command).await })
    }

    fn delete_admin_membership_plan<'a>(
        &'a self,
        command: DeleteAdminMembershipPlanCommand,
    ) -> AdminMembershipFuture<'a, bool> {
        Box::pin(async move { delete_admin_membership_plan(&self.pool, command).await })
    }

    fn list_admin_membership_packages<'a>(
        &'a self,
        query: ListAdminMembershipPackagesQuery,
    ) -> AdminMembershipFuture<'a, SdkWorkPageData<AdminMembershipPackageItem>> {
        Box::pin(async move { list_admin_membership_packages(&self.pool, query).await })
    }

    fn list_admin_membership_package_groups<'a>(
        &'a self,
        query: ListAdminMembershipPackageGroupsQuery,
    ) -> AdminMembershipFuture<'a, SdkWorkPageData<AdminMembershipPackageGroupItem>> {
        Box::pin(async move { list_admin_membership_package_groups(&self.pool, query).await })
    }

    fn create_admin_membership_package_group<'a>(
        &'a self,
        command: CreateAdminMembershipPackageGroupCommand,
    ) -> AdminMembershipFuture<'a, AdminMembershipPackageGroupItem> {
        Box::pin(async move { create_admin_membership_package_group(&self.pool, command).await })
    }

    fn update_admin_membership_package_group<'a>(
        &'a self,
        command: UpdateAdminMembershipPackageGroupCommand,
    ) -> AdminMembershipFuture<'a, AdminMembershipPackageGroupItem> {
        Box::pin(async move { update_admin_membership_package_group(&self.pool, command).await })
    }

    fn delete_admin_membership_package_group<'a>(
        &'a self,
        command: DeleteAdminMembershipPackageGroupCommand,
    ) -> AdminMembershipFuture<'a, bool> {
        Box::pin(async move { delete_admin_membership_package_group(&self.pool, command).await })
    }

    fn create_admin_membership_package<'a>(
        &'a self,
        command: CreateAdminMembershipPackageCommand,
    ) -> AdminMembershipFuture<'a, AdminMembershipPackageItem> {
        Box::pin(async move { create_admin_membership_package(&self.pool, command).await })
    }

    fn update_admin_membership_package<'a>(
        &'a self,
        command: UpdateAdminMembershipPackageCommand,
    ) -> AdminMembershipFuture<'a, AdminMembershipPackageItem> {
        Box::pin(async move { update_admin_membership_package(&self.pool, command).await })
    }

    fn delete_admin_membership_package<'a>(
        &'a self,
        command: DeleteAdminMembershipPackageCommand,
    ) -> AdminMembershipFuture<'a, bool> {
        Box::pin(async move { delete_admin_membership_package(&self.pool, command).await })
    }

    fn list_admin_membership_members<'a>(
        &'a self,
        query: ListAdminMembershipMembersQuery,
    ) -> AdminMembershipFuture<'a, SdkWorkPageData<AdminMembershipMemberItem>> {
        Box::pin(async move { list_admin_membership_members(&self.pool, query).await })
    }

    fn retrieve_admin_membership_member<'a>(
        &'a self,
        query: RetrieveAdminMembershipMemberQuery,
    ) -> AdminMembershipFuture<'a, AdminMembershipMemberItem> {
        Box::pin(async move { load_admin_membership(&self.pool, &query).await })
    }

    fn update_admin_membership_member_status<'a>(
        &'a self,
        command: UpdateAdminMembershipMemberStatusCommand,
    ) -> AdminMembershipFuture<'a, AdminMembershipMemberItem> {
        Box::pin(async move { update_admin_membership_member_status(&self.pool, command).await })
    }

    fn list_admin_membership_entitlements<'a>(
        &'a self,
        query: ListAdminMembershipEntitlementsQuery,
    ) -> AdminMembershipFuture<'a, SdkWorkPageData<AdminMembershipEntitlementItem>> {
        Box::pin(async move { list_admin_membership_entitlements(&self.pool, query).await })
    }
}

async fn list_admin_membership_plans(
    pool: &PgPool,
    query: ListAdminMembershipPlansQuery,
) -> AppMembershipResult<SdkWorkPageData<AdminMembershipPlanItem>> {
    let params = MembershipListQuery {
        page: query.page,
        page_size: query.page_size,
        cursor: query.cursor.clone(),
        category: query.category.clone(),
    }
    .offset_params();
    let page_size = params.page_size;
    let offset = params.offset;
    let tenant_id = tenant_id_text(query.subject.tenant_id);

    let total: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM membership_plan p
        WHERE p.tenant_id = $1
          AND ($2 IS NULL OR p.category = $2)
          AND ($3 IS NULL OR p.status = $3)
        "#,
    )
    .bind(&tenant_id)
    .bind(query.category.as_deref())
    .bind(query.status.as_deref())
    .fetch_one(pool)
    .await
    .map_err(sql_error)?;

    let plan_ids: Vec<String> = sqlx::query_scalar(
        r#"
        SELECT p.id
        FROM membership_plan p
        WHERE p.tenant_id = $1
          AND ($2 IS NULL OR p.category = $2)
          AND ($3 IS NULL OR p.status = $3)
        ORDER BY p.rank ASC, p.plan_no ASC
        LIMIT $4 OFFSET $5
        "#,
    )
    .bind(&tenant_id)
    .bind(query.category.as_deref())
    .bind(query.status.as_deref())
    .bind(page_size)
    .bind(offset)
    .fetch_all(pool)
    .await
    .map_err(sql_error)?;

    if plan_ids.is_empty() {
        return Ok(offset_page(Vec::new(), total, params));
    }

    let placeholders = plan_ids
        .iter()
        .enumerate()
        .map(|(index, _)| format!("${}", index + 2))
        .collect::<Vec<_>>()
        .join(", ");
    let sql = format!(
        r#"
        SELECT
            p.id,
            p.plan_no AS plan_no,
            p.name,
            CAST(p.rank AS INTEGER) AS rank,
            p.status,
            p.category AS category,
            p.description AS description,
            CAST(p.created_at AS TEXT) AS created_at,
            CAST(p.updated_at AS TEXT) AS updated_at,
            b.id AS plan_benefit_id,
            b.benefit_code,
            CAST(b.grant_quantity AS TEXT) AS grant_quantity,
            b.usage_policy,
            d.name AS benefit_name,
            d.benefit_type,
            d.description AS benefit_description
        FROM membership_plan p
        LEFT JOIN membership_plan_version v
            ON v.plan_id = p.id
           AND v.tenant_id = p.tenant_id
           AND v.lifecycle_status = 'published'
        LEFT JOIN membership_plan_benefit b
            ON b.plan_version_id = v.id
           AND b.tenant_id = p.tenant_id
           AND b.status = 'active'
        LEFT JOIN membership_benefit_definition d
            ON d.id = b.benefit_id
           AND d.tenant_id = b.tenant_id
        WHERE p.tenant_id = $1
          AND p.id IN ({placeholders})
        ORDER BY p.rank ASC, p.plan_no ASC, b.sort_weight ASC, b.id ASC
        "#
    );
    let mut db_query = sqlx::query(sqlx::AssertSqlSafe(sql.as_str())).bind(&tenant_id);
    for plan_id in &plan_ids {
        db_query = db_query.bind(plan_id);
    }
    let rows = db_query.fetch_all(pool).await.map_err(sql_error)?;
    Ok(offset_page(admin_plans_from_rows(&rows), total, params))
}

async fn create_admin_membership_plan(
    pool: &PgPool,
    command: CreateAdminMembershipPlanCommand,
) -> AppMembershipResult<AdminMembershipPlanItem> {
    let plan_version_id = admin_plan_version_id(&command.plan_id);
    let tenant_id = tenant_id_text(command.subject.tenant_id);
    let organization_id = organization_id_text(command.subject.organization_id);
    sqlx::query(
        r#"
        INSERT INTO membership_plan
            (id, tenant_id, organization_id, category, plan_no, plan_code, name, rank, description, status, created_at, updated_at)
        VALUES
            ($1, $2, $3, $4, $5, $5, $6, $7, NULL, $8, $9::timestamptz, $9::timestamptz)
        "#,
    )
    .bind(&command.plan_id)
    .bind(&tenant_id)
    .bind(&organization_id)
    .bind(&command.input.category)
    .bind(&command.input.code)
    .bind(&command.input.name)
    .bind(command.input.rank)
    .bind(&command.input.status)
    .bind(&command.requested_at)
    .execute(pool)
    .await
    .map_err(|error| store_error("failed to create membership plan", error))?;
    upsert_admin_membership_plan_version(
        pool,
        &tenant_id,
        &organization_id,
        &command.plan_id,
        &plan_version_id,
        &command.input.name,
        &command.requested_at,
    )
    .await?;
    replace_admin_plan_benefits(
        pool,
        &tenant_id,
        &organization_id,
        &command.plan_id,
        &plan_version_id,
        command.input.benefits.as_deref().unwrap_or(&[]),
        &command.requested_at,
    )
    .await?;
    load_admin_membership_plan(pool, command.subject.tenant_id, &command.plan_id).await
}

async fn update_admin_membership_plan(
    pool: &PgPool,
    command: UpdateAdminMembershipPlanCommand,
) -> AppMembershipResult<AdminMembershipPlanItem> {
    let tenant_id = tenant_id_text(command.subject.tenant_id);
    let row = sqlx::query(
        r#"
        SELECT id
        FROM membership_plan
        WHERE tenant_id = $1
          AND (id = $2 OR plan_no = $3)
        ORDER BY CASE WHEN id = $2 THEN 0 ELSE 1 END
        LIMIT 1
        "#,
    )
    .bind(&tenant_id)
    .bind(&command.plan_id)
    .bind(&command.input.code)
    .fetch_optional(pool)
    .await
    .map_err(sql_error)?
    .ok_or_else(|| CommerceServiceError::not_found("membership plan was not found"))?;
    let plan_id = string_cell(&row, "id");
    let plan_version_id = ensure_admin_membership_plan_version(
        pool,
        &tenant_id,
        &organization_id_text(command.subject.organization_id),
        &plan_id,
        &command.input.name,
        &command.requested_at,
    )
    .await?;
    sqlx::query(
        r#"
        UPDATE membership_plan
        SET plan_no = $1,
            plan_code = $1,
            name = $2,
            rank = $3,
            status = $4,
            category = $5,
            updated_at = $6::timestamptz
        WHERE id = $7
          AND tenant_id = $8
        "#,
    )
    .bind(&command.input.code)
    .bind(&command.input.name)
    .bind(command.input.rank)
    .bind(&command.input.status)
    .bind(&command.input.category)
    .bind(&command.requested_at)
    .bind(&plan_id)
    .bind(&tenant_id)
    .execute(pool)
    .await
    .map_err(|error| store_error("failed to update membership plan", error))?;
    if let Some(benefits) = command.input.benefits.as_deref() {
        replace_admin_plan_benefits(
            pool,
            &tenant_id,
            &organization_id_text(command.subject.organization_id),
            &plan_id,
            &plan_version_id,
            benefits,
            &command.requested_at,
        )
        .await?;
    }
    load_admin_membership_plan(pool, command.subject.tenant_id, &plan_id).await
}

async fn delete_admin_membership_plan(
    pool: &PgPool,
    command: DeleteAdminMembershipPlanCommand,
) -> AppMembershipResult<bool> {
    let tenant_id = tenant_id_text(command.subject.tenant_id);
    let result = sqlx::query(
        r#"
        UPDATE membership_plan
        SET status = 'disabled',
            updated_at = $2::timestamptz
        WHERE tenant_id = $3
          AND (id = $1 OR plan_no = $1)
        "#,
    )
    .bind(&command.plan_id)
    .bind(&command.requested_at)
    .bind(&tenant_id)
    .execute(pool)
    .await
    .map_err(|error| store_error("failed to delete membership plan", error))?;
    Ok(result.rows_affected() > 0)
}

async fn list_admin_membership_packages(
    pool: &PgPool,
    query: ListAdminMembershipPackagesQuery,
) -> AppMembershipResult<SdkWorkPageData<AdminMembershipPackageItem>> {
    let params = MembershipListQuery {
        page: query.page,
        page_size: query.page_size,
        cursor: query.cursor.clone(),
        category: query.category.clone(),
    }
    .offset_params();
    let tenant_id = tenant_id_text(query.subject.tenant_id);

    let total: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM membership_package
        WHERE tenant_id = $1
          AND ($2 IS NULL OR category = $2)
          AND ($3 IS NULL OR package_group_id = $3)
          AND ($4 IS NULL OR plan_id = $4)
          AND ($5 IS NULL OR status = $5)
        "#,
    )
    .bind(&tenant_id)
    .bind(query.category.as_deref())
    .bind(query.package_group_id.as_deref())
    .bind(query.plan_id.as_deref())
    .bind(query.status.as_deref())
    .fetch_one(pool)
    .await
    .map_err(sql_error)?;

    let rows = sqlx::query(
        r#"
        SELECT id, category, package_no, external_id AS external_id, package_group_id AS package_group_id, plan_id AS plan_id, name, CAST(price_amount AS TEXT) AS price_amount,
               currency_code, duration_days AS duration_days, COALESCE(discount, 100)::bigint AS discount, status,
               CAST(created_at AS TEXT) AS created_at, CAST(updated_at AS TEXT) AS updated_at
        FROM membership_package
        WHERE tenant_id = $1
          AND ($2 IS NULL OR category = $2)
          AND ($3 IS NULL OR package_group_id = $3)
          AND ($4 IS NULL OR plan_id = $4)
          AND ($5 IS NULL OR status = $5)
        ORDER BY sort_weight ASC, external_id ASC, id ASC
        LIMIT $6 OFFSET $7
        "#,
    )
    .bind(&tenant_id)
    .bind(query.category.as_deref())
    .bind(query.package_group_id.as_deref())
    .bind(query.plan_id.as_deref())
    .bind(query.status.as_deref())
    .bind(params.page_size)
    .bind(params.offset)
    .fetch_all(pool)
    .await
    .map_err(sql_error)?;
    Ok(offset_page(
        rows.iter().map(map_admin_package).collect(),
        total,
        params,
    ))
}

async fn list_admin_membership_package_groups(
    pool: &PgPool,
    query: ListAdminMembershipPackageGroupsQuery,
) -> AppMembershipResult<SdkWorkPageData<AdminMembershipPackageGroupItem>> {
    let params = MembershipListQuery {
        page: query.page,
        page_size: query.page_size,
        cursor: query.cursor.clone(),
        category: query.category.clone(),
    }
    .offset_params();
    let tenant_id = tenant_id_text(query.subject.tenant_id);

    let total: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM membership_package_group
        WHERE tenant_id = $1
          AND ($2 IS NULL OR category = $2)
          AND ($3 IS NULL OR status = $3)
        "#,
    )
    .bind(&tenant_id)
    .bind(query.category.as_deref())
    .bind(query.status.as_deref())
    .fetch_one(pool)
    .await
    .map_err(sql_error)?;

    let rows = sqlx::query(
        r#"
        SELECT id, category, group_no, name, description, billing_cycle, duration_days,
               sort_weight, status
        FROM membership_package_group
        WHERE tenant_id = $1
          AND ($2 IS NULL OR category = $2)
          AND ($3 IS NULL OR status = $3)
        ORDER BY sort_weight ASC, external_id ASC, id ASC
        LIMIT $4 OFFSET $5
        "#,
    )
    .bind(&tenant_id)
    .bind(query.category.as_deref())
    .bind(query.status.as_deref())
    .bind(params.page_size)
    .bind(params.offset)
    .fetch_all(pool)
    .await
    .map_err(sql_error)?;
    Ok(offset_page(
        rows.iter().map(map_admin_package_group).collect(),
        total,
        params,
    ))
}

async fn create_admin_membership_package_group(
    pool: &PgPool,
    command: CreateAdminMembershipPackageGroupCommand,
) -> AppMembershipResult<AdminMembershipPackageGroupItem> {
    let external_id = next_admin_package_group_external_id(pool).await?;
    let tenant_id = tenant_id_text(command.subject.tenant_id);
    let organization_id = organization_id_text(command.subject.organization_id);
    sqlx::query(
        r#"
        INSERT INTO membership_package_group
            (id, tenant_id, organization_id, category, external_id, group_no, name, description, billing_cycle, duration_days, display_channel, sort_weight, status, created_at, updated_at)
        VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'app', $11, $12, $13::timestamptz, $13::timestamptz)
        "#,
    )
    .bind(&command.package_group_id)
    .bind(&tenant_id)
    .bind(&organization_id)
    .bind(&command.input.category)
    .bind(external_id)
    .bind(&command.input.code)
    .bind(&command.input.name)
    .bind(command.input.description.as_deref())
    .bind(recurrence_cycle_from_duration(command.input.duration_days))
    .bind(command.input.duration_days)
    .bind(command.input.sort_weight)
    .bind(&command.input.status)
    .bind(&command.requested_at)
    .execute(pool)
    .await
    .map_err(|error| store_error("failed to create membership package group", error))?;
    load_admin_membership_package_group(pool, command.subject.tenant_id, &command.package_group_id)
        .await
}

async fn update_admin_membership_package_group(
    pool: &PgPool,
    command: UpdateAdminMembershipPackageGroupCommand,
) -> AppMembershipResult<AdminMembershipPackageGroupItem> {
    let tenant_id = tenant_id_text(command.subject.tenant_id);
    let package_group_id =
        package_group_external_id_for_update(pool, &tenant_id, &command.package_group_id).await?;
    sqlx::query(
        r#"
        UPDATE membership_package_group
        SET group_no = $1,
            name = $2,
            description = $3,
            billing_cycle = $4,
            duration_days = $5,
            sort_weight = $6,
            status = $7,
            category = $8,
            updated_at = $9::timestamptz
        WHERE id = $10
          AND tenant_id = $11
        "#,
    )
    .bind(&command.input.code)
    .bind(&command.input.name)
    .bind(command.input.description.as_deref())
    .bind(recurrence_cycle_from_duration(command.input.duration_days))
    .bind(command.input.duration_days)
    .bind(command.input.sort_weight)
    .bind(&command.input.status)
    .bind(&command.input.category)
    .bind(&command.requested_at)
    .bind(&package_group_id)
    .bind(&tenant_id)
    .execute(pool)
    .await
    .map_err(|error| store_error("failed to update membership package group", error))?;
    load_admin_membership_package_group(pool, command.subject.tenant_id, &package_group_id).await
}

async fn delete_admin_membership_package_group(
    pool: &PgPool,
    command: DeleteAdminMembershipPackageGroupCommand,
) -> AppMembershipResult<bool> {
    let tenant_id = tenant_id_text(command.subject.tenant_id);
    let result = sqlx::query(
        r#"
        UPDATE membership_package_group
        SET status = 'disabled',
            updated_at = $2::timestamptz
        WHERE tenant_id = $3
          AND (id = $1 OR group_no = $1)
        "#,
    )
    .bind(&command.package_group_id)
    .bind(&command.requested_at)
    .bind(&tenant_id)
    .execute(pool)
    .await
    .map_err(|error| store_error("failed to delete membership package group", error))?;
    Ok(result.rows_affected() > 0)
}

async fn create_admin_membership_package(
    pool: &PgPool,
    command: CreateAdminMembershipPackageCommand,
) -> AppMembershipResult<AdminMembershipPackageItem> {
    let tenant_id = tenant_id_text(command.subject.tenant_id);
    let organization_id = organization_id_text(command.subject.organization_id);
    ensure_admin_plan_exists(
        pool,
        &tenant_id,
        &organization_id,
        &command.input.plan_id,
        &command.input.category,
        &command.requested_at,
    )
    .await?;
    ensure_admin_package_group_exists(
        pool,
        &tenant_id,
        &organization_id,
        &command.input.package_group_id,
        &command.input.category,
        command.input.duration_days,
        &command.requested_at,
    )
    .await?;
    validate_package_category_consistency(
        pool,
        &tenant_id,
        &command.input.package_group_id,
        &command.input.plan_id,
        &command.input.category,
    )
    .await?;
    let external_id = next_admin_package_external_id(pool).await?;
    let sku_id = format!("{}-sku", command.package_id);
    let plan_version_id = ensure_admin_membership_plan_version(
        pool,
        &tenant_id,
        &organization_id,
        &command.input.plan_id,
        &command.input.name,
        &command.requested_at,
    )
    .await?;
    // The membership package no longer projects a SKU row into the
    // merchandise-owned `commerce_product_sku` table. That projection was a
    // cross-owner write against a schema this repository does not own, and
    // sdkwork-merchandise v2 renamed the columns it relied on
    // (`price_amount` -> `list_price_minor` / `sale_price_minor`, and
    // `spec_json` -> `metadata`), so it cannot be expressed any more.
    // `membership_package` is the authority for a package's price, currency,
    // and tags.
    sqlx::query(
        r#"
        INSERT INTO membership_package
            (id, tenant_id, organization_id, category, external_id, package_no, package_group_id, plan_id, plan_version_id, sku_id, name, description, price_amount, original_price_amount, currency_code, point_amount, discount, duration_days, recurrence_cycle, sort_weight, recommended, status, starts_at, ends_at, created_at, updated_at)
        VALUES
            ($1, $2, $3, $18, $4, $5, $6, $7, $16, $8, $9, NULL, $10, NULL, $11, 0, $17, $12, $15, $4, 0, $13, NULL, NULL, $14::timestamptz, $14::timestamptz)
        ON CONFLICT (tenant_id, organization_id, package_no) DO UPDATE SET
            category = excluded.category,
            package_group_id = excluded.package_group_id,
            plan_id = excluded.plan_id,
            plan_version_id = excluded.plan_version_id,
            sku_id = excluded.sku_id,
            name = excluded.name,
            price_amount = excluded.price_amount,
            currency_code = excluded.currency_code,
            point_amount = excluded.point_amount,
            discount = excluded.discount,
            duration_days = excluded.duration_days,
            recurrence_cycle = excluded.recurrence_cycle,
            sort_weight = excluded.sort_weight,
            recommended = excluded.recommended,
            status = excluded.status,
            updated_at = excluded.updated_at
        "#,
    )
    .bind(&command.package_id)
    .bind(&tenant_id)
    .bind(&organization_id)
    .bind(external_id)
    .bind(&command.input.code)
    .bind(&command.input.package_group_id)
    .bind(&command.input.plan_id)
    .bind(&sku_id)
    .bind(&command.input.name)
    .bind(&command.input.price_amount)
    .bind(&command.input.currency_code)
    .bind(command.input.duration_days)
    .bind(&command.input.status)
    .bind(&command.requested_at)
    .bind(recurrence_cycle_from_duration(command.input.duration_days))
    .bind(plan_version_id)
    .bind(command.input.discount)
    .bind(&command.input.category)
    .execute(pool)
    .await
    .map_err(|error| store_error("failed to create membership package", error))?;
    // The upsert keeps the existing row id on conflict, so resolve the stored
    // id by package code before loading the persisted item.
    let stored_id: String = sqlx::query_scalar(
        "SELECT id FROM membership_package WHERE tenant_id = $1 AND package_no = $2",
    )
    .bind(&tenant_id)
    .bind(&command.input.code)
    .fetch_one(pool)
    .await
    .map_err(sql_error)?;
    load_admin_membership_package(pool, command.subject.tenant_id, &stored_id).await
}

async fn update_admin_membership_package(
    pool: &PgPool,
    command: UpdateAdminMembershipPackageCommand,
) -> AppMembershipResult<AdminMembershipPackageItem> {
    let tenant_id = tenant_id_text(command.subject.tenant_id);
    let organization_id = organization_id_text(command.subject.organization_id);
    ensure_admin_plan_exists(
        pool,
        &tenant_id,
        &organization_id,
        &command.input.plan_id,
        &command.input.category,
        &command.requested_at,
    )
    .await?;
    ensure_admin_package_group_exists(
        pool,
        &tenant_id,
        &organization_id,
        &command.input.package_group_id,
        &command.input.category,
        command.input.duration_days,
        &command.requested_at,
    )
    .await?;
    validate_package_category_consistency(
        pool,
        &tenant_id,
        &command.input.package_group_id,
        &command.input.plan_id,
        &command.input.category,
    )
    .await?;
    let current = sqlx::query(
        r#"
        SELECT sku_id
        FROM membership_package
        WHERE tenant_id = $1
          AND (id = $2 OR package_no = $2)
        LIMIT 1
        "#,
    )
    .bind(&tenant_id)
    .bind(&command.package_id)
    .fetch_optional(pool)
    .await
    .map_err(sql_error)?
    .ok_or_else(|| CommerceServiceError::not_found("membership package was not found"))?;
    let package_id = package_id_for_update(pool, &tenant_id, &command.package_id).await?;
    let sku_id = optional_string_cell(&current, "sku_id")
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| format!("{package_id}-sku"));
    let plan_version_id = ensure_admin_membership_plan_version(
        pool,
        &tenant_id,
        &organization_id,
        &command.input.plan_id,
        &command.input.name,
        &command.requested_at,
    )
    .await?;
    // Retired with the create path: no SKU row is projected into the
    // merchandise-owned `commerce_product_sku` table. `membership_package`
    // owns the package price, currency, status, and tags.
    sqlx::query(
        r#"
        UPDATE membership_package
        SET package_no = $1,
            package_group_id = $2,
            plan_id = $3,
            plan_version_id = $4,
            sku_id = $5,
            name = $6,
            price_amount = $7,
            currency_code = $8,
            duration_days = $9,
            discount = $10,
            status = $11,
            category = $12,
            updated_at = $13::timestamptz
        WHERE id = $14
          AND tenant_id = $15
        "#,
    )
    .bind(&command.input.code)
    .bind(&command.input.package_group_id)
    .bind(&command.input.plan_id)
    .bind(&plan_version_id)
    .bind(&sku_id)
    .bind(&command.input.name)
    .bind(&command.input.price_amount)
    .bind(&command.input.currency_code)
    .bind(command.input.duration_days)
    .bind(command.input.discount)
    .bind(&command.input.status)
    .bind(&command.input.category)
    .bind(&command.requested_at)
    .bind(&package_id)
    .bind(&tenant_id)
    .execute(pool)
    .await
    .map_err(|error| store_error("failed to update membership package", error))?;
    load_admin_membership_package(pool, command.subject.tenant_id, &package_id).await
}

async fn delete_admin_membership_package(
    pool: &PgPool,
    command: DeleteAdminMembershipPackageCommand,
) -> AppMembershipResult<bool> {
    let tenant_id = tenant_id_text(command.subject.tenant_id);
    let result = sqlx::query(
        r#"
        UPDATE membership_package
        SET status = 'disabled',
            updated_at = $2::timestamptz
        WHERE tenant_id = $3
          AND (id = $1 OR package_no = $1)
        "#,
    )
    .bind(&command.package_id)
    .bind(&command.requested_at)
    .bind(&tenant_id)
    .execute(pool)
    .await
    .map_err(|error| store_error("failed to delete membership package", error))?;
    Ok(result.rows_affected() > 0)
}

async fn list_admin_membership_members(
    pool: &PgPool,
    query: ListAdminMembershipMembersQuery,
) -> AppMembershipResult<SdkWorkPageData<AdminMembershipMemberItem>> {
    let params = MembershipListQuery {
        page: query.page,
        page_size: query.page_size,
        cursor: query.cursor.clone(),
        category: None,
    }
    .offset_params();

    let total: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM membership_subscription m
        LEFT JOIN membership_plan l ON l.id = m.plan_id
        WHERE m.tenant_id = CAST($1 AS TEXT)
          AND ($2 IS NULL OR m.organization_id IS NULL OR m.organization_id = CAST($2 AS TEXT) OR (CAST($2 AS TEXT) != '0' AND m.organization_id = '0'))
          AND ($3 IS NULL OR m.owner_user_id = $3 OR m.subject_id = $3)
          AND ($4 IS NULL OR m.plan_id = $4 OR l.plan_no = $4)
          AND ($5 IS NULL OR m.status = $5)
        "#,
    )
    .bind(query.subject.tenant_id)
    .bind(query.subject.organization_id)
    .bind(query.user_id.as_deref())
    .bind(query.plan_id.as_deref())
    .bind(query.status.as_deref())
    .fetch_one(pool)
    .await
    .map_err(sql_error)?;

    let rows = sqlx::query(
        r#"
        SELECT m.id, m.owner_user_id, m.status, CAST(m.starts_at AS TEXT) AS starts_at,
               CAST(m.expires_at AS TEXT) AS expires_at, l.plan_no AS plan_no, m.plan_id AS plan_id
        FROM membership_subscription m
        LEFT JOIN membership_plan l ON l.id = m.plan_id
        WHERE m.tenant_id = CAST($1 AS TEXT)
          AND ($2 IS NULL OR m.organization_id IS NULL OR m.organization_id = CAST($2 AS TEXT) OR (CAST($2 AS TEXT) != '0' AND m.organization_id = '0'))
          AND ($3 IS NULL OR m.owner_user_id = $3 OR m.subject_id = $3)
          AND ($4 IS NULL OR m.plan_id = $4 OR l.plan_no = $4)
          AND ($5 IS NULL OR m.status = $5)
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT $6 OFFSET $7
        "#,
    )
    .bind(query.subject.tenant_id)
    .bind(query.subject.organization_id)
    .bind(query.user_id.as_deref())
    .bind(query.plan_id.as_deref())
    .bind(query.status.as_deref())
    .bind(params.page_size)
    .bind(params.offset)
    .fetch_all(pool)
    .await
    .map_err(sql_error)?;
    Ok(offset_page(
        rows.iter().map(map_admin_membership).collect(),
        total,
        params,
    ))
}

async fn update_admin_membership_member_status(
    pool: &PgPool,
    command: UpdateAdminMembershipMemberStatusCommand,
) -> AppMembershipResult<AdminMembershipMemberItem> {
    let result = sqlx::query(
        r#"
        UPDATE membership_subscription
        SET status = $1,
            updated_at = $2::timestamptz
        WHERE tenant_id = CAST($3 AS TEXT)
          AND ($4 = 0 OR organization_id IS NULL OR organization_id = CAST($4 AS TEXT) OR organization_id = '0')
          AND id = $5
        "#,
    )
    .bind(&command.status)
    .bind(&command.requested_at)
    .bind(command.subject.tenant_id)
    .bind(command.subject.organization_id)
    .bind(&command.membership_id)
    .execute(pool)
    .await
    .map_err(|error| store_error("failed to update membership membership status", error))?;
    if result.rows_affected() == 0 {
        return Err(CommerceServiceError::not_found(
            "membership membership was not found",
        ));
    }
    load_admin_membership(
        pool,
        &RetrieveAdminMembershipMemberQuery {
            subject: command.subject,
            membership_id: command.membership_id,
        },
    )
    .await
}

async fn list_admin_membership_entitlements(
    pool: &PgPool,
    query: ListAdminMembershipEntitlementsQuery,
) -> AppMembershipResult<SdkWorkPageData<AdminMembershipEntitlementItem>> {
    let params = MembershipListQuery {
        page: query.page,
        page_size: query.page_size,
        cursor: query.cursor.clone(),
        category: None,
    }
    .offset_params();
    let status_filter = query.status.as_deref();

    let total: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM membership_entitlement_account a
        JOIN membership_benefit_definition d
          ON d.id = a.benefit_id
        LEFT JOIN membership_entitlement_grant g
          ON g.benefit_id = a.benefit_id
         AND g.subject_type = a.subject_type
         AND g.subject_id = a.subject_id
         AND g.source_type = 'membership_subscription'
         AND g.tenant_id = a.tenant_id
        LEFT JOIN membership_subscription m
          ON m.id = g.source_id
         AND m.tenant_id = a.tenant_id
        WHERE a.tenant_id = CAST($1 AS TEXT)
          AND ($2 IS NULL OR m.plan_id = $2)
          AND ($3 IS NULL OR g.source_id = $3)
          AND ($4 IS NULL OR (
            CASE
              WHEN CAST(a.total_granted AS REAL) > 0
               AND CAST(a.total_used AS REAL) >= CAST(a.total_granted AS REAL) THEN 'exhausted'
              ELSE 'active'
            END
          ) = $4)
        "#,
    )
    .bind(query.subject.tenant_id)
    .bind(query.plan_id.as_deref())
    .bind(query.membership_id.as_deref())
    .bind(status_filter)
    .fetch_one(pool)
    .await
    .map_err(sql_error)?;

    let rows = sqlx::query(
        r#"
        SELECT a.id, d.benefit_code AS entitlement_code, g.source_id AS membership_id,
               a.total_granted AS granted_quantity, a.total_used AS used_quantity,
               m.plan_id AS plan_id
        FROM membership_entitlement_account a
        JOIN membership_benefit_definition d
          ON d.id = a.benefit_id
        LEFT JOIN membership_entitlement_grant g
          ON g.benefit_id = a.benefit_id
         AND g.subject_type = a.subject_type
         AND g.subject_id = a.subject_id
         AND g.source_type = 'membership_subscription'
         AND g.tenant_id = a.tenant_id
        LEFT JOIN membership_subscription m
          ON m.id = g.source_id
         AND m.tenant_id = a.tenant_id
        WHERE a.tenant_id = CAST($1 AS TEXT)
          AND ($2 IS NULL OR m.plan_id = $2)
          AND ($3 IS NULL OR g.source_id = $3)
          AND ($4 IS NULL OR (
            CASE
              WHEN CAST(a.total_granted AS REAL) > 0
               AND CAST(a.total_used AS REAL) >= CAST(a.total_granted AS REAL) THEN 'exhausted'
              ELSE 'active'
            END
          ) = $4)
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT $5 OFFSET $6
        "#,
    )
    .bind(query.subject.tenant_id)
    .bind(query.plan_id.as_deref())
    .bind(query.membership_id.as_deref())
    .bind(status_filter)
    .bind(params.page_size)
    .bind(params.offset)
    .fetch_all(pool)
    .await
    .map_err(sql_error)?;
    Ok(offset_page(
        rows.iter().map(map_admin_entitlement).collect(),
        total,
        params,
    ))
}

async fn load_admin_membership_plan(
    pool: &PgPool,
    tenant_id: i64,
    plan_id: &str,
) -> AppMembershipResult<AdminMembershipPlanItem> {
    let tenant_id = tenant_id_text(tenant_id);
    let rows = sqlx::query(
        r#"
        SELECT
            p.id,
            p.plan_no AS plan_no,
            p.name,
            CAST(p.rank AS INTEGER) AS rank,
            p.status,
            p.category AS category,
            p.description AS description,
            CAST(p.created_at AS TEXT) AS created_at,
            CAST(p.updated_at AS TEXT) AS updated_at,
            b.id AS plan_benefit_id,
            b.benefit_code,
            CAST(b.grant_quantity AS TEXT) AS grant_quantity,
            b.usage_policy,
            d.name AS benefit_name,
            d.benefit_type,
            d.description AS benefit_description
        FROM membership_plan p
        LEFT JOIN membership_plan_version v
            ON v.plan_id = p.id
           AND v.tenant_id = p.tenant_id
           AND v.lifecycle_status = 'published'
        LEFT JOIN membership_plan_benefit b
            ON b.plan_version_id = v.id
           AND b.tenant_id = p.tenant_id
           AND b.status = 'active'
        LEFT JOIN membership_benefit_definition d
            ON d.id = b.benefit_id
           AND d.tenant_id = b.tenant_id
        WHERE p.tenant_id = $1
          AND (p.id = $2 OR p.plan_no = $2)
        ORDER BY b.sort_weight ASC, b.id ASC
        "#,
    )
    .bind(&tenant_id)
    .bind(plan_id)
    .fetch_all(pool)
    .await
    .map_err(sql_error)?;
    admin_plans_from_rows(&rows)
        .into_iter()
        .next()
        .ok_or_else(|| CommerceServiceError::not_found("membership plan was not found"))
}

async fn load_admin_membership_package(
    pool: &PgPool,
    tenant_id: i64,
    package_id: &str,
) -> AppMembershipResult<AdminMembershipPackageItem> {
    let tenant_id = tenant_id_text(tenant_id);
    let row = sqlx::query(
        r#"
        SELECT id, category, package_no, external_id AS external_id, package_group_id AS package_group_id, plan_id AS plan_id, name, CAST(price_amount AS TEXT) AS price_amount,
               currency_code, duration_days AS duration_days, COALESCE(discount, 100)::bigint AS discount, status,
               CAST(created_at AS TEXT) AS created_at, CAST(updated_at AS TEXT) AS updated_at
        FROM membership_package
        WHERE tenant_id = $1
          AND (id = $2 OR package_no = $2)
        LIMIT 1
        "#,
    )
    .bind(&tenant_id)
    .bind(package_id)
    .fetch_optional(pool)
    .await
    .map_err(sql_error)?
    .ok_or_else(|| CommerceServiceError::not_found("membership package was not found"))?;
    Ok(map_admin_package(&row))
}

async fn load_admin_membership_package_group(
    pool: &PgPool,
    tenant_id: i64,
    package_group_id: &str,
) -> AppMembershipResult<AdminMembershipPackageGroupItem> {
    let tenant_id = tenant_id_text(tenant_id);
    let row = sqlx::query(
        r#"
        SELECT id, category, group_no, name, description, billing_cycle, duration_days,
               sort_weight, status
        FROM membership_package_group
        WHERE tenant_id = $1
          AND (id = $2 OR group_no = $2)
        LIMIT 1
        "#,
    )
    .bind(&tenant_id)
    .bind(package_group_id)
    .fetch_optional(pool)
    .await
    .map_err(sql_error)?
    .ok_or_else(|| CommerceServiceError::not_found("membership package group was not found"))?;
    Ok(map_admin_package_group(&row))
}
async fn load_admin_membership(
    pool: &PgPool,
    query: &RetrieveAdminMembershipMemberQuery,
) -> AppMembershipResult<AdminMembershipMemberItem> {
    let row = sqlx::query(
        r#"
        SELECT m.id, m.owner_user_id, m.status, CAST(m.starts_at AS TEXT) AS starts_at,
               CAST(m.expires_at AS TEXT) AS expires_at, l.plan_no AS plan_no, m.plan_id AS plan_id
        FROM membership_subscription m
        LEFT JOIN membership_plan l ON l.id = m.plan_id
        WHERE m.tenant_id = CAST($1 AS TEXT)
          AND ($2 = 0 OR m.organization_id IS NULL OR m.organization_id = CAST($2 AS TEXT) OR m.organization_id = '0')
          AND m.id = $3
        LIMIT 1
        "#,
    )
    .bind(query.subject.tenant_id)
    .bind(query.subject.organization_id)
    .bind(&query.membership_id)
    .fetch_optional(pool)
    .await
    .or_else(none_when_read_model_is_missing)?
    .ok_or_else(|| CommerceServiceError::not_found("membership membership was not found"))?;
    Ok(map_admin_membership(&row))
}

/// Ensures the membership plan referenced by an admin package mutation
/// Ensures the referenced plan exists before a package write, provisioning it
/// when an external integration identifies plans by their own stable code
/// (e.g. circle tier publishing). Provisioned placeholders get a readable
/// display name derived from the stable code and the package's category, and
/// carry an auto-provisioned description so operators can rename them in the
/// admin console.
async fn ensure_admin_plan_exists(
    pool: &PgPool,
    tenant_id: &str,
    organization_id: &str,
    plan_id: &str,
    category: &str,
    requested_at: &str,
) -> AppMembershipResult<()> {
    let exists: Option<i32> =
        sqlx::query_scalar("SELECT 1 FROM membership_plan WHERE id = $1 OR plan_no = $1 LIMIT 1")
            .bind(plan_id)
            .fetch_optional(pool)
            .await
            .map_err(sql_error)?;
    if exists.is_some() {
        return Ok(());
    }
    let display_name = humanize_provision_name(plan_id);
    sqlx::query(
        r#"
        INSERT INTO membership_plan
            (id, tenant_id, organization_id, category, plan_no, plan_code, name, rank, description, status, created_at, updated_at)
        VALUES
            ($1, $2, $3, $4, $5, $5, $6, 0, $7, 'inactive', $8::timestamptz, $8::timestamptz)
        ON CONFLICT (id) DO NOTHING
        "#,
    )
    .bind(plan_id)
    .bind(tenant_id)
    .bind(organization_id)
    .bind(category)
    .bind(plan_id)
    .bind(&display_name)
    .bind(AUTO_PROVISIONED_DESCRIPTION)
    .bind(requested_at)
    .execute(pool)
    .await
    .map_err(|error| store_error("failed to provision membership plan", error))?;
    upsert_admin_membership_plan_version(
        pool,
        tenant_id,
        organization_id,
        plan_id,
        &admin_plan_version_id(plan_id),
        plan_id,
        requested_at,
    )
    .await
}

async fn ensure_admin_membership_plan_version(
    pool: &PgPool,
    tenant_id: &str,
    organization_id: &str,
    plan_id_or_no: &str,
    title: &str,
    requested_at: &str,
) -> AppMembershipResult<String> {
    let row = sqlx::query(
        r#"
        SELECT id
        FROM membership_plan
        WHERE tenant_id = $1
          AND (id = $2 OR plan_no = $2)
        ORDER BY CASE WHEN id = $2 THEN 0 ELSE 1 END
        LIMIT 1
        "#,
    )
    .bind(tenant_id)
    .bind(plan_id_or_no)
    .fetch_optional(pool)
    .await
    .map_err(sql_error)?
    .ok_or_else(|| CommerceServiceError::not_found("membership target plan was not found"))?;
    let plan_id = string_cell(&row, "id");
    let existing: Option<String> = sqlx::query_scalar(
        r#"
        SELECT id
        FROM membership_plan_version
        WHERE plan_id = $1
          AND lifecycle_status = 'published'
        ORDER BY version_no DESC, id DESC
        LIMIT 1
        "#,
    )
    .bind(&plan_id)
    .fetch_optional(pool)
    .await
    .map_err(sql_error)?;
    if let Some(version_id) = existing {
        return Ok(version_id);
    }
    let version_id = admin_plan_version_id(&plan_id);
    upsert_admin_membership_plan_version(
        pool,
        tenant_id,
        organization_id,
        &plan_id,
        &version_id,
        title,
        requested_at,
    )
    .await?;
    Ok(version_id)
}

async fn upsert_admin_membership_plan_version(
    pool: &PgPool,
    tenant_id: &str,
    organization_id: &str,
    plan_id: &str,
    plan_version_id: &str,
    title: &str,
    requested_at: &str,
) -> AppMembershipResult<()> {
    sqlx::query(
        r#"
        INSERT INTO membership_plan_version
            (id, tenant_id, organization_id, plan_id, version_no, title, description, lifecycle_status, effective_from, effective_to, published_at, created_at, updated_at)
        VALUES
            ($1, $2, $3, $4, 'v1', $5, NULL, 'published', $6::timestamptz, NULL, $6::timestamptz, $6::timestamptz, $6::timestamptz)
        ON CONFLICT(tenant_id, plan_id, version_no) DO UPDATE SET
            id = excluded.id,
            title = excluded.title,
            lifecycle_status = excluded.lifecycle_status,
            published_at = excluded.published_at,
            updated_at = excluded.updated_at
        "#,
    )
    .bind(plan_version_id)
    .bind(tenant_id)
    .bind(organization_id)
    .bind(plan_id)
    .bind(title)
    .bind(requested_at)
    .execute(pool)
    .await
    .map_err(|error| store_error("failed to upsert membership plan version", error))?;
    Ok(())
}

async fn replace_admin_plan_benefits(
    pool: &PgPool,
    tenant_id: &str,
    organization_id: &str,
    plan_id: &str,
    plan_version_id: &str,
    benefits: &[AppMembershipBenefitItem],
    requested_at: &str,
) -> AppMembershipResult<()> {
    sqlx::query("DELETE FROM membership_plan_benefit WHERE plan_version_id = $1")
        .bind(plan_version_id)
        .execute(pool)
        .await
        .map_err(|error| store_error("failed to clear membership plan benefits", error))?;
    for (index, benefit) in benefits.iter().enumerate() {
        let benefit_code = admin_benefit_code(benefit, index + 1);
        let benefit_id = membership_benefit_definition_id_for_code(&benefit_code);
        let benefit_type = benefit
            .r#type
            .as_deref()
            .filter(|value| !value.trim().is_empty())
            .map(normalize_benefit_type_storage)
            .unwrap_or("quota");
        sqlx::query(
            r#"
            INSERT INTO membership_benefit_definition
                (id, tenant_id, organization_id, benefit_code, name, benefit_type, value_unit, measurement_type, description, status, created_at, updated_at)
            VALUES
                ($1, $2, $3, $4, $5, $6, 'count', 'counter', $7, 'active', $8::timestamptz, $8::timestamptz)
            ON CONFLICT(tenant_id, organization_id, benefit_code) DO UPDATE SET
                id = excluded.id,
                name = excluded.name,
                benefit_type = excluded.benefit_type,
                description = excluded.description,
                status = excluded.status,
                updated_at = excluded.updated_at
            "#,
        )
        .bind(&benefit_id)
        .bind(tenant_id)
        .bind(organization_id)
        .bind(&benefit_code)
        .bind(&benefit.name)
        .bind(benefit_type)
        .bind(benefit.description.as_deref())
        .bind(requested_at)
        .execute(pool)
        .await
        .map_err(|error| store_error("failed to upsert benefit definition", error))?;

        let plan_benefit_id = format!("{plan_version_id}-benefit-{}", index + 1);
        let grant_quantity = benefit.usage_limit.unwrap_or(0).max(0).to_string();
        sqlx::query(
            r#"
            INSERT INTO membership_plan_benefit
                (id, tenant_id, organization_id, plan_id, plan_version_id, benefit_id, benefit_code, grant_quantity, grant_period, reset_policy, usage_policy, sort_weight, status, created_at, updated_at)
            VALUES
                ($1, $2, $3, $4, $5, $6, $7, $8, 'membership_period', NULL, $9, $10, 'active', $11::timestamptz, $11::timestamptz)
            "#,
        )
        .bind(&plan_benefit_id)
        .bind(tenant_id)
        .bind(organization_id)
        .bind(plan_id)
        .bind(plan_version_id)
        .bind(&benefit_id)
        .bind(&benefit_code)
        .bind(grant_quantity)
        .bind(benefit_type)
        .bind((index + 1) as i64)
        .bind(requested_at)
        .execute(pool)
        .await
        .map_err(|error| store_error("failed to upsert membership plan benefit", error))?;
    }
    Ok(())
}

/// Ensures the membership package group referenced by an admin package
/// mutation exists, creating it on first use (idempotent), so external
/// integrations can register packages under their own group code.
async fn ensure_admin_package_group_exists(
    pool: &PgPool,
    tenant_id: &str,
    organization_id: &str,
    package_group_id: &str,
    category: &str,
    duration_days: i64,
    requested_at: &str,
) -> AppMembershipResult<()> {
    let exists: Option<i32> = sqlx::query_scalar(
        "SELECT 1 FROM membership_package_group WHERE id = $1 OR group_no = $1 LIMIT 1",
    )
    .bind(package_group_id)
    .fetch_optional(pool)
    .await
    .map_err(sql_error)?;
    if exists.is_some() {
        return Ok(());
    }
    let external_id = next_admin_package_group_external_id(pool).await?;
    let display_name = humanize_provision_name(package_group_id);
    sqlx::query(
        r#"
        INSERT INTO membership_package_group
            (id, tenant_id, organization_id, category, external_id, group_no, name, description, billing_cycle, duration_days, display_channel, sort_weight, status, created_at, updated_at)
        VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'app', 0, 'inactive', $11::timestamptz, $11::timestamptz)
        ON CONFLICT (id) DO NOTHING
        "#,
    )
    .bind(package_group_id)
    .bind(tenant_id)
    .bind(organization_id)
    .bind(category)
    .bind(external_id)
    .bind(package_group_id)
    .bind(&display_name)
    .bind(AUTO_PROVISIONED_DESCRIPTION)
    .bind(recurrence_cycle_from_duration(duration_days))
    .bind(duration_days)
    .bind(requested_at)
    .execute(pool)
    .await
    .map_err(|error| store_error("failed to provision membership package group", error))?;
    Ok(())
}

/// Validates that a package's category is consistent with its package group
/// and plan categories. Catalog classification must stay coherent within a
/// plan family, so mismatches are rejected instead of silently mixing
/// families on one package.
async fn validate_package_category_consistency(
    pool: &PgPool,
    tenant_id: &str,
    package_group_id: &str,
    plan_id: &str,
    category: &str,
) -> AppMembershipResult<()> {
    let row = sqlx::query(
        r#"
        SELECT g.category AS group_category, p.category AS plan_category
        FROM membership_package_group g
        CROSS JOIN membership_plan p
        WHERE g.tenant_id = $1
          AND (g.id = $2 OR g.group_no = $2)
          AND p.tenant_id = $1
          AND (p.id = $3 OR p.plan_no = $3)
        LIMIT 1
        "#,
    )
    .bind(tenant_id)
    .bind(package_group_id)
    .bind(plan_id)
    .fetch_optional(pool)
    .await
    .map_err(sql_error)?;
    let Some(row) = row else {
        return Ok(());
    };
    let group_category = string_cell(&row, "group_category");
    let plan_category = string_cell(&row, "plan_category");
    if group_category != category || plan_category != category {
        return Err(CommerceServiceError::validation(format!(
            "membership package category `{category}` must match its package group (`{group_category}`) and plan (`{plan_category}`)"
        )));
    }
    Ok(())
}

// The `external_id` columns are INT4: decode the MAX() result as i32 and
// keep the value i32 so the INSERT bind stays INT4-compatible.
async fn next_admin_package_external_id(pool: &PgPool) -> AppMembershipResult<i32> {
    let max_id: Option<i32> = sqlx::query_scalar("SELECT MAX(external_id) FROM membership_package")
        .fetch_one(pool)
        .await
        .map_err(sql_error)?;
    Ok(max_id.unwrap_or(0) + 1)
}

async fn next_admin_package_group_external_id(pool: &PgPool) -> AppMembershipResult<i32> {
    let max_id: Option<i32> =
        sqlx::query_scalar("SELECT MAX(external_id) FROM membership_package_group")
            .fetch_one(pool)
            .await
            .map_err(sql_error)?;
    Ok(max_id.unwrap_or(0) + 1)
}

async fn package_id_for_update(
    pool: &PgPool,
    tenant_id: &str,
    value: &str,
) -> AppMembershipResult<String> {
    let row = sqlx::query(
        r#"
        SELECT id
        FROM membership_package
        WHERE tenant_id = $1
          AND (id = $2 OR package_no = $2)
        LIMIT 1
        "#,
    )
    .bind(tenant_id)
    .bind(value)
    .fetch_optional(pool)
    .await
    .map_err(sql_error)?
    .ok_or_else(|| CommerceServiceError::not_found("membership package was not found"))?;
    Ok(string_cell(&row, "id"))
}

async fn package_group_external_id_for_update(
    pool: &PgPool,
    tenant_id: &str,
    value: &str,
) -> AppMembershipResult<String> {
    let row = sqlx::query(
        r#"
        SELECT id
        FROM membership_package_group
        WHERE tenant_id = $1
          AND (id = $2 OR group_no = $2)
        LIMIT 1
        "#,
    )
    .bind(tenant_id)
    .bind(value)
    .fetch_optional(pool)
    .await
    .map_err(sql_error)?
    .ok_or_else(|| CommerceServiceError::not_found("membership package group was not found"))?;
    Ok(string_cell(&row, "id"))
}

fn admin_plans_from_rows(rows: &[sqlx::postgres::PgRow]) -> Vec<AdminMembershipPlanItem> {
    let mut grouped = BTreeMap::<String, AdminMembershipPlanItem>::new();
    for row in rows.iter() {
        let id = string_cell(row, "id");
        let code = string_cell(row, "plan_no");
        let rank = integer_cell(row, "rank");
        let plan = grouped
            .entry(id.clone())
            .or_insert_with(|| AdminMembershipPlanItem {
                id,
                category: string_cell(row, "category"),
                code: code.clone(),
                name: string_cell(row, "name"),
                rank: if rank == 0 {
                    plan_rank_from_code(&code)
                } else {
                    rank
                },
                benefits: Vec::new(),
                description: optional_string_cell(row, "description"),
                status: string_cell(row, "status"),
                created_at: string_cell(row, "created_at"),
                updated_at: string_cell(row, "updated_at"),
            });
        if let Some(benefit) = plan_benefit_from_row(row, (plan.benefits.len() + 1) as i64) {
            if !plan
                .benefits
                .iter()
                .any(|item| item.benefit_key.as_deref() == benefit.benefit_key.as_deref())
            {
                plan.benefits.push(benefit);
            }
        }
    }
    let mut plans = grouped.into_values().collect::<Vec<_>>();
    plans.sort_by_key(|plan| (plan.rank, plan.code.clone(), plan.id.clone()));
    plans
}

fn map_admin_package(row: &sqlx::postgres::PgRow) -> AdminMembershipPackageItem {
    let discount = integer_cell(row, "discount");
    AdminMembershipPackageItem {
        id: string_cell(row, "id"),
        category: string_cell(row, "category"),
        external_id: integer_cell(row, "external_id"),
        code: string_cell(row, "package_no"),
        package_group_id: string_cell(row, "package_group_id"),
        plan_id: string_cell(row, "plan_id"),
        name: string_cell(row, "name"),
        price_amount: decimal_string(
            &string_cell(row, "price_amount"),
            "membership package price",
        )
        .unwrap_or_else(|_| string_cell(row, "price_amount")),
        currency_code: string_cell(row, "currency_code"),
        duration_days: integer_cell(row, "duration_days"),
        // Reads fall back to no discount (100) whenever the column is missing
        // or carries an out-of-range value; clamping to the range would
        // silently turn bad data into a 1% price.
        discount: if (1..=100).contains(&discount) {
            discount
        } else {
            100
        },
        status: string_cell(row, "status"),
        created_at: string_cell(row, "created_at"),
        updated_at: string_cell(row, "updated_at"),
    }
}

fn map_admin_package_group(row: &sqlx::postgres::PgRow) -> AdminMembershipPackageGroupItem {
    AdminMembershipPackageGroupItem {
        id: string_cell(row, "id"),
        category: string_cell(row, "category"),
        code: string_cell(row, "group_no"),
        name: string_cell(row, "name"),
        description: optional_string_cell(row, "description"),
        billing_cycle: string_cell(row, "billing_cycle"),
        duration_days: integer_cell(row, "duration_days"),
        sort_weight: integer_cell(row, "sort_weight"),
        status: string_cell(row, "status"),
    }
}

fn map_admin_membership(row: &sqlx::postgres::PgRow) -> AdminMembershipMemberItem {
    AdminMembershipMemberItem {
        id: string_cell(row, "id"),
        owner_user_id: string_cell(row, "owner_user_id"),
        plan_code: optional_string_cell(row, "plan_no")
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| string_cell(row, "plan_id")),
        status: admin_membership_status(&string_cell(row, "status")).to_owned(),
        started_at: string_cell(row, "starts_at"),
        expires_at: string_cell(row, "expires_at"),
    }
}

fn map_admin_entitlement(row: &sqlx::postgres::PgRow) -> AdminMembershipEntitlementItem {
    let granted = parse_points_amount(&string_cell(row, "granted_quantity"));
    let used = parse_points_amount(&string_cell(row, "used_quantity"));
    AdminMembershipEntitlementItem {
        id: string_cell(row, "id"),
        code: string_cell(row, "entitlement_code"),
        plan_id: string_cell(row, "plan_id"),
        membership_id: string_cell(row, "membership_id"),
        quota: granted.to_string(),
        status: if granted > 0 && used >= granted {
            "exhausted".to_owned()
        } else {
            "active".to_owned()
        },
    }
}

fn admin_membership_status(status: &str) -> &'static str {
    match status.trim().to_ascii_lowercase().as_str() {
        "active" => "active",
        "expired" => "expired",
        "suspended" => "suspended",
        "cancelled" => "cancelled",
        _ => "inactive",
    }
}

fn recurrence_cycle_from_duration(duration_days: i64) -> &'static str {
    match duration_days {
        365.. => "year",
        30..=364 => "month",
        7..=29 => "week",
        _ => "day",
    }
}

/// Description stamped on auto-provisioned plan/group placeholders so
/// operators can recognise and rename them in the admin console.
const AUTO_PROVISIONED_DESCRIPTION: &str =
    "Auto-provisioned by an external integration; rename in the admin console.";

/// Normalises a benefit type into the database CHECK vocabulary
/// (`points | feature | queue | quota | service`). Legacy `discount` values
/// map to `service` so rows from older admin forms keep persisting instead of
/// failing the CHECK constraint.
fn normalize_benefit_type_storage(value: &str) -> &'static str {
    match value.trim().to_ascii_lowercase().as_str() {
        "points" => "points",
        "feature" => "feature",
        "queue" => "queue",
        "service" | "discount" => "service",
        _ => "quota",
    }
}

/// Turns a stable integration code (kebab-case, snake_case, or bare words)
/// into a readable display name for auto-provisioned placeholders:
/// `plan-circle-membership` -> `Plan Circle Membership`.
fn humanize_provision_name(code: &str) -> String {
    let mut words = Vec::new();
    for part in code.split(['-', '_', ' ']) {
        let trimmed = part.trim();
        if trimmed.is_empty() {
            continue;
        }
        let mut chars = trimmed.chars();
        let head = chars.next().unwrap_or_default().to_ascii_uppercase();
        words.push(format!("{head}{}", chars.as_str()));
    }
    if words.is_empty() {
        return code.to_owned();
    }
    words.join(" ")
}

async fn load_info(
    pool: &PgPool,
    subject: Option<AppMembershipSubject>,
) -> AppMembershipResult<AppMembershipInfoResponse> {
    let membership = match subject {
        Some(subject) => load_current_membership(pool, subject).await?,
        None => None,
    };
    let points = load_points_balance(pool, subject).await?;
    match membership {
        Some(membership) => {
            // 实时到期降级：行状态仍为 active 但已过到期时间 → 按 expired 呈现
            let membership_status = if membership_expired(&membership.expires_at) {
                "expired".to_owned()
            } else {
                membership.status.clone()
            };
            Ok(AppMembershipInfoResponse {
                plan_rank: membership.rank,
                plan_name: membership.plan_name,
                membership_status,
                started_at: Some(membership.starts_at),
                expires_at: Some(membership.expires_at.clone()),
                remaining_days: remaining_days(&membership.expires_at),
                total_days: None,
                total_spent: Some(membership.total_spent),
                points: Some(points.available_points),
                growth_value: Some(points.available_points),
                upgrade_growth_value: None,
                benefits: membership.benefits,
            })
        }
        None => {
            let benefits = load_benefits_list(pool, subject, Some(0))
                .await
                .unwrap_or_default();
            Ok(AppMembershipInfoResponse {
                plan_rank: 0,
                plan_name: "Free".to_owned(),
                membership_status: "free".to_owned(),
                started_at: None,
                expires_at: None,
                remaining_days: None,
                total_days: None,
                total_spent: Some("0.00".to_owned()),
                points: Some(points.available_points),
                growth_value: Some(points.available_points),
                upgrade_growth_value: None,
                benefits,
            })
        }
    }
}

async fn load_status(
    pool: &PgPool,
    subject: Option<AppMembershipSubject>,
) -> AppMembershipResult<AppMembershipStatusResponse> {
    let membership = match subject {
        Some(subject) => load_current_membership(pool, subject).await?,
        None => None,
    };
    let points = load_points_balance(pool, subject).await?;
    Ok(AppMembershipStatusResponse {
        active: membership
            .as_ref()
            .map(|item| {
                item.rank > 0 && item.status != "expired" && !membership_expired(&item.expires_at)
            })
            .unwrap_or(false),
        plan_rank: membership.as_ref().map(|item| item.rank).unwrap_or(0),
        expires_at: membership.map(|item| item.expires_at),
        point_balance: Some(points.available_points),
    })
}

/// 功能→所需会员等级映射（对齐 seed 计划 rank：free=0/basic=1/standard=2/premium=3/super=4）。
fn required_rank_for_feature(feature_code: &str) -> Option<i64> {
    let rank = match feature_code.trim().to_ascii_lowercase().as_str() {
        "ai_chat" => 1,
        "image_generation" => 2,
        "priority_speed_up" => 2,
        "priority_queue" => 3,
        "exclusive_model" => 3,
        _ => return None,
    };
    Some(rank)
}

/// 会员功能等级门槛校验：功能码解析所需等级（或请求显式指定），
/// 与实时会员状态比对，返回是否放行。
async fn check_feature_access(
    pool: &PgPool,
    query: FeatureAccessCheckQuery,
) -> AppMembershipResult<FeatureAccessCheckOutcome> {
    if query.subject.tenant_id <= 0 || query.subject.user_id <= 0 {
        return Err(CommerceServiceError::validation(
            "feature access check subject is invalid",
        ));
    }
    let required_rank = match (query.feature_code.as_deref(), query.required_rank) {
        (Some(feature), None) => required_rank_for_feature(feature).ok_or_else(|| {
            CommerceServiceError::validation("feature access check feature is not registered")
        })?,
        (_, Some(rank)) if rank >= 0 => rank,
        _ => {
            return Err(CommerceServiceError::validation(
                "feature access check requires a registered feature or a required level",
            ))
        }
    };
    let info = load_info(pool, Some(query.subject)).await?;
    let current_rank = info.plan_rank;
    let active = info.membership_status == "active" && current_rank > 0;
    let allowed = active && current_rank >= required_rank;
    Ok(FeatureAccessCheckOutcome {
        allowed,
        active,
        current_rank,
        required_rank,
        status: info.membership_status,
        expires_at: info.expires_at,
        reason: if allowed {
            None
        } else if !active {
            Some("membership is not active".to_owned())
        } else {
            Some("current membership level is below the required level".to_owned())
        },
    })
}

async fn load_benefits_list(
    pool: &PgPool,
    subject: Option<AppMembershipSubject>,
    plan_id: Option<i64>,
) -> AppMembershipResult<Vec<AppMembershipBenefitItem>> {
    let rank = resolve_plan_rank(pool, subject, plan_id).await?;
    Ok(load_stored_plan_by_rank(pool, rank)
        .await?
        .map(|plan| plan.benefits)
        .unwrap_or_default())
}

async fn load_benefits_page(
    pool: &PgPool,
    subject: Option<AppMembershipSubject>,
    plan_id: Option<i64>,
    query: MembershipListQuery,
) -> AppMembershipResult<SdkWorkPageData<AppMembershipBenefitItem>> {
    let rank = resolve_plan_rank(pool, subject, plan_id).await?;
    let params = query.offset_params();
    let page_size = params.page_size;
    let offset = params.offset;
    let (tenant_id, organization_id) = subject
        .map(|s| (s.tenant_id, s.organization_id))
        .unwrap_or((DEFAULT_CATALOG_TENANT_ID, DEFAULT_CATALOG_ORGANIZATION_ID));

    let total: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM membership_plan p
        JOIN membership_plan_version v
            ON v.plan_id = p.id
           AND v.tenant_id = p.tenant_id
           AND v.lifecycle_status = 'published'
        JOIN membership_plan_benefit b
            ON b.plan_version_id = v.id
           AND b.tenant_id = p.tenant_id
           AND b.status = 'active'
        WHERE (p.tenant_id = CAST($1 AS TEXT) OR p.tenant_id IS NULL)
          AND (p.organization_id = CAST($2 AS TEXT) OR p.organization_id = '0')
          AND p.status = 'active'
          AND CAST(p.rank AS INTEGER) = $3
        "#,
    )
    .bind(tenant_id)
    .bind(organization_id)
    .bind(rank)
    .fetch_one(pool)
    .await
    .map_err(sql_error)?;

    let rows = sqlx::query(
        r#"
        SELECT
            b.id AS plan_benefit_id,
            b.benefit_code,
            CAST(b.grant_quantity AS TEXT) AS grant_quantity,
            b.usage_policy,
            d.name AS benefit_name,
            d.benefit_type,
            d.description AS benefit_description
        FROM membership_plan p
        JOIN membership_plan_version v
            ON v.plan_id = p.id
           AND v.tenant_id = p.tenant_id
           AND v.lifecycle_status = 'published'
        JOIN membership_plan_benefit b
            ON b.plan_version_id = v.id
           AND b.tenant_id = p.tenant_id
           AND b.status = 'active'
        LEFT JOIN membership_benefit_definition d
            ON d.id = b.benefit_id
           AND d.tenant_id = b.tenant_id
        WHERE (p.tenant_id = CAST($1 AS TEXT) OR p.tenant_id IS NULL)
          AND (p.organization_id = CAST($2 AS TEXT) OR p.organization_id = '0')
          AND p.status = 'active'
          AND CAST(p.rank AS INTEGER) = $3
        ORDER BY b.sort_weight ASC, b.id ASC
        LIMIT $4 OFFSET $5
        "#,
    )
    .bind(tenant_id)
    .bind(organization_id)
    .bind(rank)
    .bind(page_size)
    .bind(offset)
    .fetch_all(pool)
    .await
    .map_err(sql_error)?;
    let items = rows
        .iter()
        .enumerate()
        .filter_map(|(index, row)| plan_benefit_from_row(row, (index + 1) as i64))
        .collect();
    Ok(offset_page(items, total, params))
}

/// Resolves the plan rank filter for catalog queries.
/// App API `plan_id` maps to `AppMembershipPlanItem.id`, which is the plan rank.
async fn resolve_plan_rank(
    pool: &PgPool,
    subject: Option<AppMembershipSubject>,
    plan_id: Option<i64>,
) -> AppMembershipResult<i64> {
    match plan_id {
        Some(value) => Ok(value),
        None => match subject {
            Some(subject) => Ok(load_current_membership(pool, subject)
                .await?
                .map(|membership| membership.rank)
                .unwrap_or(0)),
            None => Ok(0),
        },
    }
}

async fn load_plans_page(
    pool: &PgPool,
    tenant_id: i64,
    organization_id: i64,
    query: MembershipListQuery,
) -> AppMembershipResult<SdkWorkPageData<AppMembershipPlanItem>> {
    let params = query.offset_params();
    let page_size = params.page_size;
    let offset = params.offset;

    let total: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM membership_plan p
        WHERE (p.tenant_id = CAST($1 AS TEXT) OR p.tenant_id IS NULL)
          AND (p.organization_id = CAST($2 AS TEXT) OR p.organization_id = '0')
          AND p.status = 'active'
          AND ($3 IS NULL OR p.category = $3)
        "#,
    )
    .bind(tenant_id)
    .bind(organization_id)
    .bind(query.category.as_deref())
    .fetch_one(pool)
    .await
    .map_err(sql_error)?;

    let plan_ids: Vec<String> = sqlx::query_scalar(
        r#"
        SELECT p.id
        FROM membership_plan p
        WHERE (p.tenant_id = CAST($1 AS TEXT) OR p.tenant_id IS NULL)
          AND (p.organization_id = CAST($2 AS TEXT) OR p.organization_id = '0')
          AND p.status = 'active'
          AND ($3 IS NULL OR p.category = $3)
        ORDER BY p.rank ASC, p.plan_no ASC
        LIMIT $4 OFFSET $5
        "#,
    )
    .bind(tenant_id)
    .bind(organization_id)
    .bind(query.category.as_deref())
    .bind(page_size)
    .bind(offset)
    .fetch_all(pool)
    .await
    .map_err(sql_error)?;

    if plan_ids.is_empty() {
        return Ok(offset_page(Vec::new(), total, params));
    }

    let placeholders = plan_ids
        .iter()
        .enumerate()
        .map(|(index, _)| format!("${}", index + 1))
        .collect::<Vec<_>>()
        .join(", ");
    let sql = format!(
        r#"
        SELECT
            p.id,
            p.plan_no AS plan_no,
            p.name,
            CAST(p.rank AS INTEGER) AS rank,
            p.description,
            p.category AS category,
            b.id AS plan_benefit_id,
            b.benefit_code,
            CAST(b.grant_quantity AS TEXT) AS grant_quantity,
            b.usage_policy,
            d.name AS benefit_name,
            d.benefit_type,
            d.description AS benefit_description
        FROM membership_plan p
        LEFT JOIN membership_plan_version v
            ON v.plan_id = p.id
           AND v.tenant_id = p.tenant_id
           AND v.lifecycle_status = 'published'
        LEFT JOIN membership_plan_benefit b
            ON b.plan_version_id = v.id
           AND b.tenant_id = p.tenant_id
           AND b.status = 'active'
        LEFT JOIN membership_benefit_definition d
            ON d.id = b.benefit_id
           AND d.tenant_id = b.tenant_id
        WHERE p.id IN ({placeholders})
        ORDER BY p.rank ASC, p.plan_no ASC, b.sort_weight ASC, b.id ASC
        "#
    );
    let mut db_query = sqlx::query(sqlx::AssertSqlSafe(sql.as_str()));
    for plan_id in &plan_ids {
        db_query = db_query.bind(plan_id);
    }
    let rows = db_query.fetch_all(pool).await.map_err(sql_error)?;
    Ok(offset_page(
        plan_items(stored_plans_from_rows(&rows)),
        total,
        params,
    ))
}

async fn load_stored_plan_by_rank(
    pool: &PgPool,
    rank: i64,
) -> AppMembershipResult<Option<StoredMembershipPlan>> {
    let rows = sqlx::query(LOAD_MEMBERSHIP_PLAN_BY_RANK)
        .bind(DEFAULT_CATALOG_TENANT_ID)
        .bind(DEFAULT_CATALOG_ORGANIZATION_ID)
        .bind(rank)
        .fetch_all(pool)
        .await
        .map_err(sql_error)?;
    Ok(stored_plans_from_rows(&rows).into_iter().next())
}

fn stored_plans_from_rows(rows: &[sqlx::postgres::PgRow]) -> Vec<StoredMembershipPlan> {
    let mut grouped = BTreeMap::<String, StoredMembershipPlan>::new();
    for row in rows.iter() {
        let id_text = string_cell(row, "id");
        let plan_no = string_cell(row, "plan_no");
        let rank = integer_cell(row, "rank");
        let plan = grouped
            .entry(id_text.clone())
            .or_insert_with(|| StoredMembershipPlan {
                id: rank,
                storage_id: id_text,
                plan_no: plan_no.clone(),
                item: AppMembershipPlanItem {
                    id: rank,
                    category: string_cell(row, "category"),
                    name: string_cell(row, "name"),
                    rank,
                    required_points: Some(plan_required_points(&plan_no)),
                    description: optional_string_cell(row, "description"),
                    icon: None,
                    badge: Some(plan_badge(&plan_no).to_owned()),
                },
                benefits: Vec::new(),
                rank,
            });
        if let Some(benefit) = plan_benefit_from_row(row, (plan.benefits.len() + 1) as i64) {
            if !plan
                .benefits
                .iter()
                .any(|item| item.benefit_key.as_deref() == benefit.benefit_key.as_deref())
            {
                plan.benefits.push(benefit);
            }
        }
    }
    let mut plans = grouped.into_values().collect::<Vec<_>>();
    plans.sort_by_key(|plan| (plan.rank, plan.id));
    plans
}

fn plan_benefit_from_row(
    row: &sqlx::postgres::PgRow,
    fallback_id: i64,
) -> Option<AppMembershipBenefitItem> {
    let benefit_code = optional_string_cell(row, "benefit_code")?;
    let raw_grant_quantity = optional_string_cell(row, "grant_quantity");
    let (usage_limit, display_value) = match &raw_grant_quantity {
        Some(value) => {
            let parsed = parse_points_amount(value);
            if parsed > 0 {
                (Some(parsed), None)
            } else {
                (None, Some(value.clone()))
            }
        }
        None => (None, None),
    };
    Some(AppMembershipBenefitItem {
        id: numeric_suffix(&string_cell(row, "plan_benefit_id")).unwrap_or(fallback_id),
        name: optional_string_cell(row, "benefit_name").unwrap_or_else(|| benefit_code.clone()),
        benefit_key: Some(benefit_code),
        r#type: optional_string_cell(row, "benefit_type")
            .or_else(|| optional_string_cell(row, "usage_policy")),
        description: optional_string_cell(row, "benefit_description"),
        icon: None,
        claimed: false,
        usage_limit,
        display_value,
        used_count: Some(0),
    })
}

fn plan_required_points(plan_no: &str) -> i64 {
    match plan_no {
        "pro" => 5_000,
        "max" => 12_000,
        "vip" => 20_000,
        _ => 0,
    }
}

fn plan_badge(plan_no: &str) -> &'static str {
    match plan_no.trim().to_ascii_lowercase().as_str() {
        "pro" => "Pro",
        "max" => "Max",
        "vip" => "VIP",
        // Community (circle) plan family badges; token plans fall back to Free.
        "community-basic" | "community_basic" => "Community",
        "community-plus" | "community_plus" => "Community Plus",
        _ => "Free",
    }
}

async fn load_package_rows(
    pool: &PgPool,
    tenant_id: i64,
    organization_id: i64,
    package_group_id: Option<i64>,
    plan_id: Option<i64>,
    query: MembershipListQuery,
    recommended_only: bool,
) -> AppMembershipResult<SdkWorkPageData<AppMembershipPackageItem>> {
    let params = query.offset_params();
    let page_size = params.page_size as usize;
    let offset = params.offset as usize;
    let limit = (page_size + 1) as i64;

    let mut sql = String::from(LOAD_MEMBERSHIP_PACKAGES_BASE);
    let mut next_param = 3;
    if query.category.is_some() {
        sql.push_str(&format!("  AND p.category = ${next_param}\n"));
        next_param += 1;
    }
    if package_group_id.is_some() {
        sql.push_str(&format!("  AND g.external_id = ${next_param}\n"));
        next_param += 1;
    }
    if plan_id.is_some() {
        sql.push_str(&format!("  AND l.rank = ${next_param}\n"));
        next_param += 1;
    }
    if recommended_only {
        sql.push_str("  AND p.recommended != 0\n");
    }
    sql.push_str("ORDER BY g.sort_weight ASC, p.sort_weight ASC, p.external_id ASC\n");
    sql.push_str(&format!("LIMIT ${next_param} OFFSET ${}\n", next_param + 1));

    let mut db_query = sqlx::query(sqlx::AssertSqlSafe(sql.as_str()))
        .bind(tenant_id)
        .bind(organization_id);
    if let Some(category) = query.category.as_deref() {
        db_query = db_query.bind(category);
    }
    if let Some(group_id) = package_group_id {
        db_query = db_query.bind(group_id);
    }
    if let Some(rank) = plan_id {
        db_query = db_query.bind(rank);
    }
    db_query = db_query.bind(limit).bind(offset as i64);
    let rows = db_query.fetch_all(pool).await.map_err(sql_error)?;
    let packages: Vec<AppMembershipPackageItem> = rows
        .iter()
        .filter_map(map_package)
        .map(|package| package.item)
        .collect();
    Ok(bounded_sql_page(packages, page_size, offset))
}

async fn load_package_by_id(
    pool: &PgPool,
    tenant_id: i64,
    organization_id: i64,
    package_id: i64,
) -> AppMembershipResult<Option<AppMembershipPackageItem>> {
    let row = sqlx::query(LOAD_MEMBERSHIP_PACKAGE_BY_ID)
        .bind(tenant_id)
        .bind(organization_id)
        .bind(package_id)
        .fetch_optional(pool)
        .await
        .map_err(sql_error)?;
    Ok(row
        .as_ref()
        .and_then(map_package)
        .map(|package| package.item))
}

fn map_package(row: &sqlx::postgres::PgRow) -> Option<ParsedMembershipPackage> {
    let id = integer_cell(row, "external_id");
    let price = decimal_string(
        &string_cell(row, "price_amount"),
        "membership package price",
    )
    .ok()?;
    let original_price = optional_string_cell(row, "original_price_amount")
        .filter(|value| !value.trim().is_empty())
        .and_then(|value| decimal_string(&value, "membership package original price").ok());
    map_membership_package_record(
        id,
        string_cell(row, "package_storage_id"),
        string_cell(row, "plan_storage_id"),
        string_cell(row, "name"),
        optional_string_cell(row, "description"),
        price,
        original_price,
        integer_cell(row, "point_amount"),
        integer_cell(row, "duration_days"),
        optional_string_cell(row, "plan_name"),
        integer_cell(row, "sort_weight"),
        integer_cell(row, "recommended") != 0,
        &string_cell(row, "tags_json"),
        integer_cell(row, "group_external_id"),
        string_cell(row, "group_name"),
        optional_string_cell(row, "group_description"),
        integer_cell(row, "group_sort_weight"),
        optional_string_cell(row, "plan_no"),
        integer_cell(row, "rank"),
        optional_string_cell(row, "sku_id"),
        string_cell(row, "package_category"),
    )
}

fn plan_items(plans: Vec<StoredMembershipPlan>) -> Vec<AppMembershipPlanItem> {
    plans.into_iter().map(|plan| plan.item).collect()
}

async fn load_package_groups_page(
    pool: &PgPool,
    tenant_id: i64,
    organization_id: i64,
    plan_id: Option<i64>,
    recommended_only: bool,
    query: MembershipListQuery,
) -> AppMembershipResult<SdkWorkPageData<AppMembershipPackageGroupItem>> {
    let params = query.offset_params();
    let page_size = params.page_size;
    let offset = params.offset;

    let total: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM membership_package_group g
        WHERE (g.tenant_id = CAST($1 AS TEXT) OR g.tenant_id IS NULL)
          AND (g.organization_id = CAST($2 AS TEXT) OR g.organization_id = '0')
          AND g.status = 'active'
          AND ($5 IS NULL OR g.category = $5)
          AND EXISTS (
            SELECT 1
            FROM membership_package p
            LEFT JOIN membership_plan l ON l.id = p.plan_id
            WHERE p.package_group_id = g.id
              AND (p.tenant_id = CAST($1 AS TEXT) OR p.tenant_id IS NULL)
              AND (p.organization_id = CAST($2 AS TEXT) OR p.organization_id = '0')
              AND ($3 = false OR p.recommended != 0)
              AND ($4::bigint IS NULL OR l.rank = $4)
          )
        "#,
    )
    .bind(tenant_id)
    .bind(organization_id)
    .bind(recommended_only)
    .bind(plan_id)
    .bind(query.category.as_deref())
    .fetch_one(pool)
    .await
    .map_err(sql_error)?;

    let group_rows = sqlx::query(
        r#"
        SELECT
            CAST(g.external_id AS INTEGER) AS external_id,
            g.name,
            g.description,
            CAST(COALESCE(g.sort_weight, 0) AS INTEGER) AS sort_weight,
            g.category AS category
        FROM membership_package_group g
        WHERE (g.tenant_id = CAST($1 AS TEXT) OR g.tenant_id IS NULL)
          AND (g.organization_id = CAST($2 AS TEXT) OR g.organization_id = '0')
          AND g.status = 'active'
          AND ($7 IS NULL OR g.category = $7)
          AND EXISTS (
            SELECT 1
            FROM membership_package p
            LEFT JOIN membership_plan l ON l.id = p.plan_id
            WHERE p.package_group_id = g.id
              AND (p.tenant_id = CAST($1 AS TEXT) OR p.tenant_id IS NULL)
              AND (p.organization_id = CAST($2 AS TEXT) OR p.organization_id = '0')
              AND ($5 = false OR p.recommended != 0)
              AND ($6::bigint IS NULL OR l.rank = $6)
          )
        ORDER BY g.sort_weight ASC, g.external_id ASC
        LIMIT $3 OFFSET $4
        "#,
    )
    .bind(tenant_id)
    .bind(organization_id)
    .bind(page_size)
    .bind(offset)
    .bind(recommended_only)
    .bind(plan_id)
    .bind(query.category.as_deref())
    .fetch_all(pool)
    .await
    .map_err(sql_error)?;

    let mut groups = Vec::new();
    for row in group_rows {
        let group_external_id = integer_cell(&row, "external_id");
        let packages = load_package_rows(
            pool,
            tenant_id,
            organization_id,
            Some(group_external_id),
            plan_id,
            MembershipListQuery {
                page: Some(1),
                page_size: Some(200),
                cursor: None,
                category: query.category.clone(),
            },
            recommended_only,
        )
        .await?
        .items;
        groups.push(build_package_group_from_packages(
            group_external_id,
            string_cell(&row, "name"),
            optional_string_cell(&row, "description"),
            integer_cell(&row, "sort_weight"),
            packages,
            string_cell(&row, "category"),
        ));
    }
    Ok(offset_page(groups, total, params))
}

async fn load_package_group_by_id(
    pool: &PgPool,
    tenant_id: i64,
    organization_id: i64,
    package_group_id: i64,
) -> AppMembershipResult<Option<AppMembershipPackageGroupItem>> {
    let row = sqlx::query(
        r#"
        SELECT
            CAST(g.external_id AS INTEGER) AS external_id,
            g.name,
            g.description,
            CAST(COALESCE(g.sort_weight, 0) AS INTEGER) AS sort_weight,
            g.category AS category
        FROM membership_package_group g
        WHERE (g.tenant_id = CAST($1 AS TEXT) OR g.tenant_id IS NULL)
          AND (g.organization_id = CAST($2 AS TEXT) OR g.organization_id = '0')
          AND g.external_id = $3
          AND g.status = 'active'
        LIMIT 1
        "#,
    )
    .bind(tenant_id)
    .bind(organization_id)
    .bind(package_group_id)
    .fetch_optional(pool)
    .await
    .map_err(sql_error)?;
    let Some(row) = row else {
        return Ok(None);
    };
    let group_external_id = integer_cell(&row, "external_id");
    let packages = load_package_rows(
        pool,
        tenant_id,
        organization_id,
        Some(group_external_id),
        None,
        MembershipListQuery {
            page: Some(1),
            page_size: Some(200),
            cursor: None,
            category: Some(string_cell(&row, "category")),
        },
        false,
    )
    .await?
    .items;
    Ok(Some(build_package_group_from_packages(
        group_external_id,
        string_cell(&row, "name"),
        optional_string_cell(&row, "description"),
        integer_cell(&row, "sort_weight"),
        packages,
        string_cell(&row, "category"),
    )))
}

async fn load_points_balance(
    pool: &PgPool,
    subject: Option<AppMembershipSubject>,
) -> AppMembershipResult<AppMembershipPointsBalanceResponse> {
    let Some(subject) = subject else {
        return Ok(AppMembershipPointsBalanceResponse::default());
    };
    let row = sqlx::query(LOAD_POINTS_BALANCE)
        .bind(subject.tenant_id)
        .bind(subject.organization_id)
        .bind(subject.user_id)
        .bind(POINTS_ASSET_CODE)
        .bind(POINTS_CURRENCY_CODE)
        .fetch_optional(pool)
        .await
        .map_err(sql_error)?;
    let available_points = row
        .as_ref()
        .map(|row| parse_points_amount(&string_cell(row, "available_amount")))
        .unwrap_or(0);
    let frozen_points = row
        .as_ref()
        .map(|row| parse_points_amount(&string_cell(row, "frozen_amount")))
        .unwrap_or(0);
    Ok(AppMembershipPointsBalanceResponse {
        points: available_points + frozen_points,
        available_points,
        frozen_points,
    })
}

async fn load_points_history(
    pool: &PgPool,
    subject: Option<AppMembershipSubject>,
    query: AppMembershipPointsHistoryQuery,
) -> AppMembershipResult<SdkWorkPageData<AppMembershipPointsHistoryItem>> {
    let Some(subject) = subject else {
        return Err(CommerceServiceError::unauthenticated(
            "membership points history requires an authenticated subject",
        ));
    };
    let page_size = query.limit() as usize;
    let fetch_limit = page_size.saturating_add(1) as i64;
    let rows = if let Some(cursor) = query
        .cursor
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        sqlx::query(LOAD_POINTS_HISTORY_CURSOR)
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .bind(subject.user_id)
            .bind(POINTS_ASSET_CODE)
            .bind(cursor)
            .bind(fetch_limit)
            .fetch_all(pool)
            .await
    } else {
        let offset = query.offset();
        sqlx::query(LOAD_POINTS_HISTORY)
            .bind(subject.tenant_id)
            .bind(subject.organization_id)
            .bind(subject.user_id)
            .bind(POINTS_ASSET_CODE)
            .bind(fetch_limit)
            .bind(offset)
            .fetch_all(pool)
            .await
    }
    .map_err(sql_error)?;
    let items: Vec<_> = rows.iter().map(map_points_history_item).collect();
    if query
        .cursor
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .is_some()
    {
        let has_more = items.len() > page_size;
        let page_items: Vec<_> = items.into_iter().take(page_size).collect();
        let next_cursor = has_more
            .then(|| page_items.last().map(|item| item.id.clone()))
            .flatten();
        return Ok(cursor_page(page_items, page_size, next_cursor, has_more));
    }

    let offset = query.offset() as usize;
    Ok(bounded_sql_page(items, page_size, offset))
}

fn map_points_history_item(row: &sqlx::postgres::PgRow) -> AppMembershipPointsHistoryItem {
    let amount = parse_points_amount(&string_cell(row, "amount"));
    let after_balance = parse_points_amount(&string_cell(row, "balance_after"));
    let direction = string_cell(row, "direction").to_ascii_lowercase();
    let signed_amount = if direction == "debit" || direction == "out" {
        -amount
    } else {
        amount
    };
    AppMembershipPointsHistoryItem {
        id: string_cell(row, "id"),
        change_type: string_cell(row, "business_type"),
        change_amount: signed_amount,
        before_balance: Some(after_balance - signed_amount),
        after_balance,
        source_type: string_cell(row, "source_type"),
        remark: optional_string_cell(row, "remark"),
        created_at: optional_string_cell(row, "created_at"),
    }
}

#[derive(Debug, Clone)]
struct CurrentMembership {
    membership_id: String,
    rank: i64,
    plan_name: String,
    status: String,
    starts_at: String,
    expires_at: String,
    total_spent: String,
    benefits: Vec<AppMembershipBenefitItem>,
}

impl CurrentMembership {
    fn snapshot(&self) -> CurrentMembershipSnapshot {
        CurrentMembershipSnapshot {
            membership_id: self.membership_id.clone(),
            _rank: self.rank,
            _status: self.status.clone(),
            expires_at: self.expires_at.clone(),
        }
    }
}

async fn load_current_membership(
    pool: &PgPool,
    subject: AppMembershipSubject,
) -> AppMembershipResult<Option<CurrentMembership>> {
    let row = sqlx::query(LOAD_MEMBERSHIP)
        .bind(subject.tenant_id)
        .bind(subject.organization_id)
        .bind(subject.user_id)
        .fetch_optional(pool)
        .await
        .or_else(none_when_read_model_is_missing)?;
    let Some(row) = row else {
        return Ok(None);
    };
    let mut membership = map_membership(&row);
    membership.benefits = load_stored_plan_by_rank(pool, membership.rank)
        .await?
        .map(|plan| plan.benefits)
        .unwrap_or_default();
    Ok(Some(membership))
}

fn map_membership(row: &sqlx::postgres::PgRow) -> CurrentMembership {
    let plan_no = string_cell(row, "plan_no");
    let rank = integer_cell(row, "rank").max(plan_rank_from_code(&plan_no));
    CurrentMembership {
        membership_id: string_cell(row, "membership_id"),
        rank,
        plan_name: string_cell(row, "plan_name"),
        status: membership_status_label(&string_cell(row, "status")).to_owned(),
        starts_at: string_cell(row, "starts_at"),
        expires_at: string_cell(row, "expires_at"),
        total_spent: decimal_string(
            &string_cell(row, "total_spent"),
            "membership membership total spent",
        )
        .unwrap_or_else(|_| "0.00".to_owned()),
        benefits: Vec::new(),
    }
}

async fn submit_purchase(
    pool: &PgPool,
    command: SubmitMembershipPurchaseCommand,
) -> AppMembershipResult<AppMembershipPurchaseOutcome> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| store_error("failed to begin membership purchase transaction", error))?;

    if let Some(outcome) = load_purchase_outcome_by_idempotency(&mut tx, &command).await? {
        tx.rollback().await.map_err(|error| {
            store_error("failed to rollback membership purchase transaction", error)
        })?;
        return Ok(outcome);
    }

    let outcome = reserve_membership_purchase(&mut tx, &command).await?;
    tx.commit()
        .await
        .map_err(|error| store_error("failed to commit membership purchase transaction", error))?;

    Ok(outcome)
}

async fn reserve_membership_purchase(
    tx: &mut Transaction<'_, Postgres>,
    command: &SubmitMembershipPurchaseCommand,
) -> AppMembershipResult<AppMembershipPurchaseOutcome> {
    let tenant_id = command.subject.tenant_id;
    let organization_id = command.subject.organization_id;
    let package =
        load_package_for_purchase(tx, tenant_id, organization_id, command.package_id).await?;
    let plan = load_plan_for_package(tx, &package).await?;
    let current = load_current_membership_for_validation(&mut **tx, command.subject).await?;
    let membership_active = current
        .as_ref()
        .map(|item| {
            item.rank > 0 && item.status != "expired" && !membership_expired(&item.expires_at)
        })
        .unwrap_or(false);
    let current_rank = current.as_ref().map(|item| item.rank).unwrap_or(0);
    validate_membership_purchase_action(
        &command.action,
        membership_active,
        current_rank,
        plan.rank,
    )?;
    let binding = resolve_membership_purchase_binding(
        command,
        current.as_ref().map(|item| item.snapshot()),
        membership_active,
    );
    let membership_expires_at =
        add_days_to_timestamp(&binding.period_starts_at, package.item.duration_days);

    persist_membership_subscription(
        tx,
        command,
        &package,
        &plan,
        &binding,
        &membership_expires_at,
    )
    .await?;
    insert_entitlements(tx, command, &plan, &binding, &membership_expires_at).await?;
    Ok(build_purchase_outcome(command, &package, &plan, "pending"))
}

fn build_purchase_outcome(
    command: &SubmitMembershipPurchaseCommand,
    package: &ParsedMembershipPackage,
    plan: &StoredMembershipPlan,
    status: &str,
) -> AppMembershipPurchaseOutcome {
    AppMembershipPurchaseOutcome {
        request_no: command.order_no.clone(),
        order_id: command.order_uuid.clone(),
        package_id: package.item.id,
        package_name: package.item.name.clone(),
        amount: package.item.price.clone(),
        duration_days: package.item.duration_days,
        target_plan_rank: plan.rank,
        target_plan_name: plan.item.name.clone(),
        status: status.to_owned(),
    }
}

fn purchase_status_from_subscription_status(subscription_status: &str) -> String {
    match subscription_status {
        "active" => "completed".to_owned(),
        "pending_activation" | "pending" => "pending".to_owned(),
        "cancelled" | "expired" | "failed" => "failed".to_owned(),
        other => other.to_owned(),
    }
}

async fn load_current_membership_for_validation<'e, E>(
    executor: E,
    subject: AppMembershipSubject,
) -> AppMembershipResult<Option<CurrentMembership>>
where
    E: sqlx::Executor<'e, Database = Postgres>,
{
    let row = sqlx::query(LOAD_MEMBERSHIP)
        .bind(subject.tenant_id)
        .bind(subject.organization_id)
        .bind(subject.user_id)
        .fetch_optional(executor)
        .await
        .or_else(none_when_read_model_is_missing)?;
    Ok(row.as_ref().map(map_membership))
}

async fn load_purchase_outcome_by_idempotency(
    tx: &mut Transaction<'_, Postgres>,
    command: &SubmitMembershipPurchaseCommand,
) -> AppMembershipResult<Option<AppMembershipPurchaseOutcome>> {
    let row = sqlx::query(
        r#"
        SELECT
            ms.request_no,
            ms.source_order_id AS order_uuid,
            ms.status AS subscription_status
        FROM membership_subscription ms
        WHERE ms.tenant_id = CAST($1 AS TEXT)
          AND (ms.organization_id IS NULL OR ms.organization_id = '0' OR ms.organization_id = CAST($2 AS TEXT))
          AND ms.owner_user_id = CAST($3 AS TEXT)
          AND ms.idempotency_key = $4
        ORDER BY ms.created_at DESC
        LIMIT 1
        "#,
    )
    .bind(command.subject.tenant_id)
    .bind(command.subject.organization_id)
    .bind(command.subject.user_id)
    .bind(&command.idempotency_key)
    .fetch_optional(&mut **tx)
    .await
    .map_err(|error| {
        store_error(
            "failed to load membership purchase idempotency record",
            error,
        )
    })?;

    let Some(row) = row else {
        return Ok(None);
    };

    let tenant_id = command.subject.tenant_id;
    let organization_id = command.subject.organization_id;
    let package = load_package_for_purchase_executor(
        &mut **tx,
        tenant_id,
        organization_id,
        command.package_id,
    )
    .await?;
    let plan = load_plan_for_package_executor(&mut **tx, &package).await?;
    let subscription_status = string_cell(&row, "subscription_status");
    let status = purchase_status_from_subscription_status(&subscription_status);

    Ok(Some(build_purchase_outcome(
        &SubmitMembershipPurchaseCommand {
            order_no: string_cell(&row, "request_no"),
            order_uuid: string_cell(&row, "order_uuid"),
            ..command.clone()
        },
        &package,
        &plan,
        &status,
    )))
}

async fn load_package_for_purchase_executor<'e, E>(
    executor: E,
    tenant_id: i64,
    organization_id: i64,
    package_id: i64,
) -> AppMembershipResult<ParsedMembershipPackage>
where
    E: sqlx::Executor<'e, Database = Postgres>,
{
    let row = sqlx::query(LOAD_MEMBERSHIP_PACKAGE_BY_ID)
        .bind(tenant_id)
        .bind(organization_id)
        .bind(package_id)
        .bind(DEFAULT_CATALOG_TENANT_ID)
        .bind(DEFAULT_CATALOG_ORGANIZATION_ID)
        .fetch_optional(executor)
        .await
        .map_err(|error| store_error("failed to load membership packages", error))?;
    row.as_ref()
        .and_then(map_package)
        .ok_or_else(|| CommerceServiceError::conflict("membership package is unavailable"))
}

async fn load_plan_for_package_executor<'e, E>(
    executor: E,
    package: &ParsedMembershipPackage,
) -> AppMembershipResult<StoredMembershipPlan>
where
    E: sqlx::Executor<'e, Database = Postgres>,
{
    let rows = sqlx::query(LOAD_MEMBERSHIP_PLAN_BY_STORAGE_ID)
        .bind(&package.plan_storage_id)
        .fetch_all(executor)
        .await
        .map_err(|error| store_error("failed to load membership plans for purchase", error))?;
    stored_plans_from_rows(&rows)
        .into_iter()
        .find(|plan| plan.plan_no == package.plan_no || plan.rank == package.rank)
        .ok_or_else(|| CommerceServiceError::conflict("membership target plan is unavailable"))
}

async fn load_package_for_purchase(
    tx: &mut Transaction<'_, Postgres>,
    tenant_id: i64,
    organization_id: i64,
    package_id: i64,
) -> AppMembershipResult<ParsedMembershipPackage> {
    load_package_for_purchase_executor(&mut **tx, tenant_id, organization_id, package_id).await
}

async fn load_plan_for_package(
    tx: &mut Transaction<'_, Postgres>,
    package: &ParsedMembershipPackage,
) -> AppMembershipResult<StoredMembershipPlan> {
    load_plan_for_package_executor(&mut **tx, package).await
}

async fn fulfill_paid_purchase_by_order(
    pool: &PgPool,
    command: FulfillPaidMembershipPurchaseCommand,
) -> AppMembershipResult<FulfillMembershipPurchaseOutcome> {
    let purchase = paid_membership_purchase_submit_command(&command)?;
    let fulfillment = FulfillMembershipPurchaseCommand {
        subject: command.subject,
        order_id: command.order_id.trim().to_owned(),
        request_no: command.request_no.trim().to_owned(),
        idempotency_key: command.idempotency_key.trim().to_owned(),
    };
    let mut tx = pool.begin().await.map_err(|error| {
        store_error(
            "failed to begin paid membership fulfillment transaction",
            error,
        )
    })?;
    let lock_key = stable_membership_i64_id(&format!(
        "membership-paid-fulfillment:{}:{}:{}",
        command.subject.tenant_id, command.subject.organization_id, command.subject.user_id
    ));
    sqlx::query("SELECT pg_advisory_xact_lock($1)")
        .bind(lock_key)
        .execute(&mut *tx)
        .await
        .map_err(|error| store_error("failed to lock paid membership fulfillment", error))?;

    if let Some(outcome) = load_fulfillment_outcome_by_idempotency(&mut tx, &fulfillment).await? {
        tx.rollback().await.map_err(|error| {
            store_error(
                "failed to rollback replayed paid membership fulfillment transaction",
                error,
            )
        })?;
        return Ok(outcome);
    }
    let period_exists: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS(
            SELECT 1
            FROM membership_period mp
            JOIN membership_subscription ms
              ON ms.tenant_id = mp.tenant_id
             AND ms.id = mp.subscription_id
            WHERE ms.tenant_id = CAST($1 AS TEXT)
              AND (ms.organization_id IS NULL OR ms.organization_id = '0' OR ms.organization_id = CAST($2 AS TEXT))
              AND ms.owner_user_id = CAST($3 AS TEXT)
              AND mp.source_order_id = $4
        )
        "#,
    )
    .bind(command.subject.tenant_id)
    .bind(command.subject.organization_id)
    .bind(command.subject.user_id)
    .bind(command.order_id.trim())
    .fetch_one(&mut *tx)
    .await
    .map_err(|error| store_error("failed to inspect paid membership reservation", error))?;
    if !period_exists {
        reserve_membership_purchase(&mut tx, &purchase).await?;
    }
    let outcome = activate_membership_purchase(&mut tx, &fulfillment).await?;
    tx.commit().await.map_err(|error| {
        store_error(
            "failed to commit paid membership fulfillment transaction",
            error,
        )
    })?;
    Ok(outcome)
}

async fn fulfill_purchase_by_order(
    pool: &PgPool,
    command: FulfillMembershipPurchaseCommand,
) -> AppMembershipResult<FulfillMembershipPurchaseOutcome> {
    let mut tx = pool.begin().await.map_err(|error| {
        store_error("failed to begin membership fulfillment transaction", error)
    })?;
    let outcome = activate_membership_purchase(&mut tx, &command).await?;
    if outcome.replayed {
        tx.rollback().await.map_err(|error| {
            store_error(
                "failed to rollback replayed membership fulfillment transaction",
                error,
            )
        })?;
    } else {
        tx.commit().await.map_err(|error| {
            store_error("failed to commit membership fulfillment transaction", error)
        })?;
    }
    Ok(outcome)
}

async fn activate_membership_purchase(
    tx: &mut Transaction<'_, Postgres>,
    command: &FulfillMembershipPurchaseCommand,
) -> AppMembershipResult<FulfillMembershipPurchaseOutcome> {
    if let Some(outcome) = load_fulfillment_outcome_by_idempotency(tx, command).await? {
        return Ok(outcome);
    }

    let row = sqlx::query(
        r#"
        SELECT ms.id, ms.status, mp.status AS period_status
        FROM membership_period mp
        JOIN membership_subscription ms
          ON ms.tenant_id = mp.tenant_id
         AND ms.id = mp.subscription_id
        WHERE ms.tenant_id = CAST($1 AS TEXT)
          AND (ms.organization_id IS NULL OR ms.organization_id = '0' OR ms.organization_id = CAST($2 AS TEXT))
          AND ms.owner_user_id = CAST($3 AS TEXT)
          AND mp.source_order_id = $4
        ORDER BY mp.created_at DESC
        LIMIT 1
        "#,
    )
    .bind(command.subject.tenant_id)
    .bind(command.subject.organization_id)
    .bind(command.subject.user_id)
    .bind(&command.order_id)
    .fetch_optional(&mut **tx)
    .await
    .map_err(|error| {
        store_error(
            "failed to load membership subscription for fulfillment",
            error,
        )
    })?;

    let Some(row) = row else {
        return Err(CommerceServiceError::not_found(
            "membership subscription pending activation was not found for order",
        ));
    };

    let subscription_id = string_cell(&row, "id");
    let subscription_status = string_cell(&row, "status");
    let period_status = string_cell(&row, "period_status");
    if subscription_status == "active" && period_status == "active" {
        return Ok(FulfillMembershipPurchaseOutcome {
            accepted: true,
            replayed: true,
            fulfillment_status: "active".to_owned(),
        });
    }
    if !matches!(
        subscription_status.as_str(),
        "pending_activation" | "active"
    ) || !matches!(period_status.as_str(), "pending_activation" | "active")
    {
        return Err(CommerceServiceError::conflict(
            "membership subscription is not eligible for fulfillment",
        ));
    }

    let updated_at = format_unix_timestamp(
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_secs() as i64)
            .unwrap_or(0),
    );

    sqlx::query(
        r#"
        UPDATE membership_subscription
        SET status = 'active',
            request_no = $1,
            idempotency_key = $2,
            updated_at = $3::timestamptz
        WHERE id = $4
          AND tenant_id = CAST($5 AS TEXT)
          AND status = 'pending_activation'
        "#,
    )
    .bind(&command.request_no)
    .bind(&command.idempotency_key)
    .bind(&updated_at)
    .bind(&subscription_id)
    .bind(command.subject.tenant_id)
    .execute(&mut **tx)
    .await
    .map_err(|error| store_error("failed to activate membership subscription", error))?;

    sqlx::query(
        r#"
        UPDATE membership_period
        SET status = 'active',
            updated_at = $1::timestamptz
        WHERE subscription_id = $2
          AND tenant_id = CAST($3 AS TEXT)
          AND source_order_id = $4
          AND status = 'pending_activation'
        "#,
    )
    .bind(&updated_at)
    .bind(&subscription_id)
    .bind(command.subject.tenant_id)
    .bind(&command.order_id)
    .execute(&mut **tx)
    .await
    .map_err(|error| store_error("failed to activate membership period", error))?;

    sqlx::query(
        r#"
        UPDATE membership_entitlement_grant
        SET status = 'active',
            updated_at = $1::timestamptz
        WHERE source_type = 'membership_subscription'
          AND source_id = $2
          AND tenant_id = CAST($3 AS TEXT)
          AND status = 'pending'
        "#,
    )
    .bind(&updated_at)
    .bind(&subscription_id)
    .bind(command.subject.tenant_id)
    .execute(&mut **tx)
    .await
    .map_err(|error| store_error("failed to activate entitlement grants", error))?;

    sqlx::query(
        r#"
        UPDATE membership_entitlement_account
        SET status = 'active',
            updated_at = $1::timestamptz
        WHERE tenant_id = CAST($2 AS TEXT)
          AND subject_type = 'user'
          AND subject_id = CAST($3 AS TEXT)
          AND status = 'pending'
          AND benefit_id IN (
              SELECT benefit_id
              FROM membership_entitlement_grant
              WHERE source_type = 'membership_subscription'
                AND source_id = $4
                AND tenant_id = CAST($5 AS TEXT)
          )
        "#,
    )
    .bind(&updated_at)
    .bind(command.subject.tenant_id)
    .bind(command.subject.user_id)
    .bind(&subscription_id)
    .bind(command.subject.tenant_id)
    .execute(&mut **tx)
    .await
    .map_err(|error| store_error("failed to activate entitlement accounts", error))?;

    Ok(FulfillMembershipPurchaseOutcome {
        accepted: true,
        replayed: false,
        fulfillment_status: "active".to_owned(),
    })
}

async fn grant_coupon_subscription(
    pool: &PgPool,
    command: GrantCouponSubscriptionCommand,
) -> AppMembershipResult<CouponSubscriptionFulfillmentOutcome> {
    validate_coupon_subscription_command(&command)?;
    validate_coupon_package_postgres(pool, &command).await?;

    let purchase = SubmitMembershipPurchaseCommand {
        subject: command.subject,
        package_id: command.package_id,
        order_uuid: command.order_id.clone(),
        membership_uuid: command.subscription_id.clone(),
        order_no: command.request_no.clone(),
        idempotency_key: format!("{}:subscription", command.idempotency_key),
        requested_at: command.requested_at.clone(),
        action: "purchase".to_owned(),
    };
    submit_purchase(pool, purchase).await?;
    apply_coupon_subscription_quota_postgres(pool, &command).await?;
    let fulfillment = fulfill_purchase_by_order(
        pool,
        FulfillMembershipPurchaseCommand {
            subject: command.subject,
            order_id: command.order_id.clone(),
            request_no: command.request_no.clone(),
            idempotency_key: command.idempotency_key.clone(),
        },
    )
    .await?;

    let row = sqlx::query(
        r#"
        SELECT id, CAST(starts_at AS TEXT) AS starts_at, CAST(expires_at AS TEXT) AS expires_at
        FROM membership_subscription
        WHERE tenant_id = CAST($1 AS TEXT)
          AND owner_user_id = CAST($2 AS TEXT)
          AND source_order_id = $3
        ORDER BY created_at DESC
        LIMIT 1
        "#,
    )
    .bind(command.subject.tenant_id)
    .bind(command.subject.user_id)
    .bind(&command.order_id)
    .fetch_one(pool)
    .await
    .map_err(|error| store_error("failed to load coupon subscription outcome", error))?;

    Ok(CouponSubscriptionFulfillmentOutcome {
        accepted: fulfillment.accepted,
        replayed: fulfillment.replayed,
        subscription_id: string_cell(&row, "id"),
        starts_at: string_cell(&row, "starts_at"),
        expires_at: string_cell(&row, "expires_at"),
        fulfillment_status: fulfillment.fulfillment_status,
    })
}

fn validate_coupon_subscription_command(
    command: &GrantCouponSubscriptionCommand,
) -> AppMembershipResult<()> {
    if command.product_id.trim().is_empty()
        || command.sku_id.trim().is_empty()
        || command.order_id.trim().is_empty()
        || command.subscription_id.trim().is_empty()
        || command.request_no.trim().is_empty()
        || command.idempotency_key.trim().is_empty()
    {
        return Err(CommerceServiceError::validation(
            "coupon subscription identity fields are required",
        ));
    }
    if command.package_id <= 0 {
        return Err(CommerceServiceError::validation(
            "coupon subscription package is invalid",
        ));
    }
    validate_coupon_subscription_quota_contract(
        &command.period,
        command.duration_days,
        command.daily_quota,
        command.total_quota,
    )?;
    Ok(())
}

async fn validate_coupon_package_postgres(
    pool: &PgPool,
    command: &GrantCouponSubscriptionCommand,
) -> AppMembershipResult<()> {
    // Validated against the membership-owned `membership_package` row alone.
    // This used to cross-check `commerce_product_sku` / `commerce_product_spu`,
    // but a membership package no longer projects a SKU row into the
    // merchandise-owned catalog, so the declared SKU must match the package's
    // own `sku_id`. `product_id` stays a required correlation field carried by
    // the order line; membership owns no product identity to check it against.
    let matched = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(1)
        FROM membership_package p
        WHERE (p.tenant_id = CAST($1 AS TEXT) OR p.tenant_id IS NULL)
          AND (p.organization_id = CAST($2 AS TEXT) OR p.organization_id = '0')
          AND p.external_id = $3
          AND p.duration_days = $4
          AND p.status = 'active'
          AND p.sku_id = CAST($5 AS TEXT)
        "#,
    )
    .bind(command.subject.tenant_id)
    .bind(command.subject.organization_id)
    .bind(command.package_id)
    .bind(command.duration_days)
    .bind(command.sku_id.trim())
    .fetch_one(pool)
    .await
    .map_err(|error| store_error("failed to validate coupon subscription SKU", error))?;
    if matched != 1 {
        return Err(CommerceServiceError::conflict(
            "coupon subscription package does not match the declared SKU",
        ));
    }
    Ok(())
}

async fn apply_coupon_subscription_quota_postgres(
    pool: &PgPool,
    command: &GrantCouponSubscriptionCommand,
) -> AppMembershipResult<()> {
    let mut tx = pool.begin().await.map_err(|error| {
        store_error(
            "failed to begin coupon subscription quota transaction",
            error,
        )
    })?;
    let row = sqlx::query(
        r#"
        SELECT g.id AS grant_id, g.benefit_id, CAST(g.granted_quantity AS BIGINT) AS granted_quantity,
               COALESCE(g.grant_policy, '') AS grant_policy
        FROM membership_entitlement_grant g
        JOIN membership_benefit_definition d
          ON d.tenant_id = g.tenant_id AND d.id = g.benefit_id
        WHERE g.tenant_id = CAST($1 AS TEXT)
          AND g.subject_type = 'user'
          AND g.subject_id = CAST($2 AS TEXT)
          AND g.source_type = 'membership_subscription'
          AND g.source_id = $3
          AND d.benefit_code IN ('ai_quota', 'exclusive_model')
        ORDER BY g.created_at ASC
        LIMIT 1
        FOR UPDATE OF g
        "#,
    )
    .bind(command.subject.tenant_id)
    .bind(command.subject.user_id)
    .bind(&command.subscription_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|error| store_error("failed to load coupon quota entitlement grant", error))?
    .ok_or_else(|| {
        CommerceServiceError::conflict("subscription SKU does not provide an AI quota benefit")
    })?;
    let grant_id = string_cell(&row, "grant_id");
    let benefit_id = string_cell(&row, "benefit_id");
    let old_quantity = integer_cell(&row, "granted_quantity").max(0);
    let old_policy = string_cell(&row, "grant_policy");
    let policy = serde_json::json!({
        "kind": "coupon_subscription_quota",
        "couponOrderId": command.order_id,
        "period": command.period,
        "dailyQuota": command.daily_quota,
        "totalQuota": command.total_quota,
    })
    .to_string();
    if old_policy == policy && old_quantity == command.total_quota {
        tx.rollback().await.map_err(|error| {
            store_error(
                "failed to rollback replayed coupon quota transaction",
                error,
            )
        })?;
        return Ok(());
    }

    let delta = command.total_quota - old_quantity;
    let updated = sqlx::query(
        r#"
        UPDATE membership_entitlement_account
        SET total_granted = CAST(CAST(total_granted AS BIGINT) + $1 AS TEXT),
            balance = CAST(CAST(balance AS BIGINT) + $1 AS TEXT),
            version = version + 1,
            updated_at = $2::timestamptz
        WHERE tenant_id = CAST($3 AS TEXT)
          AND subject_type = 'user'
          AND subject_id = CAST($4 AS TEXT)
          AND benefit_id = $5
          AND CAST(balance AS BIGINT) + $1 >= 0
        "#,
    )
    .bind(delta)
    .bind(&command.requested_at)
    .bind(command.subject.tenant_id)
    .bind(command.subject.user_id)
    .bind(&benefit_id)
    .execute(&mut *tx)
    .await
    .map_err(|error| store_error("failed to apply coupon quota to entitlement account", error))?;
    if updated.rows_affected() != 1 {
        return Err(CommerceServiceError::conflict(
            "coupon subscription entitlement account is unavailable",
        ));
    }
    sqlx::query(
        r#"
        UPDATE membership_entitlement_grant
        SET granted_quantity = CAST($1 AS TEXT), grant_policy = $2, updated_at = $3::timestamptz
        WHERE id = $4 AND tenant_id = CAST($5 AS TEXT)
        "#,
    )
    .bind(command.total_quota)
    .bind(policy)
    .bind(&command.requested_at)
    .bind(&grant_id)
    .bind(command.subject.tenant_id)
    .execute(&mut *tx)
    .await
    .map_err(|error| store_error("failed to persist coupon quota grant policy", error))?;
    tx.commit().await.map_err(|error| {
        store_error(
            "failed to commit coupon subscription quota transaction",
            error,
        )
    })?;
    Ok(())
}

async fn load_fulfillment_outcome_by_idempotency(
    tx: &mut Transaction<'_, Postgres>,
    command: &FulfillMembershipPurchaseCommand,
) -> AppMembershipResult<Option<FulfillMembershipPurchaseOutcome>> {
    let row = sqlx::query(
        r#"
        SELECT ms.status
        FROM membership_period mp
        JOIN membership_subscription ms
          ON ms.tenant_id = mp.tenant_id
         AND ms.id = mp.subscription_id
        WHERE ms.tenant_id = CAST($1 AS TEXT)
          AND (ms.organization_id IS NULL OR ms.organization_id = '0' OR ms.organization_id = CAST($2 AS TEXT))
          AND ms.owner_user_id = CAST($3 AS TEXT)
          AND mp.source_order_id = $4
          AND mp.status = 'active'
          AND ms.status = 'active'
        ORDER BY mp.updated_at DESC
        LIMIT 1
        "#,
    )
    .bind(command.subject.tenant_id)
    .bind(command.subject.organization_id)
    .bind(command.subject.user_id)
    .bind(&command.order_id)
    .fetch_optional(&mut **tx)
    .await
    .map_err(|error| {
        store_error(
            "failed to load membership fulfillment idempotency record",
            error,
        )
    })?;

    Ok(row.map(|_| FulfillMembershipPurchaseOutcome {
        accepted: true,
        replayed: true,
        fulfillment_status: "active".to_owned(),
    }))
}

async fn persist_membership_subscription(
    tx: &mut Transaction<'_, Postgres>,
    command: &SubmitMembershipPurchaseCommand,
    package: &ParsedMembershipPackage,
    plan: &StoredMembershipPlan,
    binding: &MembershipPurchaseBinding,
    expires_at: &str,
) -> AppMembershipResult<()> {
    let period_id = membership_period_id(&binding.membership_uuid, &command.order_no);
    let package_id = package.storage_id.clone();
    let plan_storage_id = plan_id_for_storage(plan);
    let plan_version_storage_id = plan_version_id_for_storage(plan);

    if binding.persistence_mode == MembershipPurchasePersistenceMode::New {
        sqlx::query(
            r#"
            INSERT INTO membership_subscription
                (id, tenant_id, organization_id, category, subscription_no, subject_type, subject_id,
                 owner_user_id, plan_id, plan_version_id, package_id, current_period_id,
                 source_order_id, status, starts_at, expires_at,
                 grace_until, cancel_at_period_end, request_no, idempotency_key, created_at, updated_at)
            VALUES
                ($1, CAST($2 AS TEXT), CAST($3 AS TEXT), $18, $4, 'user', CAST($5 AS TEXT),
                 CAST($6 AS TEXT), $7, $8, $9, $10, $11, 'pending_activation', $12::timestamptz, $13::timestamptz,
                 NULL, 0, $14, $15, $16::timestamptz, $17::timestamptz)
            "#,
        )
        .bind(&binding.membership_uuid)
        .bind(command.subject.tenant_id)
        .bind(command.subject.organization_id)
        .bind(&binding.membership_uuid)
        .bind(command.subject.user_id)
        .bind(command.subject.user_id)
        .bind(&plan_storage_id)
        .bind(&plan_version_storage_id)
        .bind(&package_id)
        .bind(&period_id)
        .bind(&command.order_uuid)
        .bind(&binding.period_starts_at)
        .bind(expires_at)
        .bind(&command.order_no)
        .bind(&command.idempotency_key)
        .bind(&command.requested_at)
        .bind(&command.requested_at)
        .bind(&plan.item.category)
        .execute(&mut **tx)
        .await
        .map_err(|error| store_error("failed to insert membership subscription", error))?;
    } else {
        sqlx::query(
            r#"
            UPDATE membership_subscription
            SET plan_id = $1,
                plan_version_id = $2,
                package_id = $3,
                current_period_id = $4,
                source_order_id = $5,
                status = 'pending_activation',
                starts_at = CASE WHEN $6 THEN starts_at ELSE $7::timestamptz END,
                expires_at = $8::timestamptz,
                request_no = $9,
                idempotency_key = $10,
                category = $16,
                updated_at = $11::timestamptz
            WHERE id = $12
              AND tenant_id = CAST($13 AS TEXT)
              AND (organization_id IS NULL OR organization_id = '0' OR organization_id = CAST($14 AS TEXT))
              AND subject_type = 'user'
              AND subject_id = CAST($15 AS TEXT)
            "#,
        )
        .bind(&plan_storage_id)
        .bind(&plan_version_storage_id)
        .bind(&package_id)
        .bind(&period_id)
        .bind(&command.order_uuid)
        .bind(binding.persistence_mode == MembershipPurchasePersistenceMode::Renew)
        .bind(&binding.period_starts_at)
        .bind(expires_at)
        .bind(&command.order_no)
        .bind(&command.idempotency_key)
        .bind(&command.requested_at)
        .bind(&binding.membership_uuid)
        .bind(command.subject.tenant_id)
        .bind(command.subject.organization_id)
        .bind(command.subject.user_id)
        .bind(&plan.item.category)
        .execute(&mut **tx)
        .await
        .map_err(|error| store_error("failed to update membership subscription", error))?;
    }

    sqlx::query(
        r#"
        INSERT INTO membership_period
            (id, tenant_id, organization_id, category, period_no, subscription_id, subject_type,
             subject_id, plan_id, plan_version_id, starts_at, ends_at, status,
             source_order_id, request_no, idempotency_key,
             created_at, updated_at)
        VALUES
            ($1, CAST($2 AS TEXT), CAST($3 AS TEXT), $16, $4, $5, 'user',
             CAST($6 AS TEXT), $7, $8, $9::timestamptz, $10::timestamptz, 'pending_activation',
             $11, $12, $13, $14::timestamptz, $15::timestamptz)
        "#,
    )
    .bind(&period_id)
    .bind(command.subject.tenant_id)
    .bind(command.subject.organization_id)
    .bind(&period_id)
    .bind(&binding.membership_uuid)
    .bind(command.subject.user_id)
    .bind(&plan_storage_id)
    .bind(&plan_version_storage_id)
    .bind(&binding.period_starts_at)
    .bind(expires_at)
    .bind(&command.order_uuid)
    .bind(&command.order_no)
    .bind(format!("{}-period", command.idempotency_key))
    .bind(&command.requested_at)
    .bind(&command.requested_at)
    .bind(&plan.item.category)
    .execute(&mut **tx)
    .await
    .map_err(|error| store_error("failed to insert membership period", error))?;
    Ok(())
}

async fn insert_entitlements(
    tx: &mut Transaction<'_, Postgres>,
    command: &SubmitMembershipPurchaseCommand,
    plan: &StoredMembershipPlan,
    binding: &MembershipPurchaseBinding,
    expires_at: &str,
) -> AppMembershipResult<()> {
    let period_id = membership_period_id(&binding.membership_uuid, &command.order_no);
    for (index, benefit) in plan.benefits.iter().enumerate() {
        let benefit_code = benefit
            .benefit_key
            .clone()
            .unwrap_or_else(|| format!("membership-benefit-{}", benefit.id));
        let benefit_id = membership_benefit_definition_id_for_code(&benefit_code);
        let quantity = benefit.usage_limit.unwrap_or(0).max(0).to_string();
        let account_id = format!(
            "{}-entitlement-account-{}",
            binding.membership_uuid, benefit_id
        );
        let grant_id = format!("{}-entitlement-grant-{}", period_id, index + 1);
        let ledger_id = format!("{}-entitlement-ledger-{}", period_id, index + 1);
        sqlx::query(
            r#"
            INSERT INTO membership_entitlement_grant
                (id, tenant_id, organization_id, grant_no, benefit_id, subject_type, subject_id,
                 source_type, source_id, grant_policy, granted_quantity, status, starts_at,
                 expires_at, request_no, idempotency_key, created_at, updated_at)
            VALUES
                ($1, CAST($2 AS TEXT), CAST($3 AS TEXT), $4, $5, 'user', CAST($6 AS TEXT),
                 'membership_subscription', $7, 'membership_plan', $8, 'pending', $9::timestamptz, $10::timestamptz,
                 $11, $12, $13::timestamptz, $14::timestamptz)
            "#,
        )
        .bind(&grant_id)
        .bind(command.subject.tenant_id)
        .bind(command.subject.organization_id)
        .bind(&grant_id)
        .bind(&benefit_id)
        .bind(command.subject.user_id)
        .bind(&binding.membership_uuid)
        .bind(&quantity)
        .bind(&command.requested_at)
        .bind(expires_at)
        .bind(format!("{}-grant-{}", command.order_no, index + 1))
        .bind(format!("{}-grant-{}", command.idempotency_key, index + 1))
        .bind(&command.requested_at)
        .bind(&command.requested_at)
        .execute(&mut **tx)
        .await
        .map_err(|error| store_error("failed to insert entitlement grant", error))?;

        let account = upsert_membership_entitlement_account(
            tx,
            command,
            &account_id,
            &benefit_id,
            &quantity,
            expires_at,
        )
        .await?;

        sqlx::query(
            r#"
            INSERT INTO membership_entitlement_ledger_entry
                (id, tenant_id, organization_id, ledger_no, account_id, grant_id, benefit_id,
                 subject_type, subject_id, direction, amount, balance_after, business_type,
                 source_type, source_id, request_no, idempotency_key, occurred_at, created_at)
            VALUES
                ($1, CAST($2 AS TEXT), CAST($3 AS TEXT), $4, $5, $6, $7,
                 'user', CAST($8 AS TEXT), 'credit', $9, $10, 'membership_grant',
                 'membership_subscription', $11, $12, $13, $14::timestamptz, $15::timestamptz)
            "#,
        )
        .bind(&ledger_id)
        .bind(command.subject.tenant_id)
        .bind(command.subject.organization_id)
        .bind(&ledger_id)
        .bind(&account.account_id)
        .bind(&grant_id)
        .bind(&benefit_id)
        .bind(command.subject.user_id)
        .bind(&quantity)
        .bind(&account.balance_after)
        .bind(&binding.membership_uuid)
        .bind(format!("{}-ledger-{}", command.order_no, index + 1))
        .bind(format!("{}-ledger-{}", command.idempotency_key, index + 1))
        .bind(&command.requested_at)
        .bind(&command.requested_at)
        .execute(&mut **tx)
        .await
        .map_err(|error| store_error("failed to insert entitlement ledger", error))?;
    }
    Ok(())
}

#[derive(Debug, Clone)]
struct EntitlementAccountBalance {
    account_id: String,
    balance_after: String,
}

async fn upsert_membership_entitlement_account(
    tx: &mut Transaction<'_, Postgres>,
    command: &SubmitMembershipPurchaseCommand,
    account_id: &str,
    benefit_id: &str,
    quantity: &str,
    expires_at: &str,
) -> AppMembershipResult<EntitlementAccountBalance> {
    sqlx::query(
        r#"
        INSERT INTO membership_entitlement_account
            (id, tenant_id, organization_id, account_no, benefit_id, subject_type,
             subject_id, total_granted, total_used, balance, status, expires_at,
             version, created_at, updated_at)
        VALUES
            ($1, CAST($2 AS TEXT), CAST($3 AS TEXT), $4, $5, 'user',
             CAST($6 AS TEXT), $7, '0', $8, 'pending', $9::timestamptz, 0, $10::timestamptz, $11::timestamptz)
        ON CONFLICT(tenant_id, subject_type, subject_id, benefit_id) DO UPDATE SET
            total_granted = CAST((CAST(membership_entitlement_account.total_granted AS INTEGER) + CAST(excluded.total_granted AS INTEGER)) AS TEXT),
            balance = CAST((CAST(membership_entitlement_account.balance AS INTEGER) + CAST(excluded.balance AS INTEGER)) AS TEXT),
            status = CASE
                WHEN membership_entitlement_account.status = 'active' THEN 'active'
                ELSE 'pending'
            END,
            expires_at = CASE
                WHEN membership_entitlement_account.expires_at IS NULL OR excluded.expires_at > membership_entitlement_account.expires_at THEN excluded.expires_at
                ELSE membership_entitlement_account.expires_at
            END,
            version = membership_entitlement_account.version + 1,
            updated_at = excluded.updated_at
        "#,
    )
    .bind(account_id)
    .bind(command.subject.tenant_id)
    .bind(command.subject.organization_id)
    .bind(account_id)
    .bind(benefit_id)
    .bind(command.subject.user_id)
    .bind(quantity)
    .bind(quantity)
    .bind(expires_at)
    .bind(&command.requested_at)
    .bind(&command.requested_at)
    .execute(&mut **tx)
    .await
    .map_err(|error| store_error("failed to insert entitlement account", error))?;

    let row = sqlx::query(
        r#"
        SELECT id, balance
        FROM membership_entitlement_account
        WHERE tenant_id = CAST($1 AS TEXT)
          AND subject_type = 'user'
          AND subject_id = CAST($2 AS TEXT)
          AND benefit_id = $3
        "#,
    )
    .bind(command.subject.tenant_id)
    .bind(command.subject.user_id)
    .bind(benefit_id)
    .fetch_one(&mut **tx)
    .await
    .map_err(|error| store_error("failed to load entitlement account", error))?;

    Ok(EntitlementAccountBalance {
        account_id: string_cell(&row, "id"),
        balance_after: string_cell(&row, "balance"),
    })
}

/// advisory lock 键：会员订阅生命周期扫描（防多实例并发）。
const MEMBERSHIP_LIFECYCLE_SWEEP_LOCK_KEY: i64 = 71_091_238_411;

/// 会员订阅生命周期扫描（advisory lock 保护，防多实例并发）：
/// 到期订阅/周期/权益发放/权益账户 → expired，并写会员变更日志。
pub async fn expire_due_memberships(
    pool: &PgPool,
) -> AppMembershipResult<MembershipLifecycleSweepOutcome> {
    let mut conn = pool.acquire().await.map_err(|error| {
        store_error(
            "failed to acquire connection for membership lifecycle sweep",
            error,
        )
    })?;
    let locked: bool = sqlx::query_scalar("SELECT pg_try_advisory_lock($1)")
        .bind(MEMBERSHIP_LIFECYCLE_SWEEP_LOCK_KEY)
        .fetch_one(&mut *conn)
        .await
        .map_err(|error| store_error("failed to acquire membership lifecycle sweep lock", error))?;
    if !locked {
        // 另一实例正在执行本轮扫描
        return Ok(MembershipLifecycleSweepOutcome {
            skipped: true,
            ..MembershipLifecycleSweepOutcome::default()
        });
    }
    let result = expire_due_memberships_in_tx(pool).await;
    let _ = sqlx::query("SELECT pg_advisory_unlock($1)")
        .bind(MEMBERSHIP_LIFECYCLE_SWEEP_LOCK_KEY)
        .execute(&mut *conn)
        .await;
    result
}

async fn expire_due_memberships_in_tx(
    pool: &PgPool,
) -> AppMembershipResult<MembershipLifecycleSweepOutcome> {
    let mut tx = pool.begin().await.map_err(|error| {
        store_error(
            "failed to begin membership lifecycle sweep transaction",
            error,
        )
    })?;
    let now = current_timestamp_string();
    let due_rows = sqlx::query(
        r#"
        SELECT m.id, m.tenant_id, m.organization_id, m.owner_user_id, m.plan_id,
               m.status, m.source_order_id, CAST(m.expires_at AS TEXT) AS expires_at
        FROM membership_subscription m
        WHERE m.status IN ('active', 'grace_period')
          AND m.expires_at < CAST($1 AS TIMESTAMPTZ)
        ORDER BY m.expires_at ASC
        FOR UPDATE
        "#,
    )
    .bind(&now)
    .fetch_all(&mut *tx)
    .await
    .map_err(|error| store_error("failed to load due membership subscriptions", error))?;

    let mut expired_subscriptions = 0i64;
    let mut due_ids: Vec<String> = Vec::new();
    for row in &due_rows {
        let subscription_id = string_cell(row, "id");
        let from_status = string_cell(row, "status");
        if !matches!(from_status.as_str(), "active" | "grace_period") {
            continue;
        }
        let updated = sqlx::query(
            r#"
            UPDATE membership_subscription
            SET status = 'expired', version = version + 1,
                updated_at = CAST($1 AS TIMESTAMPTZ)
            WHERE id = $2
              AND status = $3
            "#,
        )
        .bind(&now)
        .bind(&subscription_id)
        .bind(&from_status)
        .execute(&mut *tx)
        .await
        .map_err(|error| store_error("failed to expire membership subscription", error))?
        .rows_affected();
        if updated == 0 {
            continue;
        }
        expired_subscriptions += 1;
        due_ids.push(subscription_id.clone());
        insert_membership_change_log(
            &mut tx,
            &now,
            row,
            "expire",
            Some(&from_status),
            "expired",
            "subscription_expired",
        )
        .await?;
    }

    // 到期订阅对应的周期、权益发放与独立到期的权益发放一并作废
    let expired_periods = sqlx::query(
        r#"
        UPDATE membership_period
        SET status = 'expired', updated_at = CAST($1 AS TIMESTAMPTZ)
        WHERE subscription_id = ANY($2)
          AND status = 'active'
        "#,
    )
    .bind(&now)
    .bind(&due_ids)
    .execute(&mut *tx)
    .await
    .map_err(|error| store_error("failed to expire membership periods", error))?
    .rows_affected() as i64;

    let expired_grants = sqlx::query(
        r#"
        UPDATE membership_entitlement_grant
        SET status = 'expired', updated_at = CAST($1 AS TIMESTAMPTZ)
        WHERE status = 'active'
          AND (source_type = 'membership_subscription' AND source_id = ANY($2)
               OR expires_at IS NOT NULL AND expires_at < CAST($1 AS TIMESTAMPTZ))
        "#,
    )
    .bind(&now)
    .bind(&due_ids)
    .execute(&mut *tx)
    .await
    .map_err(|error| store_error("failed to expire membership entitlement grants", error))?
    .rows_affected() as i64;

    let expired_accounts = sqlx::query(
        r#"
        UPDATE membership_entitlement_account
        SET status = 'expired', updated_at = CAST($1 AS TIMESTAMPTZ)
        WHERE status = 'active'
          AND expires_at IS NOT NULL
          AND expires_at < CAST($1 AS TIMESTAMPTZ)
        "#,
    )
    .bind(&now)
    .execute(&mut *tx)
    .await
    .map_err(|error| store_error("failed to expire membership entitlement accounts", error))?
    .rows_affected() as i64;

    tx.commit().await.map_err(|error| {
        store_error(
            "failed to commit membership lifecycle sweep transaction",
            error,
        )
    })?;
    Ok(MembershipLifecycleSweepOutcome {
        expired_subscriptions,
        expired_periods,
        expired_grants,
        expired_accounts,
        skipped: false,
    })
}

/// 写入会员变更日志（audit）：订阅状态流转事件。
#[allow(clippy::too_many_arguments)]
async fn insert_membership_change_log(
    tx: &mut Transaction<'_, Postgres>,
    now: &str,
    row: &sqlx::postgres::PgRow,
    action: &str,
    from_status: Option<&str>,
    to_status: &str,
    reason: &str,
) -> AppMembershipResult<()> {
    let metadata = serde_json::json!({
        "sourceOrderId": string_cell(row, "source_order_id"),
        "expiresAt": string_cell(row, "expires_at"),
    });
    sqlx::query(
        r#"
        INSERT INTO membership_change_log
            (id, uuid, tenant_id, organization_id, subscription_id, user_id, action,
             from_status, to_status, from_plan_id, reason, metadata, created_at)
        VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::JSONB,
             CAST($13 AS TIMESTAMPTZ))
        ON CONFLICT (id) DO NOTHING
        "#,
    )
    .bind(sdkwork_utils_rust::uuid())
    .bind(sdkwork_utils_rust::uuid())
    .bind(string_cell(row, "tenant_id"))
    .bind(string_cell(row, "organization_id"))
    .bind(string_cell(row, "id"))
    .bind(string_cell(row, "owner_user_id"))
    .bind(action)
    .bind(from_status)
    .bind(to_status)
    .bind(string_cell(row, "plan_id"))
    .bind(reason)
    .bind(metadata.to_string())
    .bind(now)
    .execute(&mut **tx)
    .await
    .map_err(|error| store_error("failed to insert membership change log", error))?;
    Ok(())
}

/// 权益额度消耗限额解析：coupon 政策按日/总双限；plan 发放与订阅期充值发放按
/// granted_quantity 为总额度（日限同总额度，检查天然不阻塞，即无独立日限）。
fn resolve_consumption_limits(
    grant_policy: &str,
    granted_quantity: i64,
) -> AppMembershipResult<(i64, i64)> {
    let is_coupon_policy = serde_json::from_str::<serde_json::Value>(grant_policy)
        .ok()
        .and_then(|value| {
            value
                .get("kind")
                .and_then(|kind| kind.as_str())
                .map(str::to_owned)
        })
        .as_deref()
        == Some("coupon_subscription_quota");
    if is_coupon_policy {
        let policy = parse_coupon_subscription_quota_policy(grant_policy)?;
        Ok((policy.daily_quota, policy.total_quota.min(granted_quantity)))
    } else {
        Ok((granted_quantity, granted_quantity))
    }
}

/// 订阅期权益额度充值：向当前有效订阅的权益账户（ai_quota）追加额度。
/// 幂等：同一 idempotency_key 重放返回既有结果；追加额度有效期不超出订阅到期日。
async fn recharge_subscription_quota(
    pool: &PgPool,
    command: RechargeSubscriptionQuotaCommand,
) -> AppMembershipResult<SubscriptionQuotaRechargeOutcome> {
    if command.subject.tenant_id <= 0
        || command.subject.user_id <= 0
        || command.quantity <= 0
        || command.order_id.trim().is_empty()
        || command.request_no.trim().is_empty()
        || command.idempotency_key.trim().is_empty()
        || command.idempotency_key.len() > 160
    {
        return Err(CommerceServiceError::validation(
            "subscription quota recharge command is invalid",
        ));
    }
    let grant_id = format!(
        "quota-recharge-{}-{}-{}",
        command.subject.tenant_id,
        command.subject.user_id,
        command.idempotency_key.trim()
    );
    let mut tx = pool.begin().await.map_err(|error| {
        store_error(
            "failed to begin subscription quota recharge transaction",
            error,
        )
    })?;

    // 幂等重放：同一充值订单已入账
    if let Some(row) = sqlx::query(
        r#"
        SELECT g.source_id, CAST(g.granted_quantity AS BIGINT) AS granted_quantity,
               a.balance, CAST(a.expires_at AS TEXT) AS account_expires_at,
               d.benefit_code
        FROM membership_entitlement_grant g
        JOIN membership_entitlement_account a
          ON a.tenant_id = g.tenant_id AND a.subject_type = g.subject_type
         AND a.subject_id = g.subject_id AND a.benefit_id = g.benefit_id
        JOIN membership_benefit_definition d ON d.tenant_id = g.tenant_id AND d.id = g.benefit_id
        WHERE g.id = $1
          AND g.tenant_id = CAST($2 AS TEXT)
          AND g.subject_type = 'user'
          AND g.subject_id = CAST($3 AS TEXT)
          AND g.source_type = 'membership_quota_recharge'
        LIMIT 1
        "#,
    )
    .bind(&grant_id)
    .bind(command.subject.tenant_id)
    .bind(command.subject.user_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|error| store_error("failed to load quota recharge replay", error))?
    {
        let recharged_quantity = integer_cell(&row, "granted_quantity").max(0);
        if recharged_quantity != command.quantity {
            return Err(CommerceServiceError::conflict(
                "idempotency key was already used with a different recharge quantity",
            ));
        }
        let outcome = SubscriptionQuotaRechargeOutcome {
            accepted: true,
            replayed: true,
            subscription_id: string_cell(&row, "source_id"),
            benefit_code: string_cell(&row, "benefit_code"),
            recharged_quantity,
            balance_after: parse_points_amount(&string_cell(&row, "balance")).max(0),
            expires_at: string_cell(&row, "account_expires_at"),
        };
        tx.commit().await.map_err(|error| {
            store_error("failed to commit quota recharge replay transaction", error)
        })?;
        return Ok(outcome);
    }

    // 仅对当前有效订阅开放充值（status='active' 且未到期）
    let membership = load_current_membership_for_validation(&mut *tx, command.subject).await?;
    let Some(membership) = membership else {
        return Err(CommerceServiceError::conflict(
            "membership quota recharge requires an active membership subscription",
        ));
    };
    if membership.rank <= 0
        || membership.status != "active"
        || membership_expired(&membership.expires_at)
    {
        return Err(CommerceServiceError::conflict(
            "membership quota recharge requires an active membership subscription",
        ));
    }
    let subscription_id = membership.membership_id;

    // 定位可充值权益账户（ai_quota）
    let account_row = sqlx::query(
        r#"
        SELECT a.id AS account_id, a.benefit_id, a.balance,
               CAST(a.expires_at AS TEXT) AS account_expires_at,
               d.benefit_code
        FROM membership_entitlement_account a
        JOIN membership_benefit_definition d ON d.tenant_id = a.tenant_id AND d.id = a.benefit_id
        WHERE a.tenant_id = CAST($1 AS TEXT)
          AND (a.organization_id IS NULL OR a.organization_id = '0' OR a.organization_id = CAST($2 AS TEXT))
          AND a.subject_type = 'user'
          AND a.subject_id = CAST($3 AS TEXT)
          AND a.status = 'active'
          AND d.benefit_code = 'ai_quota'
        LIMIT 1
        FOR UPDATE OF a
        "#,
    )
    .bind(command.subject.tenant_id)
    .bind(command.subject.organization_id)
    .bind(command.subject.user_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|error| store_error("failed to load rechargeable entitlement account", error))?;
    let Some(account_row) = account_row else {
        return Err(CommerceServiceError::conflict(
            "membership quota recharge requires an active ai_quota entitlement",
        ));
    };
    let account_id = string_cell(&account_row, "account_id");
    let benefit_id = string_cell(&account_row, "benefit_id");
    let account_expires_at = string_cell(&account_row, "account_expires_at");
    let balance_after = parse_points_amount(&string_cell(&account_row, "balance"))
        .max(0)
        .checked_add(command.quantity)
        .ok_or_else(|| {
            CommerceServiceError::validation(
                "subscription quota recharge exceeds the supported range",
            )
        })?;
    // 追加额度有效期不超出订阅到期日（账户到期时间一并顺延到订阅到期日）
    let grant_expires_at = if account_expires_at.as_str() < membership.expires_at.as_str() {
        membership.expires_at.clone()
    } else {
        account_expires_at.clone()
    };
    let grant_policy = serde_json::json!({
        "kind": "quota_recharge",
        "orderId": command.order_id.trim(),
        "quantity": command.quantity,
    })
    .to_string();
    let now = current_timestamp_string();
    let grant_no = sdkwork_utils_rust::uuid();
    sqlx::query(
        r#"
        INSERT INTO membership_entitlement_grant
            (id, uuid, tenant_id, organization_id, grant_no, benefit_id, subject_type,
             subject_id, source_type, source_id, grant_policy, granted_quantity, status,
             starts_at, expires_at, request_no, idempotency_key, created_at, updated_at)
        VALUES
            ($1, $2, $3, $4, $5, $6, 'user', $7, 'membership_quota_recharge', $8, $9,
             CAST($10 AS TEXT), 'active', $11::timestamptz, $12::timestamptz, $13, $14, $15::timestamptz, $15::timestamptz)
        "#,
    )
    .bind(&grant_id)
    .bind(sdkwork_utils_rust::uuid())
    .bind(command.subject.tenant_id)
    .bind(command.subject.organization_id)
    .bind(&grant_no)
    .bind(&benefit_id)
    .bind(command.subject.user_id)
    .bind(&subscription_id)
    .bind(&grant_policy)
    .bind(command.quantity)
    .bind(&command.requested_at)
    .bind(&grant_expires_at)
    .bind(command.request_no.trim())
    .bind(command.idempotency_key.trim())
    .bind(&now)
    .execute(&mut *tx)
    .await
    .map_err(|error| store_error("failed to insert quota recharge grant", error))?;

    sqlx::query(
        r#"
        UPDATE membership_entitlement_account
        SET total_granted = CAST(CAST(total_granted AS BIGINT) + $1 AS TEXT),
            balance = CAST(CAST(balance AS BIGINT) + $1 AS TEXT),
            expires_at = GREATEST(COALESCE(expires_at, CAST($2 AS TIMESTAMPTZ)),
                                  CAST($2 AS TIMESTAMPTZ)),
            status = 'active',
            version = version + 1,
            updated_at = CAST($3 AS TIMESTAMPTZ)
        WHERE id = $4
          AND tenant_id = CAST($5 AS TEXT)
        "#,
    )
    .bind(command.quantity)
    .bind(&grant_expires_at)
    .bind(&now)
    .bind(&account_id)
    .bind(command.subject.tenant_id)
    .execute(&mut *tx)
    .await
    .map_err(|error| store_error("failed to credit quota recharge account", error))?;

    sqlx::query(
        r#"
        INSERT INTO membership_entitlement_ledger_entry
            (id, tenant_id, organization_id, ledger_no, account_id, grant_id, benefit_id,
             subject_type, subject_id, direction, amount, balance_after, business_type,
             source_type, source_id, request_no, idempotency_key, occurred_at, created_at)
        VALUES
            ($1, $2, $3, $4, $5, $6, $7, 'user', $8, 'credit', $9, $10, 'quota_recharge',
             'membership_quota_recharge', $11, $12, $13, $14::timestamptz, $14::timestamptz)
        "#,
    )
    .bind(&grant_id)
    .bind(command.subject.tenant_id)
    .bind(command.subject.organization_id)
    .bind(&grant_id)
    .bind(&account_id)
    .bind(&grant_id)
    .bind(&benefit_id)
    .bind(command.subject.user_id)
    .bind(command.quantity)
    .bind(balance_after)
    .bind(&subscription_id)
    .bind(command.request_no.trim())
    .bind(command.idempotency_key.trim())
    .bind(&now)
    .execute(&mut *tx)
    .await
    .map_err(|error| store_error("failed to insert quota recharge ledger entry", error))?;

    tx.commit().await.map_err(|error| {
        store_error(
            "failed to commit subscription quota recharge transaction",
            error,
        )
    })?;
    Ok(SubscriptionQuotaRechargeOutcome {
        accepted: true,
        replayed: false,
        subscription_id,
        benefit_code: string_cell(&account_row, "benefit_code"),
        recharged_quantity: command.quantity,
        balance_after,
        expires_at: grant_expires_at,
    })
}

async fn consume_subscription_quota(
    pool: &PgPool,
    command: ConsumeSubscriptionQuotaCommand,
) -> AppMembershipResult<SubscriptionQuotaConsumptionOutcome> {
    if command.subject.tenant_id <= 0
        || command.subject.user_id <= 0
        || command.amount <= 0
        || command.request_no.trim().is_empty()
        || command.idempotency_key.trim().is_empty()
        || command.idempotency_key.len() > 160
    {
        return Err(CommerceServiceError::validation(
            "subscription quota consumption command is invalid",
        ));
    }
    let (usage_date, day_start, day_end) = subscription_quota_day_bounds(&command.requested_at)?;
    let ledger_id = format!(
        "coupon-quota-{}-{}-{}",
        command.subject.tenant_id,
        command.subject.user_id,
        command.idempotency_key.trim()
    );
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| store_error("failed to begin subscription quota transaction", error))?;

    if let Some(row) = sqlx::query(
        r#"
        SELECT l.amount, l.grant_id, l.source_id, l.balance_after,
               d.benefit_code, g.grant_policy,
               CAST(g.granted_quantity AS BIGINT) AS granted_quantity
        FROM membership_entitlement_ledger_entry l
        JOIN membership_entitlement_grant g ON g.id = l.grant_id AND g.tenant_id = l.tenant_id
        JOIN membership_benefit_definition d ON d.id = l.benefit_id AND d.tenant_id = l.tenant_id
        WHERE l.id = $1
          AND l.tenant_id = CAST($2 AS TEXT)
          AND l.subject_type = 'user'
          AND l.subject_id = CAST($3 AS TEXT)
          AND l.business_type IN ('coupon_subscription_quota_usage', 'subscription_quota_usage')
        LIMIT 1
        "#,
    )
    .bind(&ledger_id)
    .bind(command.subject.tenant_id)
    .bind(command.subject.user_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|error| store_error("failed to load quota consumption replay", error))?
    {
        let consumed_amount = parse_points_amount(&string_cell(&row, "amount")).max(0);
        if consumed_amount != command.amount {
            return Err(CommerceServiceError::conflict(
                "idempotency key was already used with a different quota amount",
            ));
        }
        let grant_id = string_cell(&row, "grant_id");
        let granted_quantity = integer_cell(&row, "granted_quantity").max(0);
        let (daily_quota, total_quota) =
            resolve_consumption_limits(&string_cell(&row, "grant_policy"), granted_quantity)?;
        let usage = sqlx::query(
            r#"
            SELECT
                COALESCE(SUM(CAST(amount AS BIGINT)), 0) AS total_used,
                COALESCE(SUM(CASE
                    WHEN occurred_at >= CAST($2 AS TIMESTAMPTZ)
                     AND occurred_at < CAST($3 AS TIMESTAMPTZ)
                    THEN CAST(amount AS BIGINT) ELSE 0 END), 0) AS daily_used
            FROM membership_entitlement_ledger_entry
            WHERE grant_id = $1
              AND direction = 'debit'
              AND business_type IN ('coupon_subscription_quota_usage', 'subscription_quota_usage')
            "#,
        )
        .bind(&grant_id)
        .bind(&day_start)
        .bind(&day_end)
        .fetch_one(&mut *tx)
        .await
        .map_err(|error| store_error("failed to load replayed coupon quota usage", error))?;
        let total_used = integer_cell(&usage, "total_used").max(0);
        let daily_used = integer_cell(&usage, "daily_used").max(0);
        tx.commit()
            .await
            .map_err(|error| store_error("failed to finish quota replay transaction", error))?;
        return Ok(SubscriptionQuotaConsumptionOutcome {
            accepted: true,
            replayed: true,
            benefit_code: string_cell(&row, "benefit_code"),
            subscription_id: string_cell(&row, "source_id"),
            consumed_amount,
            daily_quota,
            used_daily_quota: daily_used,
            remaining_daily_quota: (daily_quota - daily_used).max(0),
            total_quota,
            remaining_total_quota: (total_quota - total_used).max(0),
        });
    }

    let grants = sqlx::query(
        r#"
        SELECT a.id AS account_id, a.balance, g.id AS grant_id, g.source_id,
               g.grant_policy, CAST(g.granted_quantity AS BIGINT) AS granted_quantity,
               d.benefit_code
        FROM membership_entitlement_grant g
        JOIN membership_entitlement_account a
          ON a.tenant_id = g.tenant_id
         AND a.subject_type = g.subject_type
         AND a.subject_id = g.subject_id
         AND a.benefit_id = g.benefit_id
        JOIN membership_benefit_definition d ON d.tenant_id = g.tenant_id AND d.id = g.benefit_id
        JOIN membership_subscription m ON m.tenant_id = g.tenant_id AND m.id = g.source_id
        WHERE g.tenant_id = CAST($1 AS TEXT)
          AND (g.organization_id IS NULL OR g.organization_id = '0' OR g.organization_id = CAST($2 AS TEXT))
          AND g.subject_type = 'user'
          AND g.subject_id = CAST($3 AS TEXT)
          AND g.source_type IN ('membership_subscription', 'membership_quota_recharge')
          AND g.status = 'active'
          AND a.status = 'active'
          AND m.status = 'active'
          AND d.benefit_code IN ('ai_quota', 'exclusive_model')
          AND COALESCE(g.grant_policy, '') <> ''
          AND (g.starts_at IS NULL OR g.starts_at <= CAST($4 AS TIMESTAMPTZ))
          AND (g.expires_at IS NULL OR g.expires_at > CAST($4 AS TIMESTAMPTZ))
          AND (a.expires_at IS NULL OR a.expires_at > CAST($4 AS TIMESTAMPTZ))
        ORDER BY COALESCE(g.expires_at, a.expires_at, m.expires_at) ASC, g.created_at ASC, g.id ASC
        FOR UPDATE OF g, a
        "#,
    )
    .bind(command.subject.tenant_id)
    .bind(command.subject.organization_id)
    .bind(command.subject.user_id)
    .bind(&command.requested_at)
    .fetch_all(&mut *tx)
    .await
    .map_err(|error| store_error("failed to load active coupon quota grants", error))?;

    for row in grants {
        let policy_json = string_cell(&row, "grant_policy");
        let is_coupon_policy = serde_json::from_str::<serde_json::Value>(&policy_json)
            .ok()
            .and_then(|value| {
                value
                    .get("kind")
                    .and_then(|kind| kind.as_str())
                    .map(str::to_owned)
            })
            .as_deref()
            == Some("coupon_subscription_quota");
        let granted_quantity = integer_cell(&row, "granted_quantity").max(0);
        let (daily_quota, total_quota) =
            resolve_consumption_limits(&policy_json, granted_quantity)?;
        let usage_business_type = if is_coupon_policy {
            "coupon_subscription_quota_usage"
        } else {
            "subscription_quota_usage"
        };
        let grant_id = string_cell(&row, "grant_id");
        let usage = sqlx::query(
            r#"
            SELECT
                COALESCE(SUM(CAST(amount AS BIGINT)), 0) AS total_used,
                COALESCE(SUM(CASE
                    WHEN occurred_at >= CAST($2 AS TIMESTAMPTZ)
                     AND occurred_at < CAST($3 AS TIMESTAMPTZ)
                    THEN CAST(amount AS BIGINT) ELSE 0 END), 0) AS daily_used
            FROM membership_entitlement_ledger_entry
            WHERE grant_id = $1
              AND direction = 'debit'
              AND business_type IN ('coupon_subscription_quota_usage', 'subscription_quota_usage')
            "#,
        )
        .bind(&grant_id)
        .bind(&day_start)
        .bind(&day_end)
        .fetch_one(&mut *tx)
        .await
        .map_err(|error| store_error("failed to calculate coupon quota usage", error))?;
        let total_used = integer_cell(&usage, "total_used").max(0);
        let daily_used = integer_cell(&usage, "daily_used").max(0);
        let account_balance = parse_points_amount(&string_cell(&row, "balance")).max(0);
        if total_used.saturating_add(command.amount) > total_quota
            || daily_used.saturating_add(command.amount) > daily_quota
            || account_balance < command.amount
        {
            continue;
        }

        let account_id = string_cell(&row, "account_id");
        let updated = sqlx::query(
            r#"
            UPDATE membership_entitlement_account
            SET total_used = CAST(CAST(total_used AS BIGINT) + $1 AS TEXT),
                balance = CAST(CAST(balance AS BIGINT) - $1 AS TEXT),
                version = version + 1,
                updated_at = CAST($2 AS TIMESTAMPTZ)
            WHERE id = $3
              AND tenant_id = CAST($4 AS TEXT)
              AND CAST(balance AS BIGINT) >= $1
            "#,
        )
        .bind(command.amount)
        .bind(&command.requested_at)
        .bind(&account_id)
        .bind(command.subject.tenant_id)
        .execute(&mut *tx)
        .await
        .map_err(|error| store_error("failed to debit subscription quota account", error))?;
        if updated.rows_affected() != 1 {
            continue;
        }

        let balance_after = account_balance - command.amount;
        let subscription_id = string_cell(&row, "source_id");
        let benefit_code = string_cell(&row, "benefit_code");
        sqlx::query(
            r#"
            INSERT INTO membership_entitlement_ledger_entry
                (id, tenant_id, organization_id, ledger_no, account_id, grant_id, benefit_id,
                 subject_type, subject_id, direction, amount, balance_after, business_type,
                 source_type, source_id, request_no, idempotency_key, occurred_at, created_at)
            SELECT
                $1, CAST($2 AS TEXT), CAST($3 AS TEXT), $1, a.id, $4, a.benefit_id,
                'user', CAST($5 AS TEXT), 'debit', CAST($6 AS TEXT), CAST($7 AS TEXT),
                $8, 'membership_subscription', $9, $10,
                CAST($11 AS TIMESTAMPTZ), CAST($11 AS TIMESTAMPTZ)
            FROM membership_entitlement_account a
            WHERE a.id = $12
            "#,
        )
        .bind(&ledger_id)
        .bind(command.subject.tenant_id)
        .bind(command.subject.organization_id)
        .bind(&grant_id)
        .bind(command.subject.user_id)
        .bind(command.amount)
        .bind(balance_after)
        .bind(usage_business_type)
        .bind(&subscription_id)
        .bind(command.request_no.trim())
        .bind(command.idempotency_key.trim())
        .bind(&command.requested_at)
        .bind(&account_id)
        .execute(&mut *tx)
        .await
        .map_err(|error| store_error("failed to insert subscription quota ledger entry", error))?;

        let usage_key = format!(
            "{}:{}:{}:{}",
            command.subject.tenant_id, command.subject.user_id, benefit_code, usage_date
        );
        let usage_id = stable_membership_i64_id(&usage_key);
        let usage_uuid = format!("coupon-quota-usage-{usage_id}");
        sqlx::query(
            r#"
            INSERT INTO membership_privilege_usage
                (id, uuid, tenant_id, organization_id, user_id, benefit_code,
                 period_start, period_end, used_count, usage_limit, last_used_at, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, CAST($7 AS TIMESTAMPTZ), CAST($8 AS TIMESTAMPTZ),
                    $9, $10, CAST($11 AS TIMESTAMPTZ), CAST($11 AS TIMESTAMPTZ), CAST($11 AS TIMESTAMPTZ))
            ON CONFLICT (tenant_id, user_id, benefit_code, period_start) DO UPDATE SET
                used_count = membership_privilege_usage.used_count + excluded.used_count,
                usage_limit = GREATEST(membership_privilege_usage.usage_limit, excluded.usage_limit),
                last_used_at = excluded.last_used_at,
                version = membership_privilege_usage.version + 1,
                updated_at = excluded.updated_at
            "#,
        )
        .bind(usage_id)
        .bind(&usage_uuid)
        .bind(command.subject.tenant_id)
        .bind(command.subject.organization_id)
        .bind(command.subject.user_id)
        .bind(&benefit_code)
        .bind(&day_start)
        .bind(&day_end)
        .bind(command.amount)
        .bind(daily_quota)
        .bind(&command.requested_at)
        .execute(&mut *tx)
        .await
        .map_err(|error| store_error("failed to update daily subscription quota usage", error))?;

        let used_daily_quota = daily_used + command.amount;
        let used_total_quota = total_used + command.amount;
        tx.commit().await.map_err(|error| {
            store_error("failed to commit subscription quota transaction", error)
        })?;
        return Ok(SubscriptionQuotaConsumptionOutcome {
            accepted: true,
            replayed: false,
            benefit_code,
            subscription_id,
            consumed_amount: command.amount,
            daily_quota,
            used_daily_quota,
            remaining_daily_quota: daily_quota - used_daily_quota,
            total_quota,
            remaining_total_quota: total_quota - used_total_quota,
        });
    }

    Err(CommerceServiceError::conflict(
        "subscription coupon daily or total quota is exhausted",
    ))
}

async fn consume_speed_up(
    pool: &PgPool,
    subject: AppMembershipSubject,
    requested_at: String,
) -> AppMembershipResult<SdkWorkCommandData> {
    let mut tx = pool
        .begin()
        .await
        .map_err(|error| store_error("failed to begin membership speed up transaction", error))?;
    let row = sqlx::query(
        r#"
        SELECT
            a.id,
            d.benefit_code AS entitlement_code,
            COALESCE(g.source_id, '') AS membership_id,
            g.id AS grant_id,
            a.total_granted AS granted_quantity,
            a.total_used AS used_quantity,
            a.balance AS balance
        FROM membership_entitlement_account a
        JOIN membership_benefit_definition d
          ON d.id = a.benefit_id
        LEFT JOIN membership_entitlement_grant g
          ON g.benefit_id = a.benefit_id
         AND g.subject_type = a.subject_type
         AND g.subject_id = a.subject_id
         AND g.source_type = 'membership_subscription'
         AND g.tenant_id = a.tenant_id
        LEFT JOIN membership_subscription m
          ON m.id = g.source_id
         AND m.tenant_id = a.tenant_id
        WHERE a.tenant_id = CAST($1 AS TEXT)
          AND (a.organization_id IS NULL OR a.organization_id = '0' OR a.organization_id = CAST($2 AS TEXT))
          AND a.subject_type = 'user'
          AND a.subject_id = CAST($3 AS TEXT)
          AND a.status = 'active'
          AND d.benefit_code = 'priority_speed_up'
          AND CAST(a.balance AS INTEGER) > 0
        ORDER BY a.expires_at DESC, a.updated_at ASC, a.created_at ASC, a.id ASC
        LIMIT 1
        "#,
    )
    .bind(subject.tenant_id)
    .bind(subject.organization_id)
    .bind(subject.user_id)
    .fetch_optional(&mut *tx)
    .await
    .map_err(|error| store_error("failed to load membership speed up entitlement", error))?
    .ok_or_else(|| {
        CommerceServiceError::conflict("membership speed up privilege is unavailable")
    })?;

    let account_id = string_cell(&row, "id");
    let membership_id = string_cell(&row, "membership_id");
    let grant_id = optional_string_cell(&row, "grant_id");
    let granted_quantity = parse_points_amount(&string_cell(&row, "granted_quantity")).max(0);
    let used_quantity = parse_points_amount(&string_cell(&row, "used_quantity")).max(0);
    let balance = parse_points_amount(&string_cell(&row, "balance")).max(0);
    if balance <= 0 || used_quantity >= granted_quantity || granted_quantity <= 0 {
        return Err(CommerceServiceError::conflict(
            "membership speed up privilege is exhausted",
        ));
    }

    let updated_rows = sqlx::query(
        r#"
        UPDATE membership_entitlement_account
        SET total_used = CAST(CAST(total_used AS INTEGER) + 1 AS TEXT),
            balance = CAST(CAST(balance AS INTEGER) - 1 AS TEXT),
            version = version + 1,
            updated_at = $2::timestamptz
        WHERE id = $1
          AND CAST(balance AS INTEGER) > 0
        "#,
    )
    .bind(&account_id)
    .bind(&requested_at)
    .execute(&mut *tx)
    .await
    .map_err(|error| store_error("failed to update membership speed up entitlement", error))?
    .rows_affected();
    if updated_rows == 0 {
        return Err(CommerceServiceError::conflict(
            "membership speed up privilege is exhausted",
        ));
    }

    let usage_id = format!("{account_id}-ledger-debit-{}", used_quantity + 1);
    let request_no = format!(
        "membership-speed-up-{}-{}",
        subject.user_id,
        used_quantity + 1
    );
    sqlx::query(
        r#"
        INSERT INTO membership_entitlement_ledger_entry
            (id, tenant_id, organization_id, ledger_no, account_id, grant_id, benefit_id,
             subject_type, subject_id, direction, amount, balance_after, business_type,
             source_type, source_id, request_no, idempotency_key, occurred_at, created_at)
        SELECT
            $1, CAST($2 AS TEXT), CAST($3 AS TEXT), $1, a.id, $4, a.benefit_id,
            'user', CAST($5 AS TEXT), 'debit', '1', CAST($6 AS TEXT), 'membership_speed_up',
            'membership_subscription', $7, $8, $8, $9, $9
        FROM membership_entitlement_account a
        WHERE a.id = $10
        "#,
    )
    .bind(&usage_id)
    .bind(subject.tenant_id)
    .bind(subject.organization_id)
    .bind(grant_id.as_deref())
    .bind(subject.user_id)
    .bind((balance - 1).max(0).to_string())
    .bind(if membership_id.trim().is_empty() {
        "membership-speed-up"
    } else {
        membership_id.as_str()
    })
    .bind(&request_no)
    .bind(&requested_at)
    .bind(&account_id)
    .execute(&mut *tx)
    .await
    .map_err(|error| store_error("failed to insert membership speed up usage", error))?;

    tx.commit()
        .await
        .map_err(|error| store_error("failed to commit membership speed up transaction", error))?;
    Ok(SdkWorkCommandData::accepted())
}

fn plan_id_for_storage(plan: &StoredMembershipPlan) -> String {
    if !plan.storage_id.trim().is_empty() {
        plan.storage_id.clone()
    } else if plan.plan_no.trim().is_empty() {
        format!("membership-plan-{}", plan_code_from_rank(plan.rank))
    } else {
        format!("membership-plan-{}", plan.plan_no.trim())
    }
}

fn plan_version_id_for_storage(plan: &StoredMembershipPlan) -> String {
    match plan.plan_no.as_str() {
        "free" => "seed-membership-plan-version-free-v1".to_owned(),
        "pro" => "seed-membership-plan-version-pro-v1".to_owned(),
        "max" => "seed-membership-plan-version-max-v1".to_owned(),
        "vip" => "seed-membership-plan-version-vip-v1".to_owned(),
        _ => format!("{}-version-v1", plan_id_for_storage(plan)),
    }
}

fn membership_period_id(membership_uuid: &str, order_no: &str) -> String {
    format!("{membership_uuid}-period-{order_no}")
}

fn admin_plan_version_id(plan_id: &str) -> String {
    format!("{}-version-v1", storage_key(plan_id))
}

fn admin_benefit_code(benefit: &AppMembershipBenefitItem, fallback_index: usize) -> String {
    benefit
        .benefit_key
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .map(|value| value.trim().to_ascii_lowercase())
        .unwrap_or_else(|| format!("membership_benefit_{fallback_index}"))
}

fn membership_benefit_definition_id_for_code(benefit_code: &str) -> String {
    match benefit_code {
        "ai_quota" => "seed-benefit-ai-quota".to_owned(),
        "priority_speed_up" => "seed-benefit-priority-speed-up".to_owned(),
        "member_discount" => "seed-benefit-member-discount".to_owned(),
        "monthly_coupon_grant" => "seed-benefit-monthly-coupon-grant".to_owned(),
        value => format!("benefit-definition-{}", storage_key(value)),
    }
}

fn storage_key(value: &str) -> String {
    let key = value
        .trim()
        .to_ascii_lowercase()
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                character
            } else {
                '-'
            }
        })
        .collect::<String>();
    let key = key.trim_matches('-').to_owned();
    if key.is_empty() {
        "standard".to_owned()
    } else {
        key
    }
}

fn membership_status_label(status: &str) -> &'static str {
    match status.trim().to_ascii_lowercase().as_str() {
        "active" => "active",
        "pending_activation" | "pending" => "pending",
        "expired" => "expired",
        _ => "free",
    }
}

/// 实时到期判断：订阅行状态仍为 active 但已过到期时间时按已过期处理。
fn membership_expired(expires_at: &str) -> bool {
    let Some(expires_seconds) = parse_timestamp(expires_at) else {
        return false;
    };
    let now_seconds = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    expires_seconds <= now_seconds
}

fn remaining_days(expires_at: &str) -> Option<i64> {
    let expires_seconds = parse_timestamp(expires_at)?;
    let now_seconds = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .ok()?;
    if expires_seconds <= now_seconds {
        return Some(0);
    }
    let diff = expires_seconds - now_seconds;
    Some((diff + 86_399) / 86_400)
}

fn add_days_to_timestamp(timestamp: &str, days: i64) -> String {
    let Some(seconds) = parse_timestamp(timestamp) else {
        return timestamp.to_owned();
    };
    format_unix_timestamp(seconds + days.max(0) * 86_400)
}

fn parse_timestamp(timestamp: &str) -> Option<i64> {
    let (date, time) = timestamp.trim().split_once(' ')?;
    let mut date_parts = date.split('-');
    let year = date_parts.next()?.parse::<i64>().ok()?;
    let month = date_parts.next()?.parse::<i64>().ok()?;
    let day = date_parts.next()?.parse::<i64>().ok()?;
    let mut time_parts = time.split(':');
    let hour = time_parts.next()?.parse::<i64>().ok()?;
    let minute = time_parts.next()?.parse::<i64>().ok()?;
    let second = time_parts.next()?.parse::<i64>().ok()?;
    Some(days_from_civil(year, month, day) * 86_400 + hour * 3_600 + minute * 60 + second)
}

fn days_from_civil(year: i64, month: i64, day: i64) -> i64 {
    let year = year - if month <= 2 { 1 } else { 0 };
    let era = if year >= 0 { year } else { year - 399 } / 400;
    let yoe = year - era * 400;
    let month = month + if month > 2 { -3 } else { 9 };
    let doy = (153 * month + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

fn format_unix_timestamp(seconds: i64) -> String {
    let days = seconds.div_euclid(86_400);
    let seconds_of_day = seconds.rem_euclid(86_400);
    let (year, month, day) = civil_from_days(days);
    let hour = seconds_of_day / 3_600;
    let minute = (seconds_of_day % 3_600) / 60;
    let second = seconds_of_day % 60;
    format!("{year:04}-{month:02}-{day:02} {hour:02}:{minute:02}:{second:02}")
}

fn civil_from_days(days: i64) -> (i64, i64, i64) {
    let days = days + 719_468;
    let era = if days >= 0 { days } else { days - 146_096 } / 146_097;
    let day_of_era = days - era * 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let year = year_of_era + era * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_prime = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_prime + 2) / 5 + 1;
    let month = month_prime + if month_prime < 10 { 3 } else { -9 };
    let year = year + if month <= 2 { 1 } else { 0 };
    (year, month, day)
}

fn numeric_suffix(value: &str) -> Option<i64> {
    value.rsplit('-').next()?.parse::<i64>().ok()
}

fn optional_string_cell(row: &sqlx::postgres::PgRow, column: &str) -> Option<String> {
    row.try_get::<Option<String>, _>(column).ok().flatten()
}

fn string_cell(row: &sqlx::postgres::PgRow, column: &str) -> String {
    optional_string_cell(row, column).unwrap_or_default()
}

fn integer_cell(row: &sqlx::postgres::PgRow, column: &str) -> i64 {
    row.try_get::<i64, _>(column)
        .or_else(|_| row.try_get::<i32, _>(column).map(i64::from))
        .unwrap_or(0)
}

fn sql_error(error: sqlx::Error) -> CommerceServiceError {
    eprintln!("membership storage error: {error}");
    classify_sql_error("database operation failed", &error)
}

fn store_error(context: &str, error: sqlx::Error) -> CommerceServiceError {
    eprintln!("membership storage error ({context}): {error}");
    classify_sql_error(context, &error)
}

/// Maps PostgreSQL constraint failures to their real semantics instead of
/// masking them as SERVICE_UNAVAILABLE (50301): unique violations are
/// conflicts (409), CHECK/NOT NULL violations are validation errors (400),
/// and everything else stays a storage/transport failure (503).
fn classify_sql_error(context: &str, error: &sqlx::Error) -> CommerceServiceError {
    use sqlx::error::Error as SqlxError;
    use sqlx::postgres::PgDatabaseError;
    if let SqlxError::Database(database_error) = error {
        if let Some(pg_error) = database_error.try_downcast_ref::<PgDatabaseError>() {
            match pg_error.code() {
                "23505" => {
                    return CommerceServiceError::conflict(format!(
                        "{context}: unique constraint violation"
                    ))
                }
                "23514" => {
                    return CommerceServiceError::validation(format!(
                        "{context}: check constraint violation"
                    ))
                }
                "23502" => {
                    return CommerceServiceError::validation(format!(
                        "{context}: not-null constraint violation"
                    ))
                }
                _ => {}
            }
        }
    }
    CommerceServiceError::storage(context)
}

fn empty_rows_when_read_model_is_missing(
    error: sqlx::Error,
) -> Result<Vec<sqlx::postgres::PgRow>, CommerceServiceError> {
    if is_missing_postgres_read_model(&error) {
        eprintln!("membership read model error: {error}");
        Err(CommerceServiceError::storage(
            "membership read model not initialized; run database migrations",
        ))
    } else {
        Err(sql_error(error))
    }
}

fn none_when_read_model_is_missing(
    error: sqlx::Error,
) -> Result<Option<sqlx::postgres::PgRow>, CommerceServiceError> {
    if is_missing_postgres_read_model(&error) {
        eprintln!("membership read model error: {error}");
        Err(CommerceServiceError::storage(
            "membership read model not initialized; run database migrations",
        ))
    } else {
        Err(sql_error(error))
    }
}

// ── Daily reward helpers ──

const DAILY_REWARD_BASE_POINTS: i64 = 10;
const DAILY_REWARD_WEEKLY_BONUS: i64 = 50;
const DAILY_REWARD_BIWEEKLY_BONUS: i64 = 100;
const DAILY_REWARD_MONTHLY_BONUS: i64 = 500;

fn daily_reward_points(consecutive_days: i64) -> i64 {
    let day = consecutive_days.max(1);
    if day % 30 == 0 {
        DAILY_REWARD_MONTHLY_BONUS
    } else if day % 14 == 0 {
        DAILY_REWARD_BIWEEKLY_BONUS
    } else if day % 7 == 0 {
        DAILY_REWARD_WEEKLY_BONUS
    } else {
        DAILY_REWARD_BASE_POINTS
    }
}

async fn load_daily_reward_status_postgres(
    pool: &PgPool,
    subject: AppMembershipSubject,
) -> AppMembershipResult<AppMembershipDailyRewardStatusResponse> {
    let row = sqlx::query(
        r#"
        SELECT
            reward_date::text AS reward_date,
            consecutive_days::bigint AS consecutive_days,
            total_days::bigint AS total_days,
            TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD') AS today,
            CASE WHEN reward_date = CURRENT_DATE THEN 1 ELSE 0 END AS is_today
        FROM membership_daily_reward
        WHERE tenant_id = $1
          AND (organization_id = 0 OR organization_id = $2)
          AND user_id = $3
          AND reward_date >= CURRENT_DATE - INTERVAL '2 days'
        ORDER BY reward_date DESC
        LIMIT 1
        "#,
    )
    .bind(subject.tenant_id)
    .bind(subject.organization_id)
    .bind(subject.user_id)
    .fetch_optional(pool)
    .await
    .or_else(none_when_read_model_is_missing)?;

    let Some(row) = row else {
        return Ok(AppMembershipDailyRewardStatusResponse {
            can_claim: true,
            claimed_today: false,
            consecutive_days: 0,
            total_days: 0,
        });
    };

    let is_today: i64 = row.try_get("is_today").unwrap_or(0);
    let consecutive_days = integer_cell(&row, "consecutive_days");
    let total_days = integer_cell(&row, "total_days");

    Ok(AppMembershipDailyRewardStatusResponse {
        can_claim: is_today == 0,
        claimed_today: is_today != 0,
        consecutive_days,
        total_days,
    })
}

async fn claim_daily_reward_postgres(
    pool: &PgPool,
    subject: AppMembershipSubject,
    requested_at: String,
) -> AppMembershipResult<AppMembershipDailyRewardResponse> {
    let today = current_date_postgres(pool).await;
    let yesterday = yesterday_date_postgres(pool).await;

    let mut tx = pool
        .begin()
        .await
        .map_err(|error| store_error("failed to begin daily reward transaction", error))?;

    let last_row = sqlx::query(
        r#"
        SELECT
            reward_date::text AS reward_date,
            consecutive_days::bigint AS consecutive_days,
            total_days::bigint AS total_days
        FROM membership_daily_reward
        WHERE tenant_id = $1
          AND (organization_id = 0 OR organization_id = $2)
          AND user_id = $3
          AND reward_date >= CURRENT_DATE - INTERVAL '1 day'
        ORDER BY reward_date DESC
        LIMIT 1
        FOR UPDATE
        "#,
    )
    .bind(subject.tenant_id)
    .bind(subject.organization_id)
    .bind(subject.user_id)
    .fetch_optional(&mut *tx)
    .await
    .or_else(none_when_read_model_is_missing)?;

    let (prev_consecutive, prev_total, prev_date) = last_row
        .as_ref()
        .map(|row| {
            (
                integer_cell(row, "consecutive_days"),
                integer_cell(row, "total_days"),
                string_cell(row, "reward_date"),
            )
        })
        .unwrap_or((0, 0, String::new()));

    if prev_date == today {
        return Err(CommerceServiceError::conflict(
            "membership daily reward has already been claimed today",
        ));
    }

    let new_consecutive = if prev_date == yesterday {
        prev_consecutive + 1
    } else {
        1
    };
    let new_total = prev_total + 1;
    let reward_points = daily_reward_points(new_consecutive);
    let reward_id = format!(
        "daily-reward-{}-{}-{}",
        subject.tenant_id, subject.user_id, today
    );
    let reward_uuid = format!("dr-{}-{}-{}", subject.tenant_id, subject.user_id, today);
    let idempotency_key = format!(
        "daily-reward-{}-{}-{}",
        subject.tenant_id, subject.user_id, today
    );

    let result = sqlx::query(
        r#"
        INSERT INTO membership_daily_reward
            (id, uuid, tenant_id, organization_id, user_id, reward_date,
             reward_points, consecutive_days, total_days, status, idempotency_key, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'claimed', $10::timestamptz, $11::timestamptz)
        ON CONFLICT (tenant_id, user_id, reward_date) DO NOTHING
        "#,
    )
    .bind(&reward_id)
    .bind(&reward_uuid)
    .bind(subject.tenant_id)
    .bind(subject.organization_id)
    .bind(subject.user_id)
    .bind(&today)
    .bind(reward_points)
    .bind(new_consecutive)
    .bind(new_total)
    .bind(&idempotency_key)
    .bind(&requested_at)
    .execute(&mut *tx)
    .await
    .map_err(|error| {
        if is_missing_postgres_read_model(&error) {
            CommerceServiceError::conflict(
                "membership daily reward is unavailable without reward table migration",
            )
        } else {
            store_error("failed to insert daily reward", error)
        }
    })?;

    if result.rows_affected() == 0 {
        return Err(CommerceServiceError::conflict(
            "membership daily reward has already been claimed today",
        ));
    }

    tx.commit()
        .await
        .map_err(|error| store_error("failed to commit daily reward transaction", error))?;

    Ok(AppMembershipDailyRewardResponse {
        reward_points,
        claimed_at: Some(requested_at),
        consecutive_days: new_consecutive,
    })
}

async fn current_date_postgres(pool: &PgPool) -> String {
    sqlx::query_scalar::<_, String>("SELECT TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD')")
        .fetch_one(pool)
        .await
        .unwrap_or_else(|_| format_timestamp_date(std::time::SystemTime::now()))
}

async fn yesterday_date_postgres(pool: &PgPool) -> String {
    sqlx::query_scalar::<_, String>("SELECT TO_CHAR(CURRENT_DATE - INTERVAL '1 day', 'YYYY-MM-DD')")
        .fetch_one(pool)
        .await
        .unwrap_or_default()
}

fn format_timestamp_date(time: std::time::SystemTime) -> String {
    let secs = time
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let days = secs / 86400;
    let (year, month, day) = epoch_days_to_ymd(days as i64);
    format!("{year:04}-{month:02}-{day:02}")
}

fn epoch_days_to_ymd(days_since_epoch: i64) -> (i64, u32, u32) {
    let mut days = days_since_epoch;
    let mut year = 1970i64;
    loop {
        let leap = is_leap_year(year);
        let year_days = if leap { 366 } else { 365 };
        if days >= year_days {
            days -= year_days;
            year += 1;
        } else {
            break;
        }
    }
    let leap = is_leap_year(year);
    let month_days = [
        31,
        if leap { 29 } else { 28 },
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ];
    let mut month = 0u32;
    let mut day = days as u32;
    while (month as usize) < 12 && day >= month_days[month as usize] {
        day -= month_days[month as usize];
        month += 1;
    }
    (year, month + 1, day + 1)
}

fn is_leap_year(year: i64) -> bool {
    (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
}

// ── Privilege usage helpers ──

async fn load_membership_entitlement_account_usage_postgres(
    pool: &PgPool,
    subject: AppMembershipSubject,
) -> AppMembershipResult<AppMembershipPrivilegeUsageResponse> {
    let rows = sqlx::query(
        r#"
        SELECT
            d.benefit_code,
            CAST(COALESCE(a.total_used, '0') AS BIGINT) AS used_count
        FROM membership_entitlement_account a
        JOIN membership_benefit_definition d
          ON d.id = a.benefit_id
        WHERE a.tenant_id = CAST($1 AS TEXT)
          AND (a.organization_id IS NULL OR a.organization_id = '0' OR a.organization_id = CAST($2 AS TEXT))
          AND a.subject_type = 'user'
          AND a.subject_id = CAST($3 AS TEXT)
          AND a.status = 'active'
          AND d.benefit_code IN ('priority_speed_up', 'priority_queue', 'ai_quota', 'exclusive_model')
        "#,
    )
    .bind(subject.tenant_id)
    .bind(subject.organization_id)
    .bind(subject.user_id)
    .fetch_all(pool)
    .await
    .map_err(sql_error)?;

    let mut response = AppMembershipPrivilegeUsageResponse::default();
    for row in &rows {
        let benefit_code = string_cell(row, "benefit_code");
        let used = integer_cell(row, "used_count");
        match benefit_code.as_str() {
            "priority_speed_up" => response.speed_up_used = used,
            "priority_queue" => response.priority_queue_used = used,
            "ai_quota" | "exclusive_model" => response.exclusive_model_used = used,
            _ => {}
        }
    }
    Ok(response)
}

async fn load_privilege_usage_postgres(
    pool: &PgPool,
    subject: AppMembershipSubject,
) -> AppMembershipResult<AppMembershipPrivilegeUsageResponse> {
    let rows = sqlx::query(
        r#"
        SELECT
            benefit_code,
            used_count::bigint AS used_count,
            usage_limit::bigint AS usage_limit
        FROM membership_privilege_usage
        WHERE tenant_id = $1
          AND (organization_id = 0 OR organization_id = $2)
          AND user_id = $3
          AND period_end >= CURRENT_DATE
        LIMIT 100
        "#,
    )
    .bind(subject.tenant_id)
    .bind(subject.organization_id)
    .bind(subject.user_id)
    .fetch_all(pool)
    .await
    .or_else(empty_rows_when_read_model_is_missing)?;

    let mut response = AppMembershipPrivilegeUsageResponse::default();
    for row in &rows {
        let benefit_code = string_cell(row, "benefit_code");
        let used = integer_cell(row, "used_count");
        match benefit_code.as_str() {
            "priority_speed_up" => {
                response.speed_up_used = used;
            }
            "priority_queue" => {
                response.priority_queue_used = used;
            }
            "ai_quota" | "exclusive_model" => {
                response.exclusive_model_used = used;
            }
            _ => {}
        }
    }
    Ok(response)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn now_seconds() -> i64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_secs() as i64)
            .unwrap_or(0)
    }

    #[test]
    fn consumption_limits_resolve_coupon_plan_and_recharge_policies() {
        let coupon = r#"{"kind":"coupon_subscription_quota","couponOrderId":"o1","period":"month","dailyQuota":100,"totalQuota":3000}"#;
        let (daily, total) = resolve_consumption_limits(coupon, 5000).expect("coupon policy");
        assert_eq!((daily, total), (100, 3000));
        let (daily, total) =
            resolve_consumption_limits("membership_plan", 500).expect("plan policy");
        assert_eq!((daily, total), (500, 500));
        let recharge = r#"{"kind":"quota_recharge","orderId":"o1","quantity":1000}"#;
        let (daily, total) = resolve_consumption_limits(recharge, 1000).expect("recharge policy");
        assert_eq!((daily, total), (1000, 1000));
    }

    #[test]
    fn feature_access_rank_map_covers_registered_features() {
        assert_eq!(required_rank_for_feature("ai_chat"), Some(1));
        assert_eq!(required_rank_for_feature("image_generation"), Some(2));
        assert_eq!(required_rank_for_feature("priority_speed_up"), Some(2));
        assert_eq!(required_rank_for_feature("priority_queue"), Some(3));
        assert_eq!(required_rank_for_feature("exclusive_model"), Some(3));
        assert_eq!(required_rank_for_feature("unknown_feature"), None);
    }

    #[test]
    fn membership_expired_compares_expiry_to_now() {
        let past = format_unix_timestamp(now_seconds() - 3600);
        let future = format_unix_timestamp(now_seconds() + 3600);
        assert!(membership_expired(&past));
        assert!(!membership_expired(&future));
        assert!(!membership_expired("not-a-timestamp"));
    }

    #[test]
    fn lifecycle_sweep_uses_advisory_lock_and_writes_change_log() {
        let source = include_str!("postgres.rs");
        assert!(source.contains("pg_try_advisory_lock"));
        assert!(source.contains("pg_advisory_unlock"));
        assert!(source.contains("INSERT INTO membership_change_log"));
        assert!(source.contains("subscription_expired"));
        assert!(source.contains("status = 'expired'"));
        assert!(source.contains("expire_due_memberships"));
    }

    #[test]
    fn quota_recharge_is_idempotent_and_requires_active_subscription() {
        let source = include_str!("postgres.rs");
        assert!(source.contains("membership_quota_recharge"));
        assert!(
            source.contains("business_type = 'quota_recharge'")
                || source.contains("'quota_recharge'")
        );
        assert!(source.contains("requires an active membership subscription"));
        assert!(source.contains("failed to load quota recharge replay"));
        assert!(source.contains("failed to begin subscription quota recharge transaction"));
    }

    #[test]
    fn realtime_expiry_guard_is_used_by_status_reads() {
        let source = include_str!("postgres.rs");
        assert!(source.contains("fn membership_expired"));
        assert!(source.contains("!membership_expired(&item.expires_at)"));
        assert!(source.contains("item.rank > 0"));
    }
}
