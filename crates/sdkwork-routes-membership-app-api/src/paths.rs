//! App API path constants for the membership capability.
//!
//! All app-api routes are mounted under `/app/v3/api/memberships`.

/// Base prefix for app-api membership routes.
pub const APP_API_PREFIX: &str = "/app/v3/api/memberships";

/// Current membership info: `GET /app/v3/api/memberships/current`
pub const CURRENT: &str = "/current";

/// Membership status: `GET /app/v3/api/memberships/current/status`
pub const CURRENT_STATUS: &str = "/current/status";

/// Benefit list: `GET /app/v3/api/memberships/benefits`
pub const BENEFITS: &str = "/benefits";

/// Package group list: `GET /app/v3/api/memberships/package_groups`
pub const PACKAGE_GROUPS: &str = "/package_groups";

/// Package group detail: `GET /app/v3/api/memberships/package_groups/:id`
pub const PACKAGE_GROUP_DETAIL: &str = "/package_groups/:id";

/// Package list: `GET /app/v3/api/memberships/packages`
pub const PACKAGES: &str = "/packages";

/// Plan list: `GET /app/v3/api/memberships/plans`
pub const PLANS: &str = "/plans";

/// Points balance: `GET /app/v3/api/memberships/points/balance`
pub const POINTS_BALANCE: &str = "/points/balance";

/// Points history: `GET /app/v3/api/memberships/points/history`
pub const POINTS_HISTORY: &str = "/points/history";

/// Daily reward status: `GET /app/v3/api/memberships/points/daily_rewards/status`
pub const DAILY_REWARD_STATUS: &str = "/points/daily_rewards/status";

/// Claim daily reward: `POST /app/v3/api/memberships/points/daily_rewards`
pub const DAILY_REWARD_CLAIM: &str = "/points/daily_rewards";

/// Privilege usage: `GET /app/v3/api/memberships/privileges/usage`
pub const PRIVILEGE_USAGE: &str = "/privileges/usage";

/// Submit purchase: `POST /app/v3/api/memberships/purchases`
pub const PURCHASES: &str = "/purchases";

/// Team subscription overview: `GET /app/v3/api/memberships/team/subscription`
pub const TEAM_SUBSCRIPTION: &str = "/team/subscription";

/// Team seat directory: `GET /app/v3/api/memberships/team/seats`
pub const TEAM_SEATS: &str = "/team/seats";

/// Team seat assignment: `DELETE /app/v3/api/memberships/team/seats/:userId`
pub const TEAM_SEAT_DETAIL: &str = "/team/seats/:userId";

/// Team seat policy: `PATCH /app/v3/api/memberships/team/seats/policy`
pub const TEAM_SEAT_POLICY: &str = "/team/seats/policy";
