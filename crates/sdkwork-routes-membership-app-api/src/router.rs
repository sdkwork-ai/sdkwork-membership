//! App-API HTTP adapters for the membership surface (`/app/v3/api/memberships/*`).
//!
//! Handlers receive the canonical `WebRequestContext` injected by the
//! `sdkwork-web-framework` interceptor chain and emit responses through the
//! standard `SdkWorkApiResponse` / `application/problem+json` envelopes defined
//! in `API_SPEC.md` §15–§16. No handler hand-builds a wire envelope.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use axum::extract::rejection::JsonRejection;
use axum::extract::{Path, Query, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use sqlx::PgPool;

use crate::response::{finish_api_created, finish_api_json, item_envelope, ApiProblem, ApiResult};
use crate::subject::numeric_runtime_subject_from_context;
use sdkwork_membership_repository_sqlx::shared::{
    current_timestamp_string, normalize_optional_text,
};
use sdkwork_membership_repository_sqlx::{
    is_valid_membership_category, AppMembershipEntityIdGenerator, AppMembershipListQuery,
    AppMembershipPointsHistoryQuery, AppMembershipPurchaseOutcome, AppMembershipResult,
    AppMembershipStore, AppMembershipSubject, FeatureAccessCheckQuery,
    PostgresCommerceMembershipStore, SubmitMembershipPurchaseCommand,
};
use sdkwork_web_core::WebRequestContext;

#[derive(Clone)]
struct AppMembershipState {
    store: Arc<dyn AppMembershipStore + Send + Sync>,
    entity_id_generator: Arc<dyn AppMembershipEntityIdGenerator + Send + Sync>,
    require_subject: bool,
}

#[derive(Debug, Deserialize)]
struct MembershipCatalogQuery {
    category: Option<String>,
    #[serde(default, with = "sdkwork_utils_rust::serde_int64::option")]
    plan_id: Option<i64>,
    recommended_only: Option<bool>,
    page: Option<i64>,
    #[serde(rename = "page_size")]
    page_size: Option<i64>,
    cursor: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MembershipBenefitQuery {
    #[serde(default, with = "sdkwork_utils_rust::serde_int64::option")]
    plan_id: Option<i64>,
    page: Option<i64>,
    #[serde(rename = "page_size")]
    page_size: Option<i64>,
    cursor: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MembershipPackagesQuery {
    category: Option<String>,
    #[serde(default, with = "sdkwork_utils_rust::serde_int64::option")]
    package_group_id: Option<i64>,
    #[serde(default, with = "sdkwork_utils_rust::serde_int64::option")]
    plan_id: Option<i64>,
    page: Option<i64>,
    #[serde(rename = "page_size")]
    page_size: Option<i64>,
    cursor: Option<String>,
}

#[derive(Debug, Deserialize)]
struct MembershipPointsHistoryQuery {
    page: Option<i64>,
    #[serde(rename = "page_size")]
    page_size: Option<i64>,
    cursor: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SubmitMembershipPurchaseRequest {
    #[serde(with = "sdkwork_utils_rust::serde_int64")]
    package_id: i64,
    order_id: String,
    request_no: String,
    coupon_id: Option<String>,
}

#[derive(Debug, Default)]
pub struct TimestampMembershipEntityIdGenerator {
    sequence: AtomicU64,
}

impl AppMembershipEntityIdGenerator for TimestampMembershipEntityIdGenerator {
    fn generate_entity_uuid(&self) -> AppMembershipResult<String> {
        let now = current_unix_timestamp();
        let sequence = self.sequence.fetch_add(1, Ordering::Relaxed);
        Ok(format!("membership-{now}-{sequence:016x}"))
    }
}

fn list_query_from_params(
    page: Option<i64>,
    page_size: Option<i64>,
    cursor: Option<String>,
) -> AppMembershipListQuery {
    AppMembershipListQuery {
        page,
        page_size,
        cursor: normalize_optional_text(cursor),
        category: None,
    }
}

fn list_query_with_category(
    category: Option<String>,
    page: Option<i64>,
    page_size: Option<i64>,
    cursor: Option<String>,
) -> Result<AppMembershipListQuery, ApiProblem> {
    let category = match category {
        None => None,
        Some(raw) if raw.trim().is_empty() => None,
        Some(raw) => {
            let normalized = raw.trim().to_ascii_lowercase();
            if is_valid_membership_category(&normalized) {
                Some(normalized)
            } else {
                return Err(ApiProblem::bad_request(
                    "membership category must be token or community",
                ));
            }
        }
    };
    Ok(AppMembershipListQuery {
        page,
        page_size,
        cursor: normalize_optional_text(cursor),
        category,
    })
}

#[allow(dead_code)]
pub fn app_membership_router_with_postgres_pool(pool: PgPool) -> Router {
    app_membership_router_with_store(
        Arc::new(PostgresCommerceMembershipStore::new(pool)),
        Arc::new(TimestampMembershipEntityIdGenerator::default()),
    )
}

pub fn app_membership_router_with_store(
    store: Arc<dyn AppMembershipStore + Send + Sync>,
    entity_id_generator: Arc<dyn AppMembershipEntityIdGenerator + Send + Sync>,
) -> Router {
    app_membership_router_with_state(store, entity_id_generator, true)
}

fn app_membership_router_with_state(
    store: Arc<dyn AppMembershipStore + Send + Sync>,
    entity_id_generator: Arc<dyn AppMembershipEntityIdGenerator + Send + Sync>,
    require_subject: bool,
) -> Router {
    Router::new()
        .route("/app/v3/api/memberships/current", get(fetch_info))
        .route("/app/v3/api/memberships/current/status", get(fetch_status))
        .route("/app/v3/api/memberships/plans", get(fetch_plans))
        .route("/app/v3/api/memberships/benefits", get(fetch_benefits))
        .route(
            "/app/v3/api/memberships/package_groups",
            get(fetch_package_groups),
        )
        .route(
            "/app/v3/api/memberships/package_groups/{packageGroupId}",
            get(fetch_package_group),
        )
        .route(
            "/app/v3/api/memberships/package_groups/{packageGroupId}/packages",
            get(fetch_package_group_packages),
        )
        .route("/app/v3/api/memberships/packages", get(fetch_packages))
        .route(
            "/app/v3/api/memberships/packages/{packageId}",
            get(fetch_package),
        )
        .route("/app/v3/api/memberships/purchases", post(purchase))
        .route("/app/v3/api/memberships/purchases/renew", post(renew))
        .route("/app/v3/api/memberships/purchases/upgrade", post(upgrade))
        .route(
            "/app/v3/api/memberships/points/balance",
            get(fetch_points_balance),
        )
        .route(
            "/app/v3/api/memberships/points/history",
            get(fetch_points_history),
        )
        .route(
            "/app/v3/api/memberships/points/daily_rewards",
            post(claim_daily_reward),
        )
        .route(
            "/app/v3/api/memberships/points/daily_rewards/status",
            get(fetch_daily_reward_status),
        )
        .route(
            "/app/v3/api/memberships/privileges/usage",
            get(fetch_privilege_usage),
        )
        .route(
            "/app/v3/api/memberships/privileges/speed_ups",
            post(create_speed_up),
        )
        .route(
            "/app/v3/api/memberships/access/checks",
            post(check_feature_access),
        )
        .with_state(AppMembershipState {
            store,
            entity_id_generator,
            require_subject,
        })
}

async fn fetch_info(
    ctx: WebRequestContext,
    State(state): State<AppMembershipState>,
) -> axum::response::Response {
    finish_api_json(
        &ctx,
        async {
            let subject = resolve_membership_subject(&state, &ctx)?;
            let data = state.store.load_info(subject).await.map_err(|e| {
                ApiProblem::from_service("membership info read model is unavailable", e)
            })?;
            Ok(item_envelope(data))
        }
        .await,
    )
}

async fn fetch_status(
    ctx: WebRequestContext,
    State(state): State<AppMembershipState>,
) -> axum::response::Response {
    finish_api_json(
        &ctx,
        async {
            let subject = resolve_membership_subject(&state, &ctx)?;
            let data = state.store.load_status(subject).await.map_err(|e| {
                ApiProblem::from_service("membership status read model is unavailable", e)
            })?;
            Ok(item_envelope(data))
        }
        .await,
    )
}

async fn fetch_plans(
    ctx: WebRequestContext,
    State(state): State<AppMembershipState>,
    Query(query): Query<MembershipCatalogQuery>,
) -> axum::response::Response {
    finish_api_json(
        &ctx,
        async {
            let catalog_subject = resolve_optional_membership_subject(&ctx);
            let list_query = list_query_with_category(
                query.category,
                query.page,
                query.page_size,
                query.cursor,
            )?;
            let data = state
                .store
                .load_plans(catalog_subject, list_query)
                .await
                .map_err(|e| {
                    ApiProblem::from_service("membership plans read model is unavailable", e)
                })?;
            Ok(data)
        }
        .await,
    )
}

async fn fetch_benefits(
    ctx: WebRequestContext,
    State(state): State<AppMembershipState>,
    Query(query): Query<MembershipBenefitQuery>,
) -> axum::response::Response {
    finish_api_json(
        &ctx,
        async {
            let subject = resolve_optional_membership_subject(&ctx);
            let data = state
                .store
                .load_benefits(
                    subject,
                    query.plan_id,
                    list_query_from_params(query.page, query.page_size, query.cursor),
                )
                .await
                .map_err(|e| {
                    ApiProblem::from_service("membership benefits read model is unavailable", e)
                })?;
            Ok(data)
        }
        .await,
    )
}

async fn fetch_package_groups(
    ctx: WebRequestContext,
    State(state): State<AppMembershipState>,
    Query(query): Query<MembershipCatalogQuery>,
) -> axum::response::Response {
    finish_api_json(
        &ctx,
        async {
            let catalog_subject = resolve_optional_membership_subject(&ctx);
            let list_query = list_query_with_category(
                query.category,
                query.page,
                query.page_size,
                query.cursor,
            )?;
            let data = state
                .store
                .load_package_groups(
                    catalog_subject,
                    query.plan_id,
                    query.recommended_only.unwrap_or(false),
                    list_query,
                )
                .await
                .map_err(|e| {
                    ApiProblem::from_service(
                        "membership package groups read model is unavailable",
                        e,
                    )
                })?;
            Ok(data)
        }
        .await,
    )
}

async fn fetch_package_group(
    ctx: WebRequestContext,
    State(state): State<AppMembershipState>,
    Path(package_group_id): Path<i64>,
) -> axum::response::Response {
    finish_api_json(
        &ctx,
        async {
            let catalog_subject = resolve_optional_membership_subject(&ctx);
            let item = state
                .store
                .load_package_group(catalog_subject, package_group_id)
                .await
                .map_err(|e| {
                    ApiProblem::from_service(
                        "membership package group read model is unavailable",
                        e,
                    )
                })?
                .ok_or_else(|| ApiProblem::not_found("membership package group was not found"))?;
            Ok(item_envelope(item))
        }
        .await,
    )
}

async fn fetch_package_group_packages(
    ctx: WebRequestContext,
    State(state): State<AppMembershipState>,
    Path(package_group_id): Path<i64>,
    Query(query): Query<MembershipPackagesQuery>,
) -> axum::response::Response {
    finish_api_json(
        &ctx,
        async {
            let catalog_subject = resolve_optional_membership_subject(&ctx);
            let list_query = list_query_with_category(
                query.category,
                query.page,
                query.page_size,
                query.cursor,
            )?;
            let data = state
                .store
                .load_packages(
                    catalog_subject,
                    Some(package_group_id),
                    query.plan_id,
                    list_query,
                )
                .await
                .map_err(|e| {
                    ApiProblem::from_service("membership package read model is unavailable", e)
                })?;
            Ok(data)
        }
        .await,
    )
}

async fn fetch_packages(
    ctx: WebRequestContext,
    State(state): State<AppMembershipState>,
    Query(query): Query<MembershipPackagesQuery>,
) -> axum::response::Response {
    finish_api_json(
        &ctx,
        async {
            let catalog_subject = resolve_optional_membership_subject(&ctx);
            let list_query = list_query_with_category(
                query.category,
                query.page,
                query.page_size,
                query.cursor,
            )?;
            let data = state
                .store
                .load_packages(
                    catalog_subject,
                    query.package_group_id,
                    query.plan_id,
                    list_query,
                )
                .await
                .map_err(|e| {
                    ApiProblem::from_service("membership package read model is unavailable", e)
                })?;
            Ok(data)
        }
        .await,
    )
}

async fn fetch_package(
    ctx: WebRequestContext,
    State(state): State<AppMembershipState>,
    Path(package_id): Path<i64>,
) -> axum::response::Response {
    finish_api_json(
        &ctx,
        async {
            let catalog_subject = resolve_optional_membership_subject(&ctx);
            let item = state
                .store
                .load_package(catalog_subject, package_id)
                .await
                .map_err(|e| {
                    ApiProblem::from_service("membership package read model is unavailable", e)
                })?
                .ok_or_else(|| ApiProblem::not_found("membership package was not found"))?;
            Ok(item_envelope(item))
        }
        .await,
    )
}

async fn fetch_points_balance(
    ctx: WebRequestContext,
    State(state): State<AppMembershipState>,
) -> axum::response::Response {
    finish_api_json(
        &ctx,
        async {
            let subject = resolve_membership_subject(&state, &ctx)?;
            let data = state
                .store
                .load_points_balance(subject)
                .await
                .map_err(|e| {
                    ApiProblem::from_service(
                        "membership points balance read model is unavailable",
                        e,
                    )
                })?;
            Ok(item_envelope(data))
        }
        .await,
    )
}

async fn fetch_points_history(
    ctx: WebRequestContext,
    State(state): State<AppMembershipState>,
    Query(query): Query<MembershipPointsHistoryQuery>,
) -> axum::response::Response {
    finish_api_json(
        &ctx,
        async {
            let subject = resolve_membership_subject(&state, &ctx)?;
            let data = state
                .store
                .load_points_history(
                    subject,
                    AppMembershipPointsHistoryQuery {
                        page: query.page,
                        page_size: query.page_size,
                        cursor: normalize_optional_text(query.cursor),
                    },
                )
                .await
                .map_err(|e| {
                    ApiProblem::from_service(
                        "membership points history read model is unavailable",
                        e,
                    )
                })?;
            Ok(data)
        }
        .await,
    )
}

async fn fetch_daily_reward_status(
    ctx: WebRequestContext,
    State(state): State<AppMembershipState>,
) -> axum::response::Response {
    finish_api_json(
        &ctx,
        async {
            let subject = resolve_membership_subject(&state, &ctx)?;
            let data = state
                .store
                .load_daily_reward_status(subject)
                .await
                .map_err(|e| {
                    ApiProblem::from_service("membership daily reward status is unavailable", e)
                })?;
            Ok(item_envelope(data))
        }
        .await,
    )
}

async fn fetch_privilege_usage(
    ctx: WebRequestContext,
    State(state): State<AppMembershipState>,
) -> axum::response::Response {
    finish_api_json(
        &ctx,
        async {
            let subject = resolve_membership_subject(&state, &ctx)?;
            let data = state
                .store
                .load_privilege_usage(subject)
                .await
                .map_err(|e| {
                    ApiProblem::from_service(
                        "membership privilege usage read model is unavailable",
                        e,
                    )
                })?;
            Ok(item_envelope(data))
        }
        .await,
    )
}

async fn purchase(
    ctx: WebRequestContext,
    State(state): State<AppMembershipState>,
    Json(request): Json<SubmitMembershipPurchaseRequest>,
) -> axum::response::Response {
    finish_api_created(
        &ctx,
        submit_purchase(&ctx, &state, request, "purchase").await,
    )
}

async fn renew(
    ctx: WebRequestContext,
    State(state): State<AppMembershipState>,
    Json(request): Json<SubmitMembershipPurchaseRequest>,
) -> axum::response::Response {
    finish_api_json(&ctx, submit_purchase(&ctx, &state, request, "renew").await)
}

async fn upgrade(
    ctx: WebRequestContext,
    State(state): State<AppMembershipState>,
    Json(request): Json<SubmitMembershipPurchaseRequest>,
) -> axum::response::Response {
    finish_api_json(
        &ctx,
        submit_purchase(&ctx, &state, request, "upgrade").await,
    )
}

async fn claim_daily_reward(
    ctx: WebRequestContext,
    State(state): State<AppMembershipState>,
) -> axum::response::Response {
    finish_api_created(
        &ctx,
        async {
            let subject = resolve_required_membership_subject(&state, &ctx)?;
            state
                .store
                .claim_daily_reward(subject, current_timestamp_string())
                .await
                .map_err(|e| {
                    ApiProblem::from_service("membership daily reward command is unavailable", e)
                })
                .map(item_envelope)
        }
        .await,
    )
}

/// 会员功能等级门槛校验：功能码解析所需等级（或显式指定），与实时会员状态比对。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FeatureAccessCheckRequest {
    feature_code: Option<String>,
    #[serde(with = "sdkwork_utils_rust::serde_int64::option", default)]
    required_level: Option<i64>,
}

async fn check_feature_access(
    ctx: WebRequestContext,
    State(state): State<AppMembershipState>,
    request: Result<Json<FeatureAccessCheckRequest>, JsonRejection>,
) -> axum::response::Response {
    // Surface the concrete deserialization failure instead of letting the
    // gateway normalize the extractor rejection into an opaque 42201 whose
    // detail collapses to the title text. Callers most often send
    // `requiredLevel` as a JSON number (or an empty string) while the
    // int64-as-string contract requires a decimal string.
    let Json(request) = match request {
        Ok(request) => request,
        Err(rejection) => {
            return ApiProblem::bad_request(format!(
                "membership feature access check request body is invalid: {rejection}"
            ))
            .into_response_for(&ctx);
        }
    };
    finish_api_created(
        &ctx,
        async {
            let subject = resolve_required_membership_subject(&state, &ctx)?;
            state
                .store
                .check_feature_access(FeatureAccessCheckQuery {
                    subject,
                    feature_code: normalize_optional_text(request.feature_code),
                    required_rank: request.required_level,
                })
                .await
                .map_err(|e| {
                    ApiProblem::from_service("membership feature access check is unavailable", e)
                })
                .map(item_envelope)
        }
        .await,
    )
}

async fn create_speed_up(
    ctx: WebRequestContext,
    State(state): State<AppMembershipState>,
) -> axum::response::Response {
    finish_api_created(
        &ctx,
        async {
            let subject = resolve_required_membership_subject(&state, &ctx)?;
            state
                .store
                .consume_speed_up(subject, current_timestamp_string())
                .await
                .map_err(|e| {
                    ApiProblem::from_service("membership speed up command is unavailable", e)
                })
                .map(item_envelope)
        }
        .await,
    )
}

async fn submit_purchase(
    ctx: &WebRequestContext,
    state: &AppMembershipState,
    request: SubmitMembershipPurchaseRequest,
    action: &str,
) -> ApiResult<crate::response::ItemEnvelope<AppMembershipPurchaseOutcome>> {
    let subject = resolve_required_membership_subject(state, ctx)?;
    let (package_id, order_id, request_no) = validate_purchase_request(request)?;
    let idempotency_key = ctx.request_id.0.clone();
    let command = build_submit_purchase_command(
        state,
        subject,
        package_id,
        order_id,
        request_no,
        action,
        idempotency_key,
    )?;
    state
        .store
        .submit_purchase(command)
        .await
        .map_err(|e| {
            ApiProblem::from_service("membership purchase command store is unavailable", e)
        })
        .map(item_envelope)
}

fn resolve_membership_subject(
    state: &AppMembershipState,
    ctx: &WebRequestContext,
) -> Result<Option<AppMembershipSubject>, ApiProblem> {
    match app_membership_subject_from_context(ctx) {
        Ok(subject) => Ok(Some(subject)),
        Err(error) if state.require_subject => Err(error),
        Err(_) => Ok(None),
    }
}

/// Resolve the subject for **catalog read** endpoints (plans, benefits,
/// packages, package_groups).  These endpoints serve public catalog data
/// that must be visible to anonymous visitors browsing the token-plan
/// page.  When no session is present, they return `None` instead of a 401
/// so the store can serve public rows.
fn resolve_optional_membership_subject(ctx: &WebRequestContext) -> Option<AppMembershipSubject> {
    app_membership_subject_from_context(ctx).ok()
}

fn resolve_required_membership_subject(
    state: &AppMembershipState,
    ctx: &WebRequestContext,
) -> Result<AppMembershipSubject, ApiProblem> {
    match resolve_membership_subject(state, ctx)? {
        Some(subject) => Ok(subject),
        None => Err(ApiProblem::unauthorized(
            "trusted request subject is required for membership command",
        )),
    }
}

fn app_membership_subject_from_context(
    ctx: &WebRequestContext,
) -> Result<AppMembershipSubject, ApiProblem> {
    let subject = numeric_runtime_subject_from_context(ctx).map_err(ApiProblem::unauthorized)?;
    Ok(AppMembershipSubject {
        tenant_id: subject.tenant_id,
        organization_id: subject.organization_id,
        user_id: subject.user_id,
    })
}

fn validate_purchase_request(
    request: SubmitMembershipPurchaseRequest,
) -> Result<(i64, String, String), ApiProblem> {
    let package_id = request.package_id;
    if package_id <= 0 {
        return Err(ApiProblem::bad_request(
            "membership package id must be greater than zero",
        ));
    }
    let order_id = request.order_id.trim().to_owned();
    if order_id.is_empty() {
        return Err(ApiProblem::bad_request("membership order id is required"));
    }
    let request_no = request.request_no.trim().to_owned();
    if request_no.is_empty() {
        return Err(ApiProblem::bad_request("membership request no is required"));
    }
    if let Some(coupon_id) = request.coupon_id.as_deref() {
        if !coupon_id.trim().is_empty() {
            return Err(ApiProblem::bad_request(
                "membership coupon purchases are not supported",
            ));
        }
    }
    Ok((package_id, order_id, request_no))
}

fn build_submit_purchase_command(
    state: &AppMembershipState,
    subject: AppMembershipSubject,
    package_id: i64,
    order_id: String,
    request_no: String,
    action: &str,
    idempotency_key: String,
) -> Result<SubmitMembershipPurchaseCommand, ApiProblem> {
    let membership_uuid = state
        .entity_id_generator
        .generate_entity_uuid()
        .map_err(|e| ApiProblem::from_service("membership purchase id generation failed", e))?;
    let requested_at = current_timestamp_string();

    Ok(SubmitMembershipPurchaseCommand {
        subject,
        package_id,
        order_uuid: order_id,
        membership_uuid,
        order_no: request_no,
        idempotency_key,
        requested_at,
        action: action.to_owned(),
    })
}

fn current_unix_timestamp() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_queries_deserialize_without_optional_int64_filters() {
        let catalog_uri = "/app/v3/api/memberships/plans"
            .parse()
            .expect("catalog URI");
        let Query(catalog) = Query::<MembershipCatalogQuery>::try_from_uri(&catalog_uri)
            .expect("catalog query without plan_id");
        assert_eq!(catalog.plan_id, None);

        let benefits_uri = "/app/v3/api/memberships/benefits"
            .parse()
            .expect("benefits URI");
        let Query(benefits) = Query::<MembershipBenefitQuery>::try_from_uri(&benefits_uri)
            .expect("benefits query without plan_id");
        assert_eq!(benefits.plan_id, None);

        let packages_uri = "/app/v3/api/memberships/packages"
            .parse()
            .expect("packages URI");
        let Query(packages) = Query::<MembershipPackagesQuery>::try_from_uri(&packages_uri)
            .expect("packages query without optional filters");
        assert_eq!(packages.package_group_id, None);
        assert_eq!(packages.plan_id, None);
    }
}
