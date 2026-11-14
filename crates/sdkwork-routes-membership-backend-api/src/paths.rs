//! Backend API path constants for the membership capability.
//!
//! All backend-api routes are mounted under `/backend/v3/api/memberships`.

/// Base prefix for backend-api membership routes.
pub const BACKEND_API_PREFIX: &str = "/backend/v3/api/memberships";

/// Plans management: `/backend/v3/api/memberships/plans`
pub const PLANS: &str = "/plans";

/// Package groups management: `/backend/v3/api/memberships/package_groups`
pub const PACKAGE_GROUPS: &str = "/package_groups";

/// Packages management: `/backend/v3/api/memberships/packages`
pub const PACKAGES: &str = "/packages";

/// Members listing: `/backend/v3/api/memberships/members`
pub const MEMBERS: &str = "/members";

/// Member detail: `/backend/v3/api/memberships/members/{id}`
pub const MEMBER_DETAIL: &str = "/members/{id}";

/// Entitlements listing: `/backend/v3/api/memberships/entitlements`
pub const ENTITLEMENTS: &str = "/entitlements";

/// Organization (team) subscription admin/ops read model:
/// `/backend/v3/api/memberships/team_subscriptions`
pub const TEAM_SUBSCRIPTIONS: &str = "/team_subscriptions";
