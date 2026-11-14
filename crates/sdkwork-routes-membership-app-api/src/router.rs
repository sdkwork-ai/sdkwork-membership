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
use axum::routing::{delete, get, patch, post};
use axum::{Json, Router};
use serde::Deserialize;
use sqlx::PgPool;

use crate::response::{
    finish_api_created, finish_api_json, finish_api_no_content, item_envelope, ApiProblem,
    ApiResult,
};
use crate::subject::numeric_runtime_subject_from_context;
use sdkwork_contract_service::CommerceServiceError;
use sdkwork_membership_repository_sqlx::shared::{
    current_timestamp_string, normalize_optional_text,
};
use sdkwork_membership_repository_sqlx::{
    is_valid_membership_audience, is_valid_membership_category, is_valid_membership_seat_policy,
    AppMembershipEntityIdGenerator, AppMembershipListQuery, AppMembershipPointsHistoryQuery,
    AppMembershipPurchaseOutcome, AppMembershipResult, AppMembershipStore, AppMembershipSubject,
    AppMembershipTeamScope, AssignTeamSeatCommand, FeatureAccessCheckQuery,
    PostgresCommerceMembershipStore, ReconcileTeamSeatsCommand, RevokeTeamSeatCommand,
    SubmitMembershipPurchaseCommand, TeamSeatsQuery, TeamSubscriptionQuery,
    UpdateTeamSeatPolicyCommand,
};
use sdkwork_web_core::WebRequestContext;

/// Default catalog audience for the app catalog reads.
///
/// The personal token-plan page keeps calling the same paths without the
/// `audience` parameter and must keep seeing exactly the personal catalog.
const DEFAULT_CATALOG_AUDIENCE: &str = "personal";

#[derive(Clone)]
struct AppMembershipState {
    store: Arc<dyn AppMembershipStore + Send + Sync>,
    entity_id_generator: Arc<dyn AppMembershipEntityIdGenerator + Send + Sync>,
    require_subject: bool,
}

#[derive(Debug, Deserialize)]
struct MembershipCatalogQuery {
    category: Option<String>,
    /// Catalog audience filter (`personal` | `team`), default `personal`.
    audience: Option<String>,
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
    /// Catalog audience filter (`personal` | `team`), default `personal`.
    audience: Option<String>,
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

/// Catalog audience query used by the single-resource catalog reads.
#[derive(Debug, Deserialize)]
struct MembershipAudienceQuery {
    /// Catalog audience filter (`personal` | `team`), default `personal`.
    audience: Option<String>,
}

/// `GET /team/seats` query parameters.
///
/// The endpoint pages membership-owned seat assignments only. Member search is
/// an IAM roster concern and is never forwarded here.
#[derive(Debug, Deserialize)]
struct TeamSeatsListQuery {
    page: Option<i64>,
    #[serde(rename = "page_size")]
    page_size: Option<i64>,
}

/// `POST /team/seats` body.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TeamSeatAssignmentRequest {
    user_id: String,
}

/// `PATCH /team/seats/policy` body.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TeamSeatPolicyRequest {
    seat_policy: String,
    auto_assign_seat: bool,
}

/// Raw principal scope for the organization (team) endpoints.
///
/// The organization id is taken verbatim from the authenticated principal
/// (`ctx.principal().organization_id()`), never from a header, because it is
/// both the IAM organization id used by the directory projection and the team
/// subscription `subject_id`.
#[derive(Debug, Clone)]
struct TeamRequestScope {
    tenant_id: String,
    organization_id: String,
    user_id: String,
}

impl TeamRequestScope {
    fn into_scope(self) -> AppMembershipTeamScope {
        AppMembershipTeamScope {
            tenant_id: self.tenant_id,
            organization_id: self.organization_id,
            user_id: self.user_id,
        }
    }
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
        audience: None,
    }
}

/// Resolve the catalog `audience` query parameter (default `personal`).
fn resolve_catalog_audience(audience: Option<String>) -> Result<String, ApiProblem> {
    match audience {
        None => Ok(DEFAULT_CATALOG_AUDIENCE.to_owned()),
        Some(raw) if raw.trim().is_empty() => Ok(DEFAULT_CATALOG_AUDIENCE.to_owned()),
        Some(raw) => {
            let normalized = raw.trim().to_ascii_lowercase();
            if is_valid_membership_audience(&normalized) {
                Ok(normalized)
            } else {
                Err(
                    ApiProblem::bad_request("membership audience must be personal or team")
                        .with_reason("invalid_audience"),
                )
            }
        }
    }
}

fn list_query_with_category(
    category: Option<String>,
    audience: String,
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
        audience: Some(audience),
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
        .route(
            "/app/v3/api/memberships/team/subscription",
            get(fetch_team_subscription),
        )
        .route(
            "/app/v3/api/memberships/team/seats",
            get(fetch_team_seats).post(create_team_seat),
        )
        .route(
            "/app/v3/api/memberships/team/seats/reconcile",
            post(reconcile_team_seats),
        )
        .route(
            "/app/v3/api/memberships/team/seats/policy",
            patch(update_team_seat_policy),
        )
        .route(
            "/app/v3/api/memberships/team/seats/{userId}",
            delete(revoke_team_seat),
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
            let audience = resolve_catalog_audience(query.audience)?;
            let list_query = list_query_with_category(
                query.category,
                audience,
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
            let audience = resolve_catalog_audience(query.audience)?;
            let list_query = list_query_with_category(
                query.category,
                audience,
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
    Query(query): Query<MembershipAudienceQuery>,
) -> axum::response::Response {
    finish_api_json(
        &ctx,
        async {
            let catalog_subject = resolve_optional_membership_subject(&ctx);
            let audience = resolve_catalog_audience(query.audience)?;
            let item = state
                .store
                .load_package_group(catalog_subject, package_group_id, audience)
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
            let audience = resolve_catalog_audience(query.audience)?;
            let list_query = list_query_with_category(
                query.category,
                audience,
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
            let audience = resolve_catalog_audience(query.audience)?;
            let list_query = list_query_with_category(
                query.category,
                audience,
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
    Query(query): Query<MembershipAudienceQuery>,
) -> axum::response::Response {
    finish_api_json(
        &ctx,
        async {
            let catalog_subject = resolve_optional_membership_subject(&ctx);
            let audience = resolve_catalog_audience(query.audience)?;
            let item = state
                .store
                .load_package(catalog_subject, package_id, audience)
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
        // The app purchase reservation is a placeholder checkout; the paid
        // order (fulfillment) carries the real seat quantity and organization
        // subject for team plans.
        seats: 1,
        organization_subject_id: None,
    })
}

fn current_unix_timestamp() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}

// ── Organization (team) seat licensing ─────────────────────────────────────

/// Resolve the raw principal scope required by the organization endpoints.
///
/// `organization_id` is taken verbatim from the authenticated principal — the
/// request never carries it as a header — and is used both as the IAM
/// organization id for the directory projection and as the team subscription
/// `subject_id`.
fn resolve_required_team_scope(ctx: &WebRequestContext) -> Result<TeamRequestScope, ApiProblem> {
    let principal = ctx.principal();
    team_scope_from_principal_parts(
        principal.map(|principal| principal.tenant_id()),
        principal.and_then(|principal| principal.organization_id()),
        principal.map(|principal| principal.user_id()),
    )
}

/// Pure core of [`resolve_required_team_scope`]: the organization id comes only
/// from the authenticated principal claims, never from a request header.
fn team_scope_from_principal_parts(
    tenant_id: Option<&str>,
    organization_id: Option<&str>,
    user_id: Option<&str>,
) -> Result<TeamRequestScope, ApiProblem> {
    let (Some(tenant_id), Some(user_id)) = (tenant_id, user_id) else {
        return Err(ApiProblem::unauthorized(
            "trusted request subject is required for membership team operations",
        ));
    };
    let tenant_id = tenant_id.trim().to_owned();
    let user_id = user_id.trim().to_owned();
    if tenant_id.is_empty() || user_id.is_empty() {
        return Err(ApiProblem::unauthorized(
            "trusted request subject is required for membership team operations",
        ));
    }
    let organization_id = organization_id.unwrap_or_default().trim().to_owned();
    if organization_id.is_empty() || organization_id == "0" {
        return Err(ApiProblem::forbidden(
            "organization_scope_required: team operations require an organization-scoped session",
        )
        .with_reason("organization_scope_required"));
    }
    Ok(TeamRequestScope {
        tenant_id,
        organization_id,
        user_id,
    })
}

/// Map team seat domain rejections onto their HTTP semantics.
///
/// `ProblemDetail.code` stays the numeric platform code; the business reason
/// (`seat_management_forbidden`, `seat_capacity_exceeded`, ...) is carried on
/// the problem `reason` field so clients never parse prose.
fn map_team_service_error(error: CommerceServiceError) -> ApiProblem {
    let message = error.message().to_owned();
    let reason = message
        .split(':')
        .next()
        .unwrap_or_default()
        .trim()
        .to_owned();
    match reason.as_str() {
        "seat_management_forbidden" | "organization_scope_required" => {
            ApiProblem::forbidden(message).with_reason(reason)
        }
        "team_subscription_inactive"
        | "seat_capacity_exceeded"
        | "seat_already_assigned"
        | "last_seat_owner_required" => ApiProblem::conflict(message).with_reason(reason),
        "seat_assignment_not_found" => ApiProblem::not_found(message).with_reason(reason),
        "not_organization_member" => ApiProblem::bad_request(message).with_reason(reason),
        _ => ApiProblem::from_service("membership team seat operation is unavailable", error),
    }
}

async fn fetch_team_subscription(
    ctx: WebRequestContext,
    State(state): State<AppMembershipState>,
) -> axum::response::Response {
    finish_api_json(
        &ctx,
        async {
            let scope = resolve_required_team_scope(&ctx)?;
            let data = state
                .store
                .load_team_subscription(TeamSubscriptionQuery {
                    scope: scope.into_scope(),
                })
                .await
                .map_err(map_team_service_error)?;
            Ok(item_envelope(data))
        }
        .await,
    )
}

async fn fetch_team_seats(
    ctx: WebRequestContext,
    State(state): State<AppMembershipState>,
    Query(query): Query<TeamSeatsListQuery>,
) -> axum::response::Response {
    finish_api_json(
        &ctx,
        async {
            let scope = resolve_required_team_scope(&ctx)?;
            let data = state
                .store
                .load_team_seats(TeamSeatsQuery {
                    scope: scope.into_scope(),
                    page: query.page,
                    page_size: query.page_size,
                })
                .await
                .map_err(map_team_service_error)?;
            Ok(data)
        }
        .await,
    )
}

async fn create_team_seat(
    ctx: WebRequestContext,
    State(state): State<AppMembershipState>,
    request: Result<Json<TeamSeatAssignmentRequest>, JsonRejection>,
) -> axum::response::Response {
    let Json(request) = match request {
        Ok(request) => request,
        Err(rejection) => {
            return ApiProblem::bad_request(format!(
                "membership team seat assignment request body is invalid: {rejection}"
            ))
            .with_reason("invalid_request")
            .into_response_for(&ctx);
        }
    };
    finish_api_created(
        &ctx,
        async {
            let scope = resolve_required_team_scope(&ctx)?;
            let target_user_id = request.user_id.trim().to_owned();
            if target_user_id.is_empty() {
                return Err(ApiProblem::bad_request(
                    "not_organization_member: membership team seat target user id is required",
                )
                .with_reason("not_organization_member"));
            }
            state
                .store
                .assign_team_seat(AssignTeamSeatCommand {
                    scope: scope.into_scope(),
                    target_user_id,
                    requested_at: current_timestamp_string(),
                })
                .await
                .map_err(map_team_service_error)
                .map(item_envelope)
        }
        .await,
    )
}

/// Revoke every seat assignment whose user IAM no longer reports as an active
/// organization member, then return the membership-owned seat counters.
///
/// No request body: the organization scope comes from the authenticated
/// principal and the removed members come from the IAM-owned directory port.
/// Idempotent — a second call revokes 0 and returns the current counters.
async fn reconcile_team_seats(
    ctx: WebRequestContext,
    State(state): State<AppMembershipState>,
) -> axum::response::Response {
    finish_api_json(
        &ctx,
        async {
            let scope = resolve_required_team_scope(&ctx)?;
            state
                .store
                .reconcile_team_seats(ReconcileTeamSeatsCommand {
                    scope: scope.into_scope(),
                    requested_at: current_timestamp_string(),
                })
                .await
                .map_err(map_team_service_error)
                .map(item_envelope)
        }
        .await,
    )
}

async fn revoke_team_seat(
    ctx: WebRequestContext,
    State(state): State<AppMembershipState>,
    Path(user_id): Path<String>,
) -> axum::response::Response {
    finish_api_no_content(
        &ctx,
        async {
            let scope = resolve_required_team_scope(&ctx)?;
            state
                .store
                .revoke_team_seat(RevokeTeamSeatCommand {
                    scope: scope.into_scope(),
                    target_user_id: user_id,
                    requested_at: current_timestamp_string(),
                })
                .await
                .map_err(map_team_service_error)
        }
        .await,
    )
}

async fn update_team_seat_policy(
    ctx: WebRequestContext,
    State(state): State<AppMembershipState>,
    request: Result<Json<TeamSeatPolicyRequest>, JsonRejection>,
) -> axum::response::Response {
    let Json(request) = match request {
        Ok(request) => request,
        Err(rejection) => {
            return ApiProblem::bad_request(format!(
                "membership team seat policy request body is invalid: {rejection}"
            ))
            .with_reason("invalid_request")
            .into_response_for(&ctx);
        }
    };
    finish_api_json(
        &ctx,
        async {
            let scope = resolve_required_team_scope(&ctx)?;
            let seat_policy = request.seat_policy.trim().to_ascii_lowercase();
            if !is_valid_membership_seat_policy(&seat_policy) {
                return Err(ApiProblem::bad_request(
                    "membership seat policy must be strict or flex_overflow",
                )
                .with_reason("invalid_seat_policy"));
            }
            state
                .store
                .update_team_seat_policy(UpdateTeamSeatPolicyCommand {
                    scope: scope.into_scope(),
                    seat_policy,
                    auto_assign_seat: request.auto_assign_seat,
                    requested_at: current_timestamp_string(),
                })
                .await
                .map_err(map_team_service_error)
                .map(item_envelope)
        }
        .await,
    )
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
        assert_eq!(catalog.audience, None);

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
        assert_eq!(packages.audience, None);

        // The seat page only carries standard pagination; member search is an
        // IAM roster concern and has no membership query parameter.
        let team_seats_uri = "/app/v3/api/memberships/team/seats?page=2&page_size=50";
        let team_seats_uri = team_seats_uri.parse().expect("team seats URI");
        let Query(team_seats) =
            Query::<TeamSeatsListQuery>::try_from_uri(&team_seats_uri).expect("team seats query");
        assert_eq!(team_seats.page, Some(2));
        assert_eq!(team_seats.page_size, Some(50));
    }

    #[test]
    fn catalog_audience_defaults_to_personal_and_rejects_unknown_values() {
        assert_eq!(
            resolve_catalog_audience(None).expect("default audience"),
            DEFAULT_CATALOG_AUDIENCE
        );
        assert_eq!(
            resolve_catalog_audience(Some("  ".to_owned())).expect("blank audience"),
            DEFAULT_CATALOG_AUDIENCE
        );
        assert_eq!(
            resolve_catalog_audience(Some("TEAM".to_owned())).expect("team audience"),
            "team"
        );
        assert!(resolve_catalog_audience(Some("enterprise".to_owned())).is_err());
    }

    #[test]
    fn team_scope_requires_an_organization_scoped_principal() {
        let tenant_level = team_scope_from_principal_parts(Some("100001"), None, Some("42"));
        assert!(tenant_level.is_err());

        let sentinel_scope = team_scope_from_principal_parts(Some("100001"), Some("0"), Some("42"));
        assert!(sentinel_scope.is_err());

        let organization_scoped =
            team_scope_from_principal_parts(Some("100001"), Some("601"), Some("42"))
                .expect("organization scope");
        assert_eq!(organization_scoped.organization_id, "601");
        assert_eq!(organization_scoped.tenant_id, "100001");
        assert_eq!(organization_scoped.user_id, "42");

        let unauthenticated = team_scope_from_principal_parts(None, Some("601"), None);
        assert!(unauthenticated.is_err());
    }
}
