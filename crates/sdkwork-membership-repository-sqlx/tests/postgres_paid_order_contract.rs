const POSTGRES_SOURCE: &str = include_str!("../src/postgres.rs");

#[test]
fn postgres_paid_order_fulfillment_keeps_concurrency_and_replay_guards() {
    assert!(POSTGRES_SOURCE.contains("SELECT pg_advisory_xact_lock($1)"));
    assert!(POSTGRES_SOURCE.contains("AND mp.source_order_id = $4"));
    assert!(POSTGRES_SOURCE
        .contains("starts_at = CASE WHEN $6 THEN starts_at ELSE $7::timestamptz END"));
    // Bound timestamp strings must carry an explicit timestamptz cast so
    // PostgreSQL does not reject text -> timestamptz in UPDATE SET clauses.
    assert!(POSTGRES_SOURCE.contains("expires_at = $8::timestamptz,"));
    assert!(POSTGRES_SOURCE.contains("updated_at = $11::timestamptz"));
}

#[test]
fn postgres_platform_catalog_and_entitlement_identity_are_stable() {
    assert!(POSTGRES_SOURCE
        .contains("p.tenant_id = CAST($1 AS TEXT) OR p.tenant_id = CAST($4 AS TEXT)"));
    assert!(POSTGRES_SOURCE.contains(".bind(DEFAULT_CATALOG_TENANT_ID)"));
    assert!(POSTGRES_SOURCE.contains(
        "let period_id = membership_period_id(&binding.membership_uuid, &command.order_no);"
    ));
    assert!(POSTGRES_SOURCE
        .contains("let grant_id = format!(\"{}-entitlement-grant-{}\", period_id, index + 1);"));
    assert!(POSTGRES_SOURCE
        .contains("let ledger_id = format!(\"{}-entitlement-ledger-{}\", period_id, index + 1);"));
}

/// `add_seats` must never fall through to the reserve/activate path that creates
/// or extends a subscription period.
#[test]
fn postgres_paid_seat_expansion_branches_before_the_new_subscription_path() {
    let branch = POSTGRES_SOURCE
        .find("eq_ignore_ascii_case(MEMBERSHIP_PURCHASE_ACTION_ADD_SEATS)")
        .expect("add_seats branch in paid fulfilment");
    let subscription_path = POSTGRES_SOURCE
        .find("let purchase = paid_membership_purchase_submit_command(&command)?;")
        .expect("new-subscription fulfilment path");
    assert!(
        branch < subscription_path,
        "add_seats must branch before the purchase/renew/upgrade path"
    );

    // The expansion writes no period row and no subscription activation fields.
    let expansion = POSTGRES_SOURCE
        .find("async fn add_purchased_seats_by_order(")
        .expect("seat expansion fulfilment");
    let next_fn = POSTGRES_SOURCE[expansion..]
        .find("\nasync fn fulfill_purchase_by_order(")
        .map(|offset| expansion + offset)
        .expect("next fulfilment function");
    let body = &POSTGRES_SOURCE[expansion..next_fn];
    assert!(!body.contains("INSERT INTO membership_period"));
    assert!(!body.contains("starts_at ="));
    assert!(!body.contains("current_period_id"));
    assert!(!body.contains("seats_used"));
    assert!(body.contains("SET seats_purchased = seats_purchased + $1,"));
}
