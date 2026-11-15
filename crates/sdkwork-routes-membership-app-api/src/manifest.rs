use std::sync::LazyLock;

use sdkwork_web_core::HttpRouteManifest;

include!(concat!(env!("OUT_DIR"), "/app_http_routes.rs"));

pub static APP_API_HTTP_ROUTE_MANIFEST: LazyLock<HttpRouteManifest> =
    LazyLock::new(|| HttpRouteManifest::new(APP_API_HTTP_ROUTES));

pub fn app_route_manifest() -> HttpRouteManifest {
    APP_API_HTTP_ROUTE_MANIFEST.clone()
}

#[cfg(test)]
mod tests {
    use super::*;
    use sdkwork_web_core::RouteAuth;

    fn route_auth(method: &str, path: &str) -> RouteAuth {
        let manifest = app_route_manifest();
        manifest
            .match_route(method, path)
            .unwrap_or_else(|| panic!("{method} {path} must be registered"))
            .auth
    }

    #[test]
    fn storefront_catalog_routes_are_optional_credential() {
        for path in [
            "/app/v3/api/memberships/plans",
            "/app/v3/api/memberships/package_groups",
            "/app/v3/api/memberships/package_groups/7",
            "/app/v3/api/memberships/package_groups/7/packages",
            "/app/v3/api/memberships/packages",
            "/app/v3/api/memberships/packages/9",
        ] {
            assert_eq!(
                RouteAuth::DualTokenOrAnonymous,
                route_auth("GET", path),
                "GET {path} must serve anonymous storefront browsing while still resolving a signed-in principal"
            );
        }
    }

    #[test]
    fn user_scoped_membership_routes_stay_dual_token() {
        assert_eq!(
            RouteAuth::DualToken,
            route_auth("GET", "/app/v3/api/memberships/current")
        );
        assert_eq!(
            RouteAuth::DualToken,
            route_auth("GET", "/app/v3/api/memberships/points/balance")
        );
        assert_eq!(
            RouteAuth::DualToken,
            route_auth("POST", "/app/v3/api/memberships/purchases")
        );
    }
}
