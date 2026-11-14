//! Live-PostgreSQL smoke test for the organization (team) seat projection.
//!
//! The fast source guards in `membership_sqlx_standard.rs` keep the SQL shape
//! visible without a database. This ignored test is the cheap runtime check
//! that the team subscription lookup and the seat assignment page parse against
//! a real schema. Run with:
//!
//! ```text
//! cargo test -p sdkwork-membership-repository-sqlx --test team_seats_live_postgres -- --ignored
//! ```

use sdkwork_membership_repository_sqlx::{
    AppMembershipStore, AppMembershipTeamScope, PostgresCommerceMembershipStore, TeamSeatsQuery,
    TeamSubscriptionQuery,
};

fn database_url() -> String {
    std::env::var("SDKWORK_DATABASE_URL").unwrap_or_else(|_| {
        "postgresql://sdkwork_ai_dev:sdkworkdev123@127.0.0.1:5432/sdkwork_ai_dev".to_owned()
    })
}

fn scope() -> AppMembershipTeamScope {
    AppMembershipTeamScope {
        tenant_id: "100001".to_owned(),
        // An organization id that never holds seeded seats, so the assertion
        // stays valid on a seeded development database.
        organization_id: "999999901".to_owned(),
        user_id: "1".to_owned(),
    }
}

#[tokio::test]
#[ignore = "requires a local PostgreSQL database with the membership schema migrated"]
async fn team_subscription_overview_parses_against_live_schema() {
    let pool = sqlx::PgPool::connect(&database_url())
        .await
        .expect("connect database");
    let store = PostgresCommerceMembershipStore::new(pool);

    let overview = store
        .load_team_subscription(TeamSubscriptionQuery { scope: scope() })
        .await
        .expect("team subscription overview");
    // Membership-owned facts only: the response never carries IAM identity,
    // the viewer role, or member license counts.
    assert_eq!(overview.organization_id, "999999901");
    assert!(overview.seats_purchased >= 0);
    assert!(overview.seats_used >= 0);
    assert!(overview.seats_available >= 0);

    let seats = store
        .load_team_seats(TeamSeatsQuery {
            scope: scope(),
            page: Some(1),
            page_size: Some(5),
        })
        .await
        .expect("team seat assignments");
    assert!(seats.items.len() <= 5);
}
