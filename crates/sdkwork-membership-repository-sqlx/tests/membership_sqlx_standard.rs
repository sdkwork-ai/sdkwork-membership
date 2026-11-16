//! Source-level regression guards for the PostgreSQL membership repository.
//!
//! Live PostgreSQL integration belongs to the database lifecycle/repository gate. These fast
//! checks keep naming, ownership, transaction, and HTTP contract invariants visible in every
//! workspace test run without treating SQLite as authoritative-server evidence.

const POSTGRES_SOURCE: &str = include_str!("../src/postgres.rs");
const LIB_SOURCE: &str = include_str!("../src/lib.rs");
const TYPES_SOURCE: &str = include_str!("../src/types.rs");
const APP_ROUTER_SOURCE: &str =
    include_str!("../../sdkwork-routes-membership-app-api/src/router.rs");
const BACKEND_ROUTER_SOURCE: &str =
    include_str!("../../sdkwork-routes-membership-backend-api/src/admin_router.rs");
const POSTGRES_BASELINE: &str =
    include_str!("../../../database/ddl/baseline/postgres/0001_membership_baseline.sql");
const PACKAGE_DISCOUNT_MIGRATION_UP: &str =
    include_str!("../../../database/migrations/postgres/0002_membership_package_discount.up.sql");
const PACKAGE_DISCOUNT_MIGRATION_DOWN: &str =
    include_str!("../../../database/migrations/postgres/0002_membership_package_discount.down.sql");
const TEAM_SEATS_MIGRATION_UP: &str =
    include_str!("../../../database/migrations/postgres/0004_membership_team_seats.up.sql");
const TEAM_SEATS_MIGRATION_DOWN: &str =
    include_str!("../../../database/migrations/postgres/0004_membership_team_seats.down.sql");
const TEAM_SEED: &str = include_str!("../../../database/seeds/common/002_team_catalog.sql");
const APP_OPENAPI_SOURCE: &str =
    include_str!("../../../apis/app-api/membership/membership-app-api.openapi.json");
const TEAM_SEAT_ASSIGNMENT_SDK_TYPE: &str = include_str!(
    "../../../sdks/sdkwork-membership-app-sdk/sdkwork-membership-app-sdk-typescript/generated/server-openapi/src/types/team-seat-assignment.ts"
);
const TEAM_SEAT_RECONCILIATION_SDK_TYPE: &str = include_str!(
    "../../../sdks/sdkwork-membership-app-sdk/sdkwork-membership-app-sdk-typescript/generated/server-openapi/src/types/team-seat-reconciliation.ts"
);

#[test]
fn repository_exposes_only_the_authoritative_postgres_store() {
    assert!(POSTGRES_SOURCE.contains("pub struct PostgresCommerceMembershipStore"));
    assert!(LIB_SOURCE.contains("pub use postgres::PostgresCommerceMembershipStore"));
    assert!(!LIB_SOURCE.to_ascii_lowercase().contains("sqlite"));

    for banned in [
        "AppVip",
        "AdminVip",
        "SubmitVip",
        "SqliteCommerceMembershipStore",
        "PostgresAppVipStore",
        "vip_membership",
        "seed-product-vip-membership",
    ] {
        for (name, source) in [
            ("lib.rs", LIB_SOURCE),
            ("types.rs", TYPES_SOURCE),
            ("postgres.rs", POSTGRES_SOURCE),
            ("app router", APP_ROUTER_SOURCE),
            ("backend router", BACKEND_ROUTER_SOURCE),
        ] {
            assert!(
                !source.contains(banned),
                "{name} must not contain retired membership fragment {banned}",
            );
        }
    }
}

#[test]
fn routers_keep_canonical_paths_and_http_semantics() {
    for source in [APP_ROUTER_SOURCE, BACKEND_ROUTER_SOURCE] {
        assert!(!source.contains("/vip"));
        assert!(!source.contains("/billing"));
        assert!(!source.contains("alias = \"pageSize\""));
        assert!(!source.contains("alias = \"userId\""));
        assert!(!source.contains("alias = \"membershipId\""));
    }

    assert!(APP_ROUTER_SOURCE.contains("/app/v3/api/memberships/package_groups/{packageGroupId}"));
    assert!(APP_ROUTER_SOURCE.contains("/app/v3/api/memberships/packages/{packageId}"));
    assert!(BACKEND_ROUTER_SOURCE.contains("/backend/v3/api/memberships/plans/{planId}"));
    assert!(
        BACKEND_ROUTER_SOURCE.contains("/backend/v3/api/memberships/members/{membershipId}/status")
    );
    assert!(APP_ROUTER_SOURCE.matches("finish_api_created(").count() >= 3);
    assert!(BACKEND_ROUTER_SOURCE.matches("finish_api_created(").count() >= 3);
    assert!(
        BACKEND_ROUTER_SOURCE
            .matches("finish_api_no_content(")
            .count()
            >= 3
    );
}

#[test]
fn fulfillment_stays_order_led_and_transactionally_idempotent() {
    for forbidden in [
        "INSERT INTO commerce_order",
        "INSERT INTO commerce_payment_intent",
        "method_alias",
        "wechatpay",
    ] {
        assert!(!POSTGRES_SOURCE.contains(forbidden));
    }
    assert!(POSTGRES_SOURCE.contains("FROM membership_subscription ms"));
    assert!(POSTGRES_SOURCE.contains("async fn fulfill_purchase_by_order"));
    assert!(POSTGRES_SOURCE.contains("SELECT pg_advisory_xact_lock($1)"));
    assert!(POSTGRES_SOURCE.contains("AND mp.source_order_id = $4"));
    assert!(!BACKEND_ROUTER_SOURCE.contains("purchases/fulfillments"));
    assert!(!BACKEND_ROUTER_SOURCE.contains("MEMBERSHIP_FULFILL_ALLOW_INSECURE"));
}

#[test]
fn postgres_baseline_covers_membership_tables_only() {
    for table in [
        "membership_plan",
        "membership_plan_version",
        "membership_benefit_definition",
        "membership_plan_benefit",
        "membership_package_group",
        "membership_package",
        "membership_subscription",
        "membership_period",
        "membership_points_account",
        "membership_points_ledger",
        "membership_entitlement_account",
        "membership_entitlement_grant",
        "membership_entitlement_ledger_entry",
        "membership_privilege_usage",
        "membership_daily_reward",
    ] {
        assert!(
            POSTGRES_BASELINE.contains(&format!("CREATE TABLE IF NOT EXISTS {table}")),
            "PostgreSQL baseline must create {table}",
        );
    }

    for table in [
        "commerce_order",
        "commerce_order_item",
        "commerce_order_amount_breakdown",
        "commerce_payment_method",
        "commerce_payment_intent",
        "commerce_payment_attempt",
    ] {
        assert!(
            !POSTGRES_BASELINE.contains(&format!("CREATE TABLE IF NOT EXISTS {table}")),
            "Membership baseline must not create external table {table}",
        );
    }
}

#[test]
fn membership_package_discount_column_is_persisted_and_validated() {
    assert!(
        POSTGRES_BASELINE.contains("discount              BIGINT NOT NULL DEFAULT 100"),
        "membership baseline must declare the package discount column with a 100 default"
    );
    assert!(
        POSTGRES_BASELINE.contains("ck_membership_package_discount_range"),
        "membership baseline must constrain the package discount to 1-100"
    );
    assert!(
        POSTGRES_BASELINE.contains("ADD COLUMN discount BIGINT NOT NULL DEFAULT 100"),
        "membership baseline must backfill the discount column for existing installs"
    );
    assert!(
        POSTGRES_SOURCE.contains("COALESCE(discount, 100)::bigint AS discount"),
        "admin package reads must fall back to no discount (100) for legacy rows"
    );
    assert!(
        PACKAGE_DISCOUNT_MIGRATION_UP.contains("ADD COLUMN IF NOT EXISTS discount"),
        "the 0002 up migration must add the discount column idempotently"
    );
    assert!(
        PACKAGE_DISCOUNT_MIGRATION_DOWN.contains("DROP COLUMN IF EXISTS discount"),
        "the 0002 down migration must remove the discount column"
    );
    assert!(
        PACKAGE_DISCOUNT_MIGRATION_DOWN
            .contains("DROP CONSTRAINT IF EXISTS ck_membership_package_discount_range"),
        "the 0002 down migration must drop the discount range constraint"
    );
}

#[test]
fn seeds_cover_membership_flows_without_order_or_payment_rows() {
    let seeds = format!(
        "{}\n{}",
        include_str!("../../../database/seeds/common/001_catalog.sql"),
        include_str!("../../../database/fixtures/002_dev_demo.sql"),
    );
    for table in [
        "membership_subscription",
        "membership_period",
        "membership_points_account",
        "membership_points_ledger",
        "membership_entitlement_account",
        "membership_entitlement_grant",
        "membership_entitlement_ledger_entry",
        "membership_privilege_usage",
    ] {
        assert!(seeds.contains(&format!("INSERT INTO {table}")));
    }
    for table in [
        "commerce_order",
        "commerce_order_item",
        "commerce_payment_method",
        "commerce_payment_intent",
    ] {
        assert!(!seeds.contains(&format!("INSERT INTO {table}")));
    }
}

#[test]
fn point_queries_use_tenant_scoped_account_tables() {
    let source = POSTGRES_SOURCE.replace("\r\n", "\n");
    assert!(source.contains("FROM membership_points_account\n"));
    assert!(source.contains("FROM membership_points_ledger\n"));
    assert!(source.contains("owner_type = 'USER'"));
    assert!(source.contains("tenant_id = CAST($1 AS BIGINT)"));
    assert!(source.contains("organization_id = CAST($2 AS BIGINT)"));
    assert!(source.contains("owner_id = CAST($3 AS BIGINT)"));
    assert!(!source.contains("membership_points_ledger_entry"));
}

#[test]
fn plan_rank_and_storage_id_queries_keep_distinct_bindings() {
    let source = POSTGRES_SOURCE.replace("\r\n", "\n");
    assert!(source.contains("AND CAST(p.rank AS INTEGER) = $3"));
    assert!(source.contains("WHERE p.id = $1"));
    assert!(source.contains(
        "let rows = sqlx::query(LOAD_MEMBERSHIP_PLAN_BY_RANK)\n        .bind(DEFAULT_CATALOG_TENANT_ID)\n        .bind(DEFAULT_CATALOG_ORGANIZATION_ID)\n        .bind(rank)",
    ));
    assert!(source.contains(
        "let rows = sqlx::query(LOAD_MEMBERSHIP_PLAN_BY_STORAGE_ID)\n        .bind(&package.plan_storage_id)",
    ));
}

#[test]
fn team_seat_licensing_is_persisted_and_transactionally_guarded() {
    // Seat ledger table: created by the baseline and the 0004 migration,
    // removable by the down migration.
    assert!(POSTGRES_BASELINE.contains("CREATE TABLE IF NOT EXISTS membership_seat_assignment"));
    assert!(
        TEAM_SEATS_MIGRATION_UP.contains("CREATE TABLE IF NOT EXISTS membership_seat_assignment")
    );
    assert!(TEAM_SEATS_MIGRATION_DOWN.contains("DROP TABLE IF EXISTS membership_seat_assignment"));
    assert!(POSTGRES_SOURCE.contains("INSERT INTO membership_seat_assignment"));
    assert!(POSTGRES_SOURCE.contains("UPDATE membership_seat_assignment"));

    // Team fulfillment binds the subscription to the IAM organization subject.
    assert!(POSTGRES_SOURCE.contains("'organization', CAST($5 AS TEXT)"));
    assert!(POSTGRES_SOURCE.contains("NULL, 0, $19, 0, 'strict', 1"));
    assert!(POSTGRES_SOURCE.contains("AND ms.subject_type = 'organization'"));
    assert!(POSTGRES_SOURCE.contains("AND ms.subject_id = CAST($2 AS TEXT)"));
    assert!(POSTGRES_SOURCE.contains("seat_purchase"));

    // Seat-capacity guard: strict refuses beyond seats_purchased, flex allows.
    assert!(POSTGRES_SOURCE
        .contains("if row.seat_policy == \"strict\" && row.seats_used >= row.seats_purchased"));
    assert!(POSTGRES_SOURCE.contains("seat_capacity_exceeded"));
    assert!(
        POSTGRES_SOURCE.contains("seats_used exceeds seats_purchased while switching to strict")
    );
    assert!(POSTGRES_SOURCE.contains("GREATEST(seats_used - 1, 0)"));

    // Concurrency: one advisory xact lock per subscription id.
    assert!(POSTGRES_SOURCE.contains("pg_advisory_xact_lock"));
    assert!(POSTGRES_SOURCE.contains("membership-team-seat:"));

    // Audit actions written by the seat lifecycle.
    for action in ["seat_assign", "seat_revoke", "seat_policy", "seat_purchase"] {
        assert!(
            POSTGRES_SOURCE.contains(&format!("\"{action}\"")),
            "postgres store must write the {action} change log action",
        );
    }

    // Team entitlement grants multiply the plan quantity by the seat count;
    // subscription points are the package's per-seat amount × seats instead.
    assert!(POSTGRES_SOURCE.contains("benefit.usage_limit.unwrap_or(0).max(0) * seats"));
    assert!(POSTGRES_SOURCE.contains("package.item.seat_points_amount.max(0) * seats"));
    assert!(POSTGRES_SOURCE.contains("SUBSCRIPTION_POINTS_BENEFIT_ID"));
    assert!(POSTGRES_SOURCE
        .contains("benefit_code.eq_ignore_ascii_case(SUBSCRIPTION_POINTS_BENEFIT_CODE)"));

    // Catalog audience filters on plan, package group, and package rows.
    assert!(POSTGRES_SOURCE.contains("AND ($4 IS NULL OR p.audience = $4)"));
    assert!(POSTGRES_SOURCE.contains("AND ($6 IS NULL OR g.audience = $6)"));
    assert!(POSTGRES_SOURCE.contains("AND p.audience = $"));
    assert!(POSTGRES_SOURCE.contains("AND g.audience = $4"));

    // IAM stays the owner: the store consumes the IAM-owned in-process port and
    // contains no IAM table SQL at all (DOMAIN_SPEC §5, MODULE_SPEC §4.2.1).
    assert!(POSTGRES_SOURCE.contains("organization_directory"));
    assert!(POSTGRES_SOURCE.contains("IamOrganizationDirectory"));
    assert!(POSTGRES_SOURCE.contains("load_active_member("));
    assert!(LIB_SOURCE.contains("IamOrganizationDirectory"));
    // The overview and the seat page return membership-owned facts only: no
    // roster read, count, or organization projection happens in the store.
    // `filter_active_member_ids(` is the one intended exception: the
    // member-removal reconciliation asks IAM which already-assigned users are
    // still active members. It never enumerates the roster.
    for removed in [
        "list_active_members(",
        "count_active_members(",
        "count_active_members_matching(",
        "load_organization(",
        "IamOrganizationMemberRecord",
        "IamOrganizationMemberQuery",
    ] {
        assert!(
            !POSTGRES_SOURCE.contains(removed),
            "postgres store must not read the IAM roster/count projection: {removed}",
        );
    }
    assert!(
        POSTGRES_SOURCE.contains("filter_active_member_ids("),
        "member-removal reconciliation must ask the IAM port which assigned users are still members",
    );
    for forbidden in [
        "iam_organization",
        "iam_user",
        "INSERT INTO iam_",
        "UPDATE iam_",
        "DELETE FROM iam_",
        "membership_organization_directory",
    ] {
        for (name, source) in [("postgres.rs", POSTGRES_SOURCE), ("lib.rs", LIB_SOURCE)] {
            assert!(
                !source.contains(forbidden),
                "{name} must not read or write IAM tables: {forbidden}",
            );
        }
    }

    // Team catalog seed carries audience + per-seat pricing.
    assert!(TEAM_SEED.contains("plan-team-starter"));
    assert!(TEAM_SEED.contains("'seat'"));
    assert!(TEAM_SEED.contains("seat_points_amount"));
}

/// Parses every `audience = 'team'` package tuple from the seed:
/// `(package id, price, seat points)`.
fn team_seed_package_rows() -> Vec<(String, i64, i64)> {
    // Scope the scan to the `membership_package` INSERT: package-group rows also
    // carry `package-` ids but never sell points.
    let block = TEAM_SEED
        .split("INSERT INTO membership_package (")
        .nth(1)
        .expect("team seed must insert membership packages")
        .split("ON CONFLICT (id) DO UPDATE SET")
        .next()
        .unwrap_or_default();
    let mut rows = Vec::new();
    for chunk in block.split("('package-").skip(1) {
        if !chunk.contains("', 'team', ") {
            continue;
        }
        let id = chunk.split('\'').next().unwrap_or_default();
        let tuple = chunk.split(')').next().unwrap_or_default();
        let (before_currency, after_currency) = tuple
            .split_once(", 'CNY', 'seat', ")
            .expect("team package seed row must price per seat in CNY");
        let price = before_currency
            .rsplit(", '")
            .nth(1)
            .expect("team package seed row must carry price_amount")
            .trim_end_matches('\'')
            .trim()
            .parse::<i64>()
            .expect("team package price_amount must be a whole CNY amount");
        let mut numbers = after_currency.split(',').map(str::trim);
        let _seat_min = numbers.next();
        let _seat_max = numbers.next();
        let seat_points = numbers
            .next()
            .expect("team package seed row must carry seat_points_amount")
            .parse::<i64>()
            .expect("team package seat_points_amount must be an integer");
        rows.push((format!("package-{id}"), price, seat_points));
    }
    rows
}

#[test]
fn team_packages_grant_ten_points_per_cny_of_price() {
    // Product ratio: ¥1 = 10 membership points. Every team package must credit
    // `price_amount × 10` points per seat for its own billing period, otherwise
    // the seed over-credits 5–7.5× and every team purchase loses money.
    let rows = team_seed_package_rows();
    assert_eq!(
        rows.len(),
        12,
        "the team catalog sells 4 billing cycles × 3 plans",
    );
    for (package_id, price, seat_points) in &rows {
        assert_eq!(
            *seat_points,
            *price * 10,
            "{package_id}: seat_points_amount must be ten points per CNY of price_amount",
        );
    }
    // Spot-check the per-period ladder so a wrong-but-consistent ratio (for
    // example ×1) cannot satisfy the generic guard above.
    for (package_id, expected) in [
        ("package-team-starter-monthly", 990),
        ("package-team-starter-annual", 9990),
        ("package-team-starter-quarterly", 2910),
        ("package-team-starter-single", 1090),
        ("package-team-growth-monthly", 1990),
        ("package-team-growth-annual", 19990),
        ("package-team-growth-quarterly", 5850),
        ("package-team-growth-single", 2190),
        ("package-team-scale-monthly", 3990),
        ("package-team-scale-annual", 39990),
        ("package-team-scale-quarterly", 11730),
        ("package-team-scale-single", 4390),
    ] {
        let row = rows
            .iter()
            .find(|(id, _, _)| id.as_str() == package_id)
            .unwrap_or_else(|| panic!("missing team package {package_id}"));
        assert_eq!(row.2, expected, "{package_id} seat_points_amount");
    }
}

#[test]
fn team_seat_authorization_is_an_iam_owned_capability_decision() {
    // The capability id is IAM-owned and published; membership must reference it
    // instead of encoding the role policy (DOMAIN_SPEC §5, MODULE_SPEC §4.2.1).
    assert_eq!(
        "membership.team.seat.manage",
        sdkwork_iam_directory_repository_sqlx::organization_capability::TEAM_SEAT_MANAGE,
        "membership must consume the IAM-published seat-management capability id",
    );
    assert!(
        POSTGRES_SOURCE.contains("authorize_organization_action("),
        "seat assign/revoke/policy must reach the IAM authorization decision",
    );
    assert!(
        POSTGRES_SOURCE.contains("organization_capability::TEAM_SEAT_MANAGE"),
        "the port call must name the IAM capability constant, not a literal role",
    );

    // One helper plus exactly five decisions: assign, revoke, policy update,
    // member-removal reconciliation, and binding an unbound subscription to an
    // organization (which grants the organization's seat pool to the buyer).
    assert_eq!(
        6,
        POSTGRES_SOURCE
            .matches("authorize_team_seat_management(")
            .count(),
        "assign, revoke, seat-policy update, bind, and reconcile are the only seat-management decisions",
    );
    for call in [
        "async fn assign_team_seat(",
        "async fn revoke_team_seat(",
        "async fn update_team_seat_policy(",
        "async fn bind_team_subscription(",
        "async fn reconcile_team_seats(",
    ] {
        let body = POSTGRES_SOURCE
            .split(call)
            .nth(1)
            .unwrap_or_else(|| panic!("missing {call}"))
            .split("\nasync fn ")
            .next()
            .unwrap_or_default();
        assert!(
            body.contains("authorize_team_seat_management("),
            "{call} must authorize through the IAM capability decision",
        );
        assert!(
            !body.contains("authorize_organization_action("),
            "{call} must not duplicate the port plumbing",
        );
    }

    // An IAM denial keeps the existing 403 reason; a port failure stays storage.
    assert!(
        POSTGRES_SOURCE.contains("CommerceServiceError::unauthorized(")
            && POSTGRES_SOURCE.contains("\"seat_management_forbidden:"),
        "an IAM denial must keep the seat_management_forbidden reason",
    );
    let authorize_block = POSTGRES_SOURCE
        .split("async fn authorize_team_seat_management(")
        .nth(1)
        .unwrap_or_default()
        .split("\nasync fn ")
        .next()
        .unwrap_or_default();
    assert!(
        authorize_block.contains(".map_err(|error| {")
            && authorize_block.contains("directory_error("),
        "an IAM port failure must map through the existing directory_error helper",
    );
    assert!(
        authorize_block.contains("organization_capability::TEAM_SEAT_MANAGE"),
        "the helper must pass the IAM capability to the port",
    );

    // No role policy is left in membership: no role vocabulary, no role loader,
    // no inline `owner | admin` matrix. `membership_kind` is an IAM column and
    // must not be named by this module any more.
    for (name, source) in [
        ("postgres.rs", POSTGRES_SOURCE),
        ("types.rs", TYPES_SOURCE),
        ("lib.rs", LIB_SOURCE),
    ] {
        for banned in [
            "membership_kind",
            "load_viewer_role",
            "viewer_role",
            "require_team_seat_management",
            "membership_role_can_manage_seats",
            "MEMBERSHIP_TEAM_ROLES",
            "\"owner\" | \"admin\"",
            "owner or admin role",
        ] {
            assert!(
                !source.contains(banned),
                "{name} must not re-encode IAM role policy: {banned}",
            );
        }
    }
}

#[test]
fn app_router_exposes_team_seat_operations() {
    assert!(APP_ROUTER_SOURCE.contains("/app/v3/api/memberships/team/subscription"));
    assert!(APP_ROUTER_SOURCE.contains("/app/v3/api/memberships/team/seats"));
    assert!(APP_ROUTER_SOURCE.contains("/app/v3/api/memberships/team/seats/policy"));
    assert!(APP_ROUTER_SOURCE.contains("/app/v3/api/memberships/team/seats/reconcile"));
    assert!(APP_ROUTER_SOURCE.contains("/app/v3/api/memberships/team/seats/{userId}"));
    assert!(APP_ROUTER_SOURCE.contains("finish_api_no_content("));
    assert!(APP_ROUTER_SOURCE.contains("seat_management_forbidden"));
    assert!(APP_ROUTER_SOURCE.contains("last_seat_owner_required"));
    assert!(APP_ROUTER_SOURCE.contains("not_organization_member"));
    assert!(APP_ROUTER_SOURCE.contains("seat_already_assigned"));
    assert!(APP_ROUTER_SOURCE.contains("team_subscription_inactive"));
    // The member-removal sweep is a bodyless command that answers with the
    // membership-owned counters only.
    assert!(APP_ROUTER_SOURCE.contains("ReconcileTeamSeatsCommand"));
    assert!(APP_ROUTER_SOURCE.contains(".reconcile_team_seats("));
    assert!(APP_ROUTER_SOURCE.contains("post(reconcile_team_seats)"));
    // The organization id comes from the principal, never from a header.
    assert!(!APP_ROUTER_SOURCE.contains("x-sdkwork-organization-id"));
    assert!(!APP_ROUTER_SOURCE.contains("x-organization-id"));
    assert!(APP_ROUTER_SOURCE.contains("principal.organization_id()"));
    // Catalog reads filter by audience with a `personal` default.
    assert!(APP_ROUTER_SOURCE.contains("DEFAULT_CATALOG_AUDIENCE: &str = \"personal\""));
}

#[test]
fn package_read_models_expose_seat_pricing_metadata() {
    for column in [
        "p.audience AS package_audience",
        "p.price_unit AS package_price_unit",
        "CAST(COALESCE(p.seat_min, 1) AS INTEGER) AS seat_min",
        "CAST(COALESCE(p.seat_max, 500) AS INTEGER) AS seat_max",
        "CAST(COALESCE(p.seat_points_amount, 0) AS INTEGER) AS seat_points_amount",
        "p.recurrence_cycle AS recurrence_cycle",
        "g.audience AS audience",
        "g.billing_cycle AS billing_cycle",
        "CAST(COALESCE(g.duration_days, 0) AS INTEGER) AS duration_days",
    ] {
        assert!(
            POSTGRES_SOURCE.contains(column),
            "package reads must select {column}",
        );
    }

    for field in [
        "pub audience: String",
        "pub price_unit: String",
        "pub seat_min: i64",
        "pub seat_max: i64",
        "pub seat_points_amount: i64",
        "pub plan_id: String",
        "pub plan_rank: i64",
        "pub recurrence_cycle: Option<String>",
        "pub billing_cycle: Option<String>",
        "pub duration_days: i64",
    ] {
        assert!(
            TYPES_SOURCE.contains(field),
            "package DTOs must declare {field}",
        );
    }

    // The new int64 catalog fields must stay int64 strings on the wire.
    for field in [
        "pub seat_min: i64",
        "pub seat_max: i64",
        "pub seat_points_amount: i64",
        "pub plan_rank: i64",
    ] {
        let offset = TYPES_SOURCE
            .find(field)
            .unwrap_or_else(|| panic!("missing {field}"));
        let before = &TYPES_SOURCE[..offset];
        let attribute_line = before
            .rfind('\n')
            .map(|index| before[..index].rsplit('\n').next().unwrap_or_default())
            .unwrap_or_default();
        assert!(
            attribute_line.contains("serde_int64") || attribute_line.contains("serde(rename"),
            "{field} must serialize through serde_int64 per API_SPEC 13.6; found attribute line {attribute_line:?}",
        );
    }
}

/// Body of one store function, used to prove the sweep semantics are local to
/// the reconcile path instead of being inferred from the whole file.
fn reconcile_body() -> &'static str {
    POSTGRES_SOURCE
        .split("async fn reconcile_team_seats(")
        .nth(1)
        .expect("postgres store must expose a reconcile_team_seats function")
        .split("\nasync fn ")
        .next()
        .unwrap_or_default()
}

#[test]
fn member_removal_reconciliation_revokes_departed_members_in_one_transaction() {
    let body = reconcile_body();

    // Authorization first: the caller needs the IAM-published seat-management
    // capability, and a denial is the 403 `seat_management_forbidden` reason.
    assert!(
        body.contains("authorize_team_seat_management(organization_directory, &scope).await?;"),
        "reconcile must authorize before touching a seat row",
    );

    // The sweep resolves ONLY an active|grace_period team subscription; no
    // subscription is the 409 `team_subscription_inactive` conflict.
    assert!(POSTGRES_SOURCE.contains("const LOAD_RECONCILABLE_TEAM_SUBSCRIPTION_ROW"));
    assert!(
        POSTGRES_SOURCE.contains("AND ms.status IN ('active', 'grace_period')"),
        "reconciliation must resolve an active|grace_period team subscription",
    );
    assert!(body.contains("LOAD_RECONCILABLE_TEAM_SUBSCRIPTION_ROW"));
    assert!(body
        .contains("\"team_subscription_inactive: organization has no active team subscription\""));

    // One transaction serialized by the per-subscription advisory xact lock.
    assert!(body.contains("pool.begin().await"));
    assert!(body.contains("tx.commit()"));
    assert!(
        body.contains("pg_advisory_xact_lock"),
        "reconcile must take the per-subscription advisory xact lock",
    );
    assert!(
        body.contains("membership-team-seat:{subscription_id}"),
        "the advisory lock key must be keyed by the subscription id",
    );

    // The stale set is decided by IAM's active-member answer, never by reading
    // an IAM table or per-seat membership probe.
    assert!(body.contains("filter_active_member_ids("));
    assert!(!body.contains("iam_organization"));
    assert!(
        body.contains("departed_seat_assignments(&assignments, &active_member_ids)"),
        "a seat is stale exactly when IAM omits its user from the active member ids",
    );
    let selector = POSTGRES_SOURCE
        .split("fn departed_seat_assignments(")
        .nth(1)
        .expect("the departed-seat selector must exist")
        .split("\nasync fn ")
        .next()
        .unwrap_or_default();
    assert!(
        selector.contains("!active.contains(user_id.as_str())"),
        "the selector must keep only users IAM no longer reports as active members",
    );
    assert!(
        body.contains("AND subscription_id = $2\n          AND state = 'active'"),
        "the sweep must load the active assignments of the resolved subscription",
    );

    // Revocation is the member-removal write: revoked state, timestamp,
    // `member_removed` reason, and the caller as the revoke actor.
    assert!(body.contains("SET state = 'revoked'"));
    assert!(body.contains("revoked_reason = 'member_removed'"));
    assert!(body.contains("revoke_actor_user_id = CAST($2 AS TEXT)"));
    assert!(
        body.contains("AND state = 'active'"),
        "a repeat sweep must only ever touch still-active assignments",
    );

    // seats_used is decremented by the revoked count and never goes negative.
    assert!(
        body.contains("SET seats_used = GREATEST(seats_used - $1, 0)"),
        "seats_used must decrement by the revoked count and clamp at zero",
    );

    // One audit row per revoked assignment with the required metadata.
    assert!(body.contains("for (_, user_id) in &stale"));
    assert!(body.contains("\"seat_revoke\""));
    assert!(
        body.contains("serde_json::json!({ \"reason\": \"member_removed\", \"userId\": user_id })"),
        "each revoked assignment needs member_removed/userId change-log metadata",
    );

    // Idempotency: when IAM reports no departed member the sweep writes nothing
    // and answers revoked_count = 0 with the unchanged counters.
    let empty_branch = body
        .split("if stale.is_empty() {")
        .nth(1)
        .unwrap_or_default()
        .split("\n    }")
        .next()
        .unwrap_or_default();
    assert!(empty_branch.contains("revoked_count: 0"));
    assert!(
        !empty_branch.contains("UPDATE membership_seat_assignment"),
        "an idempotent repeat sweep must not rewrite a seat row",
    );

    // The response carries membership-owned counters only.
    assert!(TYPES_SOURCE.contains("pub struct TeamSeatReconciliation"));
    for field in [
        "pub revoked_count: i64",
        "pub seats_used: i64",
        "pub seats_purchased: i64",
    ] {
        assert!(
            TYPES_SOURCE.contains(field),
            "TeamSeatReconciliation must declare {field}",
        );
    }
    assert!(TYPES_SOURCE.contains("pub struct ReconcileTeamSeatsCommand"));
}

#[test]
fn membership_never_persists_or_serializes_an_iam_email_for_team_seats() {
    // Source guard for the team seat path: the membership crate has no email
    // field, no email projection, and no email parameter. `member_email` may
    // exist as a legacy DB column, but it is written as NULL and never read.
    assert_eq!(
        1,
        POSTGRES_SOURCE.matches("member_email").count(),
        "postgres.rs may mention member_email only as the legacy INSERT column",
    );
    assert!(
        POSTGRES_SOURCE.contains("membership_id, member_display_name, member_email, state"),
        "member_email must only appear in the seat-assignment INSERT column list",
    );
    assert!(
        POSTGRES_SOURCE.contains(".bind(Option::<String>::None)"),
        "the legacy member_email column must be written as NULL",
    );
    for forbidden in [
        "AS member_email",
        "SELECT member_email",
        "member_email =",
        "SET member_email",
        "revoked_email",
        "member_email:",
    ] {
        assert!(
            !POSTGRES_SOURCE.contains(forbidden),
            "postgres.rs must never read, write, or project an email value: {forbidden}",
        );
    }
    // Every other membership source carries no email vocabulary at all.
    for (name, source) in [
        ("types.rs", TYPES_SOURCE),
        ("lib.rs", LIB_SOURCE),
        ("app router", APP_ROUTER_SOURCE),
    ] {
        assert!(
            !source.to_ascii_lowercase().contains("email"),
            "{name} must not declare, project, or serialize an email field on the team seat path",
        );
    }

    // The seat assignment DTO is membership-owned facts only.
    let assignment_block = TYPES_SOURCE
        .split("pub struct TeamSeatAssignment {")
        .nth(1)
        .expect("TeamSeatAssignment DTO")
        .split("\n}")
        .next()
        .unwrap_or_default();
    for field in [
        "pub user_id: String",
        "pub membership_id: Option<String>",
        "pub seat_no: i64",
        "pub assigned_at: String",
    ] {
        assert!(
            assignment_block.contains(field),
            "TeamSeatAssignment must declare {field}",
        );
    }
    assert!(!assignment_block.to_ascii_lowercase().contains("email"));

    // The published OpenAPI contract and the generated SDK types never expose
    // an email on the seat or reconciliation schemas.
    assert!(
        !APP_OPENAPI_SOURCE.to_ascii_lowercase().contains("email"),
        "the membership app OpenAPI must not publish an email field",
    );
    assert!(!TEAM_SEAT_ASSIGNMENT_SDK_TYPE
        .to_ascii_lowercase()
        .contains("email"));
    assert!(!TEAM_SEAT_RECONCILIATION_SDK_TYPE
        .to_ascii_lowercase()
        .contains("email"));
    assert!(TEAM_SEAT_RECONCILIATION_SDK_TYPE.contains("revokedCount: number"));
    assert!(TEAM_SEAT_RECONCILIATION_SDK_TYPE.contains("seatsUsed: number"));
    assert!(TEAM_SEAT_RECONCILIATION_SDK_TYPE.contains("seatsPurchased: number"));

    // The reconcile operation is part of the published contract with the
    // membership-owned result schema only.
    assert!(APP_OPENAPI_SOURCE.contains("\"operationId\": \"teamSeats.reconcile\""));
    assert!(APP_OPENAPI_SOURCE.contains("\"TeamSeatReconciliation\""));
    assert!(APP_OPENAPI_SOURCE.contains("\"revokedCount\""));
}

/// Source guard for the admin/ops organization (team) subscription read model.
///
/// Membership owns the subscription and seat counters; organization identity is
/// the subscription `subject_id` (the IAM organization id). The read model must
/// stay tenant-scoped, index-backed, LIKE-escaped, and must never consult the
/// IAM directory port for profiles, roles, or member rows.
#[test]
fn admin_team_subscription_read_model_is_tenant_scoped_and_index_backed() {
    let block = POSTGRES_SOURCE
        .split("async fn list_admin_team_subscriptions(")
        .nth(1)
        .expect("list_admin_team_subscriptions implementation")
        .split("\nasync fn ")
        .next()
        .unwrap_or_default();

    assert!(LIB_SOURCE.contains("pub use types::{"));
    assert!(LIB_SOURCE.contains("ListAdminTeamSubscriptionsQuery"));
    assert!(LIB_SOURCE.contains("AdminTeamSubscriptionItem"));
    assert!(TYPES_SOURCE.contains("pub struct AdminTeamSubscriptionItem"));
    assert!(TYPES_SOURCE.contains("pub struct ListAdminTeamSubscriptionsQuery"));
    assert!(
        TYPES_SOURCE.contains("fn list_admin_team_subscriptions"),
        "the AdminMembershipStore port must declare the team subscription query",
    );

    // The seat counters are int64 on the wire (API_SPEC §13.6): serialized as
    // strings through the shared helper, never as JSON numbers.
    let item_block = TYPES_SOURCE
        .split("pub struct AdminTeamSubscriptionItem {")
        .nth(1)
        .expect("AdminTeamSubscriptionItem DTO")
        .split("\n}")
        .next()
        .unwrap_or_default();
    assert_eq!(
        3,
        item_block
            .matches("#[serde(with = \"sdkwork_utils_rust::serde_int64\")]")
            .count(),
        "seatsPurchased, seatsUsed, and seatsAvailable must serialize as int64 strings",
    );
    for field in [
        "pub subscription_id: String",
        "pub organization_id: String",
        "pub plan_id: String",
        "pub plan_name: Option<String>",
        "pub seat_policy: String",
        "pub auto_assign_seat: bool",
        "pub owner_user_id: String",
    ] {
        assert!(
            item_block.contains(field),
            "AdminTeamSubscriptionItem must declare {field}",
        );
    }

    // Tenant scope comes from the principal; the organization filter narrows by
    // the subscription subject (the IAM organization id), not an ambient header.
    assert!(block.contains("ms.tenant_id = CAST($1 AS TEXT)"));
    assert!(block.contains("AND ms.category = 'token'"));
    assert!(block.contains("AND ms.subject_type = 'organization'"));
    assert!(block.contains("ms.subject_id = CAST($4 AS TEXT)"));

    // The plan name comes from the membership plan join.
    assert!(block.contains("LEFT JOIN membership_plan l ON l.id = ms.plan_id"));
    assert!(block.contains("l.name AS plan_name"));

    // Free-text `q` is escaped before it becomes a LIKE pattern, so `%` and `_`
    // cannot widen the filter into a wildcard query.
    assert!(block.contains("escape_like_pattern(value)"));
    assert_eq!(
        6,
        block.matches("ILIKE $5 ESCAPE '\\'").count(),
        "q must match subscription id, organization id, and plan name with an escaped LIKE in both the count and page queries",
    );
    assert!(
        POSTGRES_SOURCE.contains("OR ms.id ILIKE $5 ESCAPE '\\'"),
        "q must match the subscription id",
    );
    assert!(
        block.contains("COALESCE(l.name, '') ILIKE $5 ESCAPE '\\'"),
        "q must match the plan name",
    );

    // Membership-owned counters and timestamps only.
    for column in [
        "CAST(COALESCE(ms.seats_purchased, 1) AS INTEGER) AS seats_purchased",
        "CAST(COALESCE(ms.seats_used, 0) AS INTEGER) AS seats_used",
        "ms.seat_policy",
        "CAST(COALESCE(ms.auto_assign_seat, 1) AS INTEGER) AS auto_assign_seat",
        "ms.owner_user_id",
        "CAST(ms.created_at AS TEXT) AS created_at",
        "CAST(ms.updated_at AS TEXT) AS updated_at",
    ] {
        assert!(
            block.contains(column),
            "team subscription query must read {column}"
        );
    }

    // No IAM port is called: organization profiles, roles, and member rows stay
    // IAM-owned facts.
    for forbidden in [
        "organization_directory",
        "authorize_organization_action",
        "membership_seat_assignment",
    ] {
        assert!(
            !block.contains(forbidden),
            "the team subscription read model must not consult {forbidden}",
        );
    }

    // The organization scope is the subscription subject, never an ambient header.
    assert!(!block.contains("x-sdkwork-organization-id"));
    assert!(!block.contains("x-organization-id"));
}

#[test]
fn admin_list_pagination_and_like_escaping_keep_the_standard_window() {
    use sdkwork_membership_repository_sqlx::pagination::MembershipListQuery;
    use sdkwork_membership_repository_sqlx::shared::escape_like_pattern;

    // Default window: page 1, page size 20, offset 0.
    let default = MembershipListQuery::default().offset_params();
    assert_eq!(
        (1, 20, 0),
        (default.page, default.page_size, default.offset)
    );

    // page_size is clamped into 1..=200 and page into 1..=10000.
    let oversized = MembershipListQuery {
        page: Some(3),
        page_size: Some(500),
        ..MembershipListQuery::default()
    }
    .offset_params();
    assert_eq!(
        (3, 200, 400),
        (oversized.page, oversized.page_size, oversized.offset)
    );

    let undersized = MembershipListQuery {
        page: Some(0),
        page_size: Some(0),
        ..MembershipListQuery::default()
    }
    .offset_params();
    assert_eq!(
        (1, 1, 0),
        (undersized.page, undersized.page_size, undersized.offset)
    );

    // A numeric offset cursor continues from the requested offset (PAGINATION_SPEC §2.4).
    let cursor = MembershipListQuery {
        cursor: Some("200".to_owned()),
        page_size: Some(20),
        ..MembershipListQuery::default()
    }
    .offset_params();
    assert_eq!(
        (11, 20, 200),
        (cursor.page, cursor.page_size, cursor.offset)
    );

    let malformed_cursor = MembershipListQuery {
        cursor: Some("not-an-offset".to_owned()),
        ..MembershipListQuery::default()
    }
    .offset_params();
    assert_eq!(
        (1, 20, 0),
        (
            malformed_cursor.page,
            malformed_cursor.page_size,
            malformed_cursor.offset
        )
    );

    // LIKE metacharacters are escaped so a literal `%`/`_`/`\` matches itself.
    assert_eq!("plain", escape_like_pattern("plain"));
    assert_eq!("100\\%", escape_like_pattern("100%"));
    assert_eq!("a\\_b", escape_like_pattern("a_b"));
    assert_eq!("c\\\\d", escape_like_pattern("c\\d"));
    assert_eq!(
        "\\%\\_\\\\",
        escape_like_pattern("%_\\"),
        "every LIKE metacharacter must be escaped",
    );
}
