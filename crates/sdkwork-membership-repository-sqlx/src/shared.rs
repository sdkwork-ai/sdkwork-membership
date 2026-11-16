use std::collections::BTreeSet;

use chrono::{DateTime, Duration, NaiveDateTime, TimeZone, Utc};
use sdkwork_contract_service::{CommerceMoney, CommerceServiceError};
use sdkwork_utils_rust::parse_datetime;
use serde::Deserialize;
use serde_json::Value;

use crate::{
    AppMembershipBenefitItem, AppMembershipPackageGroupItem, AppMembershipPackageItem,
    AppMembershipPlanItem, AppMembershipPrivilegeUsageResponse,
    FulfillPaidMembershipPurchaseCommand, SubmitMembershipPurchaseCommand,
};

/// Trim and drop empty optional query/header values. Shared by app and admin routers.
pub fn normalize_optional_text(value: Option<String>) -> Option<String> {
    value.map(|v| v.trim().to_owned()).filter(|v| !v.is_empty())
}

/// Escape the `LIKE`/`ILIKE` metacharacters in a user-supplied search term.
///
/// PostgreSQL gives `%`, `_`, and the escape character itself pattern meaning,
/// so a raw `q` value would widen the filter into a wildcard query (`%` matches
/// every row, `_` silently matches any character). Callers build
/// `%escaped%` from this value and declare `ESCAPE '\'` on the predicate, so a
/// literal `%` or `_` in a subscription id or plan name still matches itself.
pub fn escape_like_pattern(value: &str) -> String {
    let mut escaped = String::with_capacity(value.len());
    for character in value.chars() {
        if matches!(character, '\\' | '%' | '_') {
            escaped.push('\\');
        }
        escaped.push(character);
    }
    escaped
}

/// Current UTC timestamp formatted as `%Y-%m-%d %H:%M:%S`. Shared by app and admin routers.
pub fn current_timestamp_string() -> String {
    format_unix_timestamp(Utc::now().timestamp())
}

/// Format a unix timestamp (seconds) as `%Y-%m-%d %H:%M:%S`. Shared by app and admin routers.
pub fn format_unix_timestamp(seconds: i64) -> String {
    Utc.timestamp_opt(seconds, 0)
        .single()
        .map(|ts| ts.format("%Y-%m-%d %H:%M:%S").to_string())
        .unwrap_or_else(|| format!("{seconds}"))
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CouponSubscriptionQuotaPolicy {
    pub kind: String,
    pub coupon_order_id: String,
    pub period: String,
    pub daily_quota: i64,
    pub total_quota: i64,
}

pub(crate) fn parse_coupon_subscription_quota_policy(
    value: &str,
) -> Result<CouponSubscriptionQuotaPolicy, CommerceServiceError> {
    let policy: CouponSubscriptionQuotaPolicy = serde_json::from_str(value).map_err(|_| {
        CommerceServiceError::conflict("coupon subscription quota policy is invalid")
    })?;
    if policy.kind != "coupon_subscription_quota"
        || policy.coupon_order_id.trim().is_empty()
        || !matches!(policy.period.as_str(), "day" | "week" | "month" | "year")
        || policy.daily_quota <= 0
        || policy.total_quota < policy.daily_quota
    {
        return Err(CommerceServiceError::conflict(
            "coupon subscription quota policy is invalid",
        ));
    }
    Ok(policy)
}

pub(crate) fn validate_coupon_subscription_quota_contract(
    period: &str,
    duration_days: i64,
    daily_quota: i64,
    total_quota: i64,
) -> Result<(), CommerceServiceError> {
    if duration_days <= 0 || daily_quota <= 0 || total_quota < daily_quota {
        return Err(CommerceServiceError::validation(
            "coupon subscription duration and quotas are invalid",
        ));
    }

    let duration_matches_period = match period {
        "day" => duration_days == 1,
        "week" => duration_days == 7,
        "month" => (28..=31).contains(&duration_days),
        "year" => (365..=366).contains(&duration_days),
        _ => {
            return Err(CommerceServiceError::validation(
                "coupon subscription period is invalid",
            ));
        }
    };
    if !duration_matches_period {
        return Err(CommerceServiceError::validation(
            "coupon subscription duration does not match its period",
        ));
    }
    if period == "day" && total_quota != daily_quota {
        return Err(CommerceServiceError::validation(
            "daily coupon subscription total quota must equal daily quota",
        ));
    }
    if total_quota > daily_quota.saturating_mul(duration_days) {
        return Err(CommerceServiceError::validation(
            "coupon subscription total quota exceeds its consumable limit",
        ));
    }
    Ok(())
}

pub(crate) fn subscription_quota_day_bounds(
    requested_at: &str,
) -> Result<(String, String, String), CommerceServiceError> {
    let requested_at = requested_at.trim();
    let timestamp = DateTime::parse_from_rfc3339(requested_at)
        .map(|value| value.with_timezone(&Utc))
        .or_else(|_| {
            NaiveDateTime::parse_from_str(requested_at, "%Y-%m-%d %H:%M:%S")
                .map(|value| value.and_utc())
        })
        .map_err(|_| CommerceServiceError::validation("requested_at must be a UTC timestamp"))?;
    let date = timestamp.date_naive();
    let next_date = date
        .checked_add_signed(Duration::days(1))
        .ok_or_else(|| CommerceServiceError::validation("requested_at is out of range"))?;
    Ok((
        date.format("%Y-%m-%d").to_string(),
        format!("{} 00:00:00", date.format("%Y-%m-%d")),
        format!("{} 00:00:00", next_date.format("%Y-%m-%d")),
    ))
}

pub(crate) fn stable_membership_i64_id(value: &str) -> i64 {
    let mut hash = 0xcbf29ce484222325u64;
    for byte in value.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    (hash & i64::MAX as u64).max(1) as i64
}

pub(crate) const POINTS_ASSET_CODE: &str = "points";
pub(crate) const POINTS_CURRENCY_CODE: &str = "POINT";

/// Default catalog tenant used by membership catalog queries (plans, packages,
/// package groups) whose trait signatures do not carry a request subject.
/// Replaces the previously inline `'100001'` literal scattered across SQL.
pub(crate) const DEFAULT_CATALOG_TENANT_ID: i64 = 100001;

/// Default catalog organization used by membership catalog queries. Replaces
/// the previously inline `'0'` literal scattered across SQL.
pub(crate) const DEFAULT_CATALOG_ORGANIZATION_ID: i64 = 0;

/// Resolve tenant scope for catalog reads from the authenticated subject, or the
/// seeded demo tenant for guest browsing.
pub(crate) fn resolve_catalog_scope(
    catalog_subject: Option<crate::AppMembershipSubject>,
) -> (i64, i64) {
    catalog_subject
        .map(|subject| (subject.tenant_id, subject.organization_id))
        .unwrap_or((DEFAULT_CATALOG_TENANT_ID, DEFAULT_CATALOG_ORGANIZATION_ID))
}

pub(crate) fn validate_membership_purchase_action(
    action: &str,
    membership_active: bool,
    current_rank: i64,
    target_plan_rank: i64,
) -> Result<(), CommerceServiceError> {
    match action.trim().to_ascii_lowercase().as_str() {
        "purchase" => Ok(()),
        "renew" => {
            if !membership_active {
                return Err(CommerceServiceError::validation(
                    "membership renew requires an active membership",
                ));
            }
            if target_plan_rank != current_rank {
                return Err(CommerceServiceError::validation(
                    "membership renew requires the same plan rank",
                ));
            }
            Ok(())
        }
        "upgrade" => {
            if !membership_active {
                return Err(CommerceServiceError::validation(
                    "membership upgrade requires an active membership",
                ));
            }
            if target_plan_rank <= current_rank {
                return Err(CommerceServiceError::validation(
                    "membership upgrade requires a higher plan rank",
                ));
            }
            Ok(())
        }
        _ => Err(CommerceServiceError::validation(
            "membership purchase action is invalid",
        )),
    }
}

pub(crate) fn plan_rank_from_code(plan_no: &str) -> i64 {
    match plan_no.trim().to_ascii_lowercase().as_str() {
        "free" => 0,
        "pro" => 1,
        "max" => 2,
        "vip" => 3,
        _ => 0,
    }
}

pub(crate) fn plan_code_from_rank(rank: i64) -> &'static str {
    match rank {
        1 => "pro",
        2 => "max",
        3 => "vip",
        _ => "free",
    }
}

pub(crate) fn default_plan_name(rank: i64) -> &'static str {
    match rank {
        1 => "Pro member",
        2 => "Max member",
        3 => "VIP member",
        _ => "Free",
    }
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn map_membership_package_record(
    id: i64,
    storage_id: String,
    plan_storage_id: String,
    name: String,
    description: Option<String>,
    price: String,
    original_price: Option<String>,
    point_amount: i64,
    duration_days: i64,
    plan_name: Option<String>,
    sort_weight: i64,
    recommended: bool,
    tags_json: &str,
    group_external_id: i64,
    _group_name: String,
    _group_description: Option<String>,
    _group_sort_weight: i64,
    plan_no: Option<String>,
    rank: i64,
    _sku_id: Option<String>,
    category: String,
    audience: Option<String>,
    price_unit: Option<String>,
    seat_min: i64,
    seat_max: i64,
    seat_points_amount: i64,
    recurrence_cycle: Option<String>,
) -> Option<ParsedMembershipPackage> {
    if id <= 0
        || storage_id.trim().is_empty()
        || plan_storage_id.trim().is_empty()
        || group_external_id <= 0
    {
        return None;
    }
    let plan_no = plan_no.unwrap_or_else(|| plan_code_from_rank(rank).to_owned());
    let rank = if rank == 0 {
        plan_rank_from_code(&plan_no)
    } else {
        rank
    };
    let audience = match audience
        .as_deref()
        .map(str::trim)
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("team") => "team".to_owned(),
        _ => "personal".to_owned(),
    };
    let price_unit = match price_unit
        .as_deref()
        .map(str::trim)
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("seat") => "seat".to_owned(),
        _ => "package".to_owned(),
    };
    let recurrence_cycle = recurrence_cycle
        .map(|value| value.trim().to_ascii_lowercase())
        .filter(|value| !value.is_empty());
    let item = AppMembershipPackageItem {
        id,
        package_group_id: group_external_id.to_string(),
        category: if category.trim().is_empty() {
            "token".to_owned()
        } else {
            category
        },
        audience,
        name,
        description,
        price,
        original_price,
        price_unit,
        point_amount: point_amount.max(0),
        duration_days: duration_days.max(0),
        plan_name: plan_name.or_else(|| Some(default_plan_name(rank).to_owned())),
        plan_id: plan_storage_id.clone(),
        plan_rank: rank,
        recurrence_cycle,
        seat_min: seat_min.max(1),
        seat_max: seat_max.max(seat_min.max(1)),
        seat_points_amount: seat_points_amount.max(0),
        sort_weight,
        recommended,
        tags: string_array_from_json(tags_json),
    };
    Some(ParsedMembershipPackage {
        plan_no,
        plan_storage_id,
        rank,
        storage_id,
        item,
    })
}

#[derive(Debug, Clone)]
pub(crate) struct ParsedMembershipPackage {
    pub plan_no: String,
    pub plan_storage_id: String,
    pub rank: i64,
    pub storage_id: String,
    pub item: AppMembershipPackageItem,
}

#[derive(Debug, Clone)]
pub(crate) struct CurrentMembershipSnapshot {
    pub membership_id: String,
    pub _rank: i64,
    pub _status: String,
    pub expires_at: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum MembershipPurchasePersistenceMode {
    New,
    Renew,
    Upgrade,
}

#[derive(Debug, Clone)]
pub(crate) struct MembershipPurchaseBinding {
    pub membership_uuid: String,
    pub period_starts_at: String,
    pub persistence_mode: MembershipPurchasePersistenceMode,
}

pub(crate) fn resolve_membership_purchase_binding(
    command: &SubmitMembershipPurchaseCommand,
    current: Option<CurrentMembershipSnapshot>,
    membership_active: bool,
) -> MembershipPurchaseBinding {
    let action = command.action.trim().to_ascii_lowercase();
    match action.as_str() {
        "renew" if membership_active => {
            let current = current.expect("renew requires active membership");
            MembershipPurchaseBinding {
                membership_uuid: current.membership_id.clone(),
                period_starts_at: later_membership_timestamp(
                    &current.expires_at,
                    &command.requested_at,
                ),
                persistence_mode: MembershipPurchasePersistenceMode::Renew,
            }
        }
        "upgrade" if membership_active => {
            let current = current.expect("upgrade requires active membership");
            MembershipPurchaseBinding {
                membership_uuid: current.membership_id.clone(),
                period_starts_at: command.requested_at.clone(),
                persistence_mode: MembershipPurchasePersistenceMode::Upgrade,
            }
        }
        _ => MembershipPurchaseBinding {
            membership_uuid: command.membership_uuid.clone(),
            period_starts_at: command.requested_at.clone(),
            persistence_mode: MembershipPurchasePersistenceMode::New,
        },
    }
}

pub(crate) fn paid_membership_purchase_submit_command(
    command: &FulfillPaidMembershipPurchaseCommand,
) -> Result<SubmitMembershipPurchaseCommand, CommerceServiceError> {
    if command.subject.tenant_id <= 0
        || command.subject.organization_id < 0
        || command.subject.user_id <= 0
    {
        return Err(CommerceServiceError::validation(
            "membership fulfillment subject identifiers are invalid",
        ));
    }
    if command.package_id <= 0 {
        return Err(CommerceServiceError::validation(
            "membership fulfillment package id must be greater than zero",
        ));
    }
    let order_id = required_paid_purchase_text(&command.order_id, "order id")?;
    let membership_id = required_paid_purchase_text(&command.membership_id, "membership id")?;
    let order_no = required_paid_purchase_text(&command.order_no, "order number")?;
    required_paid_purchase_text(&command.request_no, "request number")?;
    required_paid_purchase_text(&command.idempotency_key, "idempotency key")?;
    let action = command.action.trim().to_ascii_lowercase();
    if !matches!(action.as_str(), "purchase" | "renew" | "upgrade") {
        return Err(CommerceServiceError::validation(
            "membership fulfillment action is invalid",
        ));
    }
    if command.seats < 1 {
        return Err(CommerceServiceError::validation(
            "membership fulfillment seat quantity must be at least one",
        ));
    }
    let organization_subject_id = command
        .organization_subject_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned);

    Ok(SubmitMembershipPurchaseCommand {
        subject: command.subject,
        package_id: command.package_id,
        order_uuid: order_id.to_owned(),
        membership_uuid: membership_id.to_owned(),
        order_no: order_no.to_owned(),
        idempotency_key: format!("membership-purchase:reserve:{order_id}"),
        requested_at: normalize_membership_timestamp(&command.paid_at)?,
        action,
        seats: command.seats,
        organization_subject_id,
    })
}

fn required_paid_purchase_text<'a>(
    value: &'a str,
    name: &str,
) -> Result<&'a str, CommerceServiceError> {
    let value = value.trim();
    if value.is_empty() {
        return Err(CommerceServiceError::validation(format!(
            "membership fulfillment {name} is required"
        )));
    }
    Ok(value)
}

pub(crate) fn normalize_membership_timestamp(value: &str) -> Result<String, CommerceServiceError> {
    let value = value.trim();
    let parsed = parse_datetime(value, None).or_else(|| {
        NaiveDateTime::parse_from_str(value, "%Y-%m-%d %H:%M:%S")
            .ok()
            .map(|timestamp| Utc.from_utc_datetime(&timestamp))
    });
    parsed
        .map(|timestamp| timestamp.format("%Y-%m-%d %H:%M:%S").to_string())
        .ok_or_else(|| {
            CommerceServiceError::validation(
                "membership fulfillment paid_at must be a valid timestamp",
            )
        })
}

pub(crate) fn later_membership_timestamp(current: &str, requested_at: &str) -> String {
    match (
        normalize_membership_timestamp(current),
        normalize_membership_timestamp(requested_at),
    ) {
        (Ok(left), Ok(right)) if left >= right => left,
        (Ok(_), Ok(right)) => right,
        (Ok(left), Err(_)) => left,
        _ => requested_at.trim().to_owned(),
    }
}

pub(crate) fn build_package_group_from_packages(
    package_group_id: i64,
    name: String,
    description: Option<String>,
    sort_weight: i64,
    packages: Vec<AppMembershipPackageItem>,
    category: String,
    audience: Option<String>,
    billing_cycle: Option<String>,
    duration_days: i64,
) -> AppMembershipPackageGroupItem {
    let audience = match audience
        .as_deref()
        .map(str::trim)
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("team") => "team".to_owned(),
        _ => "personal".to_owned(),
    };
    let billing_cycle = billing_cycle
        .map(|value| value.trim().to_ascii_lowercase())
        .filter(|value| !value.is_empty());
    AppMembershipPackageGroupItem {
        id: package_group_id,
        category: if category.trim().is_empty() {
            "token".to_owned()
        } else {
            category
        },
        audience,
        name,
        description,
        billing_cycle,
        duration_days: duration_days.max(0),
        sort_weight,
        packages,
    }
}

#[allow(dead_code)]
pub(crate) fn default_free_plan() -> AppMembershipPlanItem {
    AppMembershipPlanItem {
        id: 0,
        category: "token".to_owned(),
        name: "Free".to_owned(),
        rank: 0,
        required_points: Some(0),
        description: Some(
            "Basic model catalog access, public routes, and a small trial quota.".to_owned(),
        ),
        icon: None,
        badge: Some("Free".to_owned()),
    }
}

#[derive(Debug, Clone)]
pub(crate) struct StoredMembershipPlan {
    pub id: i64,
    pub storage_id: String,
    pub plan_no: String,
    /// Catalog audience (`personal` | `team`) of the plan row. Team plans are
    /// fulfilled as organization subscriptions with licensed seats.
    pub audience: String,
    pub item: AppMembershipPlanItem,
    pub benefits: Vec<AppMembershipBenefitItem>,
    pub rank: i64,
}

pub(crate) fn privilege_usage_from_benefits(
    benefits: &[AppMembershipBenefitItem],
) -> AppMembershipPrivilegeUsageResponse {
    AppMembershipPrivilegeUsageResponse {
        speed_up_used: 0,
        speed_up_limit: benefit_limit(benefits, &["priority_speed_up"]),
        priority_queue_used: 0,
        priority_queue_limit: benefit_limit(benefits, &["priority_queue"]),
        exclusive_model_used: 0,
        exclusive_model_limit: benefit_limit(benefits, &["ai_quota"]),
    }
}

fn benefit_limit(benefits: &[AppMembershipBenefitItem], keys: &[&str]) -> i64 {
    let key_set = keys.iter().copied().collect::<BTreeSet<_>>();
    benefits
        .iter()
        .find_map(|item| {
            let key = item.benefit_key.as_deref()?;
            if key_set.contains(key) {
                item.usage_limit
            } else {
                None
            }
        })
        .unwrap_or(0)
}

pub(crate) fn decimal_string(
    value: &str,
    field_name: &str,
) -> Result<String, CommerceServiceError> {
    CommerceMoney::new(value)
        .map(|amount| amount.as_str().to_owned())
        .map_err(|_| CommerceServiceError::storage(format!("invalid {field_name}: {value}")))
}

pub(crate) fn parse_points_amount(value: &str) -> i64 {
    let normalized = value.trim();
    if normalized.is_empty() {
        return 0;
    }
    let unsigned = normalized.trim_start_matches('+');
    let Some(integer_part) = unsigned.split('.').next() else {
        return 0;
    };
    integer_part.parse::<i64>().unwrap_or(0)
}

fn string_array_from_json(value: &str) -> Vec<String> {
    serde_json::from_str::<Value>(value)
        .ok()
        .and_then(|parsed| parsed.as_array().cloned())
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(str::trim)
                .filter(|item| !item.is_empty())
                .map(str::to_owned)
                .collect()
        })
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::validate_coupon_subscription_quota_contract;

    #[test]
    fn coupon_subscription_quota_contract_accepts_supported_periods() {
        for (period, duration_days) in [("day", 1), ("week", 7), ("month", 30), ("year", 365)] {
            let daily_quota = 10;
            let total_quota = if period == "day" {
                daily_quota
            } else {
                daily_quota * duration_days
            };
            validate_coupon_subscription_quota_contract(
                period,
                duration_days,
                daily_quota,
                total_quota,
            )
            .expect("supported coupon subscription period");
        }
    }

    #[test]
    fn coupon_subscription_quota_contract_rejects_inconsistent_limits() {
        for (period, duration_days, daily_quota, total_quota) in [
            ("day", 2, 10, 10),
            ("week", 6, 10, 60),
            ("month", 30, 10, 301),
            ("year", 364, 10, 3_640),
            ("day", 1, 10, 9),
        ] {
            assert!(validate_coupon_subscription_quota_contract(
                period,
                duration_days,
                daily_quota,
                total_quota,
            )
            .is_err());
        }
    }
}
