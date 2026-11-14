//! Backend route registration guard for the membership management surface.
//!
//! Follows the existing backend route tests: the axum router, the generated
//! route manifest (built from `apis/backend-api/membership`), and the authored
//! OpenAPI contract must all expose the same operation, permission, and
//! membership-owned scope. A route registered without a contract (or a contract
//! without a route) fails here instead of at runtime.

const ADMIN_ROUTER_SOURCE: &str = include_str!("../src/admin_router.rs");
const PATHS_SOURCE: &str = include_str!("../src/paths.rs");
const OPENAPI_SOURCE: &str =
    include_str!("../../../apis/backend-api/membership/membership-backend-api.openapi.json");

use sdkwork_routes_membership_backend_api::backend_route_manifest;

#[test]
fn team_subscriptions_operation_is_registered_in_the_backend_route_manifest() {
    let manifest = backend_route_manifest();
    let route = manifest
        .match_route("GET", "/backend/v3/api/memberships/team_subscriptions")
        .expect("GET team_subscriptions must be registered in the backend route manifest");

    assert_eq!("teamSubscriptions.list", route.operation_id);
    assert_eq!(
        Some("commerce.memberships.read"),
        route.required_permission,
        "the admin read model is a commerce.memberships.read operation",
    );
}

#[test]
fn team_subscriptions_route_is_mounted_on_the_admin_router() {
    assert!(
        ADMIN_ROUTER_SOURCE.contains("/backend/v3/api/memberships/team_subscriptions"),
        "the admin router must mount the team subscriptions route",
    );
    assert!(
        ADMIN_ROUTER_SOURCE.contains("get(list_team_subscriptions)"),
        "the team subscriptions route must be a GET handler",
    );
    assert_eq!(
        "/team_subscriptions",
        sdkwork_routes_membership_backend_api::paths::TEAM_SUBSCRIPTIONS,
    );
    assert!(
        PATHS_SOURCE.contains("pub const TEAM_SUBSCRIPTIONS"),
        "the backend path constants must name the team subscriptions route",
    );
}

#[test]
fn team_subscriptions_handler_projects_membership_owned_facts_only() {
    let handler = ADMIN_ROUTER_SOURCE
        .split("async fn list_team_subscriptions(")
        .nth(1)
        .expect("list_team_subscriptions handler")
        .split("\nasync fn ")
        .next()
        .unwrap_or_default();

    // Tenant scope comes from the backend principal, never from a header.
    assert!(handler.contains("admin_membership_subject_from_context(&ctx)"));
    assert!(!handler.contains("x-sdkwork-organization-id"));
    assert!(!handler.contains("x-organization-id"));

    // No IAM port: organization profiles, roles, and member rows are IAM-owned.
    for forbidden in ["organization_directory", "authorize_organization_action"] {
        assert!(
            !handler.contains(forbidden),
            "the team subscription read model must not call {forbidden}",
        );
    }

    // The list query exposes the standard management window and filters.
    for query_field in [
        "q",
        "status",
        "plan_id",
        "organization_id",
        "page",
        "page_size",
        "cursor",
    ] {
        assert!(
            ADMIN_ROUTER_SOURCE.contains(&format!("{query_field}: Option")),
            "AdminTeamSubscriptionsQuery must expose {query_field}",
        );
    }
    assert!(handler.contains("list_admin_team_subscriptions"));
}

#[test]
fn team_subscriptions_contract_declares_the_standard_envelope_and_permission() {
    let contract: serde_json::Value =
        serde_json::from_str(OPENAPI_SOURCE).expect("backend OpenAPI must be valid JSON");
    let operation = &contract["paths"]["/backend/v3/api/memberships/team_subscriptions"]["get"];

    assert_eq!("teamSubscriptions.list", operation["operationId"]);
    assert_eq!(
        "commerce.memberships.read",
        operation["x-sdkwork-permission"]
    );
    assert_eq!("backend-api", operation["x-sdkwork-api-surface"]);
    assert_eq!(
        "memberships.teamSubscriptions",
        operation["x-sdkwork-resource"]
    );
    assert_eq!(
        "#/components/schemas/AdminTeamSubscriptionListResponse",
        operation["responses"]["200"]["content"]["application/json"]["schema"]["$ref"],
    );

    for parameter in [
        "q",
        "status",
        "plan_id",
        "organization_id",
        "page",
        "page_size",
        "cursor",
    ] {
        assert!(
            operation["parameters"]
                .as_array()
                .expect("parameters")
                .iter()
                .any(|item| item["name"] == parameter),
            "the operation must declare the {parameter} query parameter",
        );
    }
    let page_size = operation["parameters"]
        .as_array()
        .expect("parameters")
        .iter()
        .find(|item| item["name"] == "page_size")
        .expect("page_size parameter");
    assert_eq!(1, page_size["schema"]["minimum"]);
    assert_eq!(200, page_size["schema"]["maximum"]);

    let item = &contract["components"]["schemas"]["AdminTeamSubscriptionItem"]["properties"];
    for field in ["seatsPurchased", "seatsUsed", "seatsAvailable"] {
        assert_eq!("string", item[field]["type"], "{field} must be a string");
        assert_eq!("int64", item[field]["format"], "{field} must be int64");
        assert_eq!(
            true, item[field]["x-sdkwork-int64-string"],
            "{field} must declare x-sdkwork-int64-string",
        );
    }
    for field in ["subscriptionId", "organizationId", "planId", "ownerUserId"] {
        assert_eq!("string", item[field]["type"], "{field} must be a string id");
    }
}
