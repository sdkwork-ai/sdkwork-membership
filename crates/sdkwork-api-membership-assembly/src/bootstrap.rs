use std::sync::Arc;

use axum::Router;
use sdkwork_database_sqlx::DatabasePool;
use sdkwork_membership_service_host::MembershipServiceHost;
pub use sdkwork_web_bootstrap::ApiAssemblyContribution;
use sdkwork_web_bootstrap::{ReadinessCheck, ReadinessFuture, WebModule};
use sdkwork_web_core::HttpRouteManifest;

pub type ApiAssembly = ApiAssemblyContribution;

pub struct BusinessRouterAssembly {
    pub router: Router,
}

#[derive(Clone)]
struct MembershipReadiness {
    pool: DatabasePool,
}

impl ReadinessCheck for MembershipReadiness {
    fn check(&self) -> ReadinessFuture<'_> {
        let pool = self.pool.clone();
        Box::pin(async move {
            match pool.test_connection().await {
                Ok(true) => Ok(()),
                Ok(false) => Err("membership database readiness query returned no row".to_owned()),
                Err(error) => Err(format!(
                    "membership database readiness check failed: {error}"
                )),
            }
        })
    }
}

pub async fn assemble_api_router(host: Arc<MembershipServiceHost>) -> Result<ApiAssembly, String> {
    // 会员订阅生命周期 worker（advisory lock 防多实例；Once 防重复 spawn）
    host.spawn_membership_lifecycle_worker();
    let router = Router::new()
        .merge(sdkwork_routes_membership_app_api::gateway_mount(host.clone()).await)
        .merge(sdkwork_routes_membership_backend_api::gateway_mount(host.clone()).await);
    let routes = sdkwork_routes_membership_app_api::gateway_route_manifest()
        .routes()
        .iter()
        .chain(
            sdkwork_routes_membership_backend_api::gateway_route_manifest()
                .routes()
                .iter(),
        )
        .cloned()
        .collect();
    ApiAssemblyContribution::from_manifest(
        "sdkwork-membership",
        "SDKWork Membership API",
        router,
        HttpRouteManifest::from_owned_routes(routes),
        Vec::new(),
        Arc::new(MembershipReadiness {
            pool: host.database_pool().clone(),
        }),
    )
}

pub async fn assemble_api_router_from_env() -> Result<ApiAssembly, String> {
    let host = Arc::new(MembershipServiceHost::from_env().await?);
    assemble_api_router(host).await
}

pub async fn assemble_api_router_with_pool(pool: DatabasePool) -> Result<ApiAssembly, String> {
    let host = Arc::new(MembershipServiceHost::from_pool(&pool).await?);
    assemble_api_router(host).await
}

pub async fn assemble_backend_business_router(
    host: Arc<MembershipServiceHost>,
) -> BusinessRouterAssembly {
    BusinessRouterAssembly {
        router: sdkwork_routes_membership_backend_api::gateway_mount(host).await,
    }
}

pub async fn assemble_backend_business_router_from_env() -> Result<BusinessRouterAssembly, String> {
    let host = Arc::new(MembershipServiceHost::from_env().await?);
    Ok(assemble_backend_business_router(host).await)
}

/// Compose the membership backend business router on a shared pool owned by
/// the consuming host (same-origin dependency composition). Mirrors
/// `assemble_app_api_contribution_with_pool`; the consuming assembly selects
/// this entrypoint instead of importing `sdkwork-routes-*` directly.
pub async fn assemble_backend_business_router_with_pool(
    pool: &DatabasePool,
) -> Result<BusinessRouterAssembly, String> {
    let host = Arc::new(MembershipServiceHost::from_pool(pool).await?);
    Ok(assemble_backend_business_router(host).await)
}

pub async fn assemble_app_api_contribution() -> Result<ApiAssemblyContribution, String> {
    let host = Arc::new(MembershipServiceHost::from_env().await?);
    assemble_app_api_contribution_with_host(host)
}

pub async fn assemble_app_api_contribution_with_pool(
    pool: &DatabasePool,
) -> Result<ApiAssemblyContribution, String> {
    let host = Arc::new(MembershipServiceHost::from_pool(pool).await?);
    assemble_app_api_contribution_with_host(host)
}

fn assemble_app_api_contribution_with_host(
    host: Arc<MembershipServiceHost>,
) -> Result<ApiAssemblyContribution, String> {
    // 会员订阅生命周期 worker（advisory lock 防多实例；Once 防重复 spawn）
    host.spawn_membership_lifecycle_worker();
    ApiAssemblyContribution::from_manifest(
        "sdkwork-membership",
        "SDKWork Membership App API",
        sdkwork_routes_membership_app_api::build_membership_app_router(host.clone()),
        sdkwork_routes_membership_app_api::gateway_route_manifest(),
        Vec::new(),
        Arc::new(MembershipReadiness {
            pool: host.database_pool().clone(),
        }),
    )
}

/// Same as [`web_module`] but composed on a process-shared database pool
/// (platform gateways, API_ASSEMBLY_SPEC §4.1.1).
pub async fn web_module_with_pool(pool: DatabasePool) -> Result<WebModule, String> {
    Ok(WebModule::from_contribution(
        assemble_api_router_with_pool(pool).await?,
    ))
}

/// Canonical Web Module definition for this application
/// (API_ASSEMBLY_SPEC §4.1.1): the complete HTTP surface — every route,
/// manifest, and OpenAPI document of this owner — as one installable module.
pub async fn web_module() -> Result<WebModule, String> {
    Ok(WebModule::from_contribution(
        assemble_api_router_from_env().await?,
    ))
}
