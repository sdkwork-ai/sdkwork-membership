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

    // Team entitlement grants multiply the plan quantity by the seat count.
    assert!(POSTGRES_SOURCE.contains("(benefit.usage_limit.unwrap_or(0).max(0) * seats)"));

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
    assert!(POSTGRES_SOURCE.contains("filter_active_member_ids("));
    assert!(POSTGRES_SOURCE.contains("list_active_members("));
    assert!(LIB_SOURCE.contains("IamOrganizationDirectory"));
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

#[test]
fn app_router_exposes_team_seat_operations() {
    assert!(APP_ROUTER_SOURCE.contains("/app/v3/api/memberships/team/subscription"));
    assert!(APP_ROUTER_SOURCE.contains("/app/v3/api/memberships/team/seats"));
    assert!(APP_ROUTER_SOURCE.contains("/app/v3/api/memberships/team/seats/policy"));
    assert!(APP_ROUTER_SOURCE.contains("/app/v3/api/memberships/team/seats/{userId}"));
    assert!(APP_ROUTER_SOURCE.contains("finish_api_no_content("));
    assert!(APP_ROUTER_SOURCE.contains("seat_management_forbidden"));
    assert!(APP_ROUTER_SOURCE.contains("last_seat_owner_required"));
    assert!(APP_ROUTER_SOURCE.contains("not_organization_member"));
    assert!(APP_ROUTER_SOURCE.contains("seat_already_assigned"));
    assert!(APP_ROUTER_SOURCE.contains("team_subscription_inactive"));
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
