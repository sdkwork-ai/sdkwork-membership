use sdkwork_contract_service::{CommerceServiceError, CommerceSurfaceProfile};
use sdkwork_membership_service::{
    allocate_team_seat_number, membership_service_contract, validate_team_seat_policy_transition,
    EntitlementGrantDraft, MembershipActivationDraft, MembershipAudience, MembershipBillingCycle,
    MembershipCategory, MembershipPackageDraft, MembershipPackageGroupDraft,
    MembershipPackageGroupDraftInput, MembershipPackageGroupListQuery, MembershipPackageListQuery,
    MembershipPlanDraft, MembershipPortRequirement, MembershipPurchaseDraft,
    MembershipRepositoryCommand, MembershipSeatPolicy, MembershipStatus, MembershipTransition,
    TeamSeatAssignmentDraft, TeamSeatPolicyDraft,
};

#[test]
fn membership_category_vocabulary_is_token_and_community() {
    assert_eq!(MembershipCategory::Token.as_storage_str(), "token");
    assert_eq!(MembershipCategory::Community.as_storage_str(), "community");
    assert_eq!(
        MembershipCategory::parse("token").unwrap(),
        MembershipCategory::Token
    );
    assert_eq!(
        MembershipCategory::parse("COMMUNITY").unwrap(),
        MembershipCategory::Community
    );
    assert!(MembershipCategory::parse("course").is_err());
    assert_eq!(MembershipCategory::Token.to_string(), "token");
    assert_eq!(MembershipCategory::Community.to_string(), "community");
}

#[test]
fn membership_billing_cycle_covers_sellable_families() {
    assert_eq!(MembershipBillingCycle::Once.as_storage_str(), "once");
    assert_eq!(MembershipBillingCycle::Day.as_storage_str(), "day");
    assert_eq!(MembershipBillingCycle::Week.as_storage_str(), "week");
    assert_eq!(MembershipBillingCycle::Month.as_storage_str(), "month");
    assert_eq!(MembershipBillingCycle::Quarter.as_storage_str(), "quarter");
    assert_eq!(MembershipBillingCycle::Year.as_storage_str(), "year");
}

#[test]
fn membership_domain_contract_uses_standard_plan_and_package_terms() {
    let crate_root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
    let checked_sources = [
        "Cargo.toml",
        "src/lib.rs",
        "src/domain/mod.rs",
        "src/commands/mod.rs",
        "src/queries/mod.rs",
        "src/ports/mod.rs",
        "src/service/mod.rs",
    ];
    let banned_fragments = [
        concat!("V", "ip"),
        concat!("v", "ip"),
        concat!("V", "IP"),
        concat!("Membership", "Level"),
        concat!("level", "_id"),
        concat!("\"", "group", "_id", "\""),
        concat!("membership", "_duration_days"),
        concat!("CreateMembership", "Level"),
    ];

    let mut violations = Vec::new();
    for relative_path in checked_sources {
        let contents = std::fs::read_to_string(crate_root.join(relative_path))
            .unwrap_or_else(|error| panic!("failed to read {relative_path}: {error}"));
        for banned in banned_fragments {
            if contents.contains(banned) {
                violations.push(format!("{relative_path} contains `{banned}`"));
            }
        }
        for line in contents.lines() {
            let trimmed = line.trim_start();
            if trimmed.starts_with(concat!("pub group", "_id:"))
                || trimmed.starts_with(concat!("group", "_id:"))
            {
                violations.push(format!("{relative_path} contains legacy `{trimmed}`"));
            }
        }
    }

    assert!(
        violations.is_empty(),
        "membership domain must use plan/package terminology without legacy fragments:\n{}",
        violations.join("\n")
    );
}

#[test]
fn validates_membership_plan_definition_and_surface_visibility() {
    let plan = MembershipPlanDraft::new(
        "100001",
        "membership-plan-pro",
        MembershipCategory::Token,
        "Pro member",
        30,
        vec![CommerceSurfaceProfile::App, CommerceSurfaceProfile::Console],
    )
    .unwrap();

    assert_eq!(plan.plan_id, "membership-plan-pro");
    assert_eq!(plan.category, MembershipCategory::Token);
    assert_eq!(plan.validity_days, 30);
    assert!(plan.visible_surfaces.contains(&CommerceSurfaceProfile::App));
    assert!(MembershipPlanDraft::new(
        "100001",
        "membership-plan-pro",
        MembershipCategory::Community,
        "Pro member",
        0,
        vec![CommerceSurfaceProfile::App]
    )
    .is_err());
}

#[test]
fn validates_membership_status_lifecycle() {
    assert_eq!(
        MembershipStatus::PendingActivation.as_storage_str(),
        "pending_activation"
    );
    assert_eq!(MembershipStatus::Active.as_storage_str(), "active");
    assert_eq!(
        MembershipStatus::GracePeriod.as_storage_str(),
        "grace_period"
    );
    assert_eq!(MembershipStatus::Expired.as_storage_str(), "expired");
    assert_eq!(MembershipStatus::Cancelled.as_storage_str(), "cancelled");

    assert_eq!(
        MembershipTransition::new(
            MembershipStatus::PendingActivation,
            MembershipStatus::Active
        )
        .validate(),
        Ok(()),
    );
    assert_eq!(
        MembershipTransition::new(MembershipStatus::Active, MembershipStatus::Expired).validate(),
        Ok(()),
    );
    assert_eq!(
        MembershipTransition::new(MembershipStatus::Expired, MembershipStatus::Active).validate(),
        Err(CommerceServiceError::invalid_state(
            "invalid membership status transition"
        )),
    );
}

#[test]
fn membership_activation_requires_paid_order_and_idempotency() {
    let activation = MembershipActivationDraft::new(
        "100001",
        "order-1",
        "user-1",
        "membership-plan-pro",
        "idem-activate-1",
    )
    .unwrap();

    assert_eq!(activation.owner_user_id, "user-1");
    assert_eq!(activation.order_id, "order-1");
    assert!(MembershipActivationDraft::new(
        "100001",
        "",
        "user-1",
        "membership-plan-pro",
        "idem-activate-1"
    )
    .is_err());
}

#[test]
fn membership_entitlement_grants_are_bound_to_membership_and_quota() {
    let grant = EntitlementGrantDraft::new("100001", "membership-1", "model-quota", 1000).unwrap();

    assert_eq!(grant.entitlement_code, "model-quota");
    assert_eq!(grant.quantity, 1000);
    assert!(EntitlementGrantDraft::new("100001", "membership-1", "model-quota", 0).is_err());
}

#[test]
fn membership_repository_contract_exposes_required_commands() {
    assert_eq!(
        MembershipPortRequirement::standard_commands(),
        vec![
            MembershipRepositoryCommand::CreateMembershipPlan,
            MembershipRepositoryCommand::UpsertMembershipPackageGroup,
            MembershipRepositoryCommand::UpsertMembershipPackage,
            MembershipRepositoryCommand::ActivateMembership,
            MembershipRepositoryCommand::GrantEntitlement,
            MembershipRepositoryCommand::RenewMembership,
            MembershipRepositoryCommand::ExpireMembership,
            MembershipRepositoryCommand::CreateMembershipPurchase,
            MembershipRepositoryCommand::RenewMembershipPurchase,
            MembershipRepositoryCommand::UpgradeMembershipPurchase,
        ],
    );
}

#[test]
fn validates_membership_package_group_catalog_shape() {
    let group = MembershipPackageGroupDraft::from_input(MembershipPackageGroupDraftInput {
        tenant_id: "100001".to_string(),
        organization_id: "0".to_string(),
        category: MembershipCategory::Token,
        external_id: 1,
        package_group_no: "membership-month".to_string(),
        name: "Monthly purchase".to_string(),
        description: Some("Monthly membership packages".to_string()),
        billing_cycle: MembershipBillingCycle::Month,
        duration_days: 30,
        sort_weight: 10,
    })
    .unwrap();

    assert_eq!(group.external_id, 1);
    assert_eq!(group.category, MembershipCategory::Token);
    assert_eq!(group.package_group_no, "membership-month");
    assert_eq!(group.billing_cycle.as_storage_str(), "month");
    assert_eq!(group.duration_days, 30);
    assert!(
        MembershipPackageGroupDraft::from_input(MembershipPackageGroupDraftInput {
            tenant_id: "100001".to_string(),
            organization_id: "0".to_string(),
            category: MembershipCategory::Community,
            external_id: 0,
            package_group_no: "membership-month".to_string(),
            name: "Monthly purchase".to_string(),
            description: None,
            billing_cycle: MembershipBillingCycle::Month,
            duration_days: 30,
            sort_weight: 10,
        })
        .is_err()
    );
    assert!(
        MembershipPackageGroupDraft::from_input(MembershipPackageGroupDraftInput {
            tenant_id: "100001".to_string(),
            organization_id: "0".to_string(),
            category: MembershipCategory::Token,
            external_id: 1,
            package_group_no: String::new(),
            name: "Monthly purchase".to_string(),
            description: None,
            billing_cycle: MembershipBillingCycle::Month,
            duration_days: 30,
            sort_weight: 10,
        })
        .is_err()
    );
}

#[test]
fn validates_membership_package_catalog_shape_and_prices() {
    let package = MembershipPackageDraft::new(
        "100001",
        "0",
        MembershipCategory::Token,
        303,
        "membership-month-pro",
        "membership-package-group-month",
        "membership-plan-pro",
        Some("sku-membership-month-pro"),
        "Monthly Pro",
        Some("Advanced model access"),
        "6990",
        Some("12900"),
        "CNY",
        45_000,
        30,
        303,
        true,
        vec!["monthly".to_owned(), "advanced".to_owned()],
    )
    .unwrap();

    assert_eq!(package.external_id, 303);
    assert_eq!(package.category, MembershipCategory::Token);
    assert_eq!(package.package_group_id, "membership-package-group-month");
    assert_eq!(package.plan_id, "membership-plan-pro");
    assert_eq!(package.price_amount, "6990");
    assert_eq!(package.duration_days, 30);
    assert!(package.recommended);
    assert_eq!(package.tags, vec!["monthly", "advanced"]);

    assert!(MembershipPackageDraft::new(
        "100001",
        "0",
        MembershipCategory::Token,
        303,
        "membership-month-pro",
        "membership-package-group-month",
        "membership-plan-pro",
        None,
        "Monthly Pro",
        None,
        "-100",
        None,
        "CNY",
        45_000,
        30,
        303,
        true,
        Vec::new(),
    )
    .is_err());
    assert!(MembershipPackageDraft::new(
        "100001",
        "0",
        MembershipCategory::Token,
        303,
        "membership-month-pro",
        "membership-package-group-month",
        "membership-plan-pro",
        None,
        "Monthly Pro",
        None,
        "6990",
        None,
        "CNY",
        45_000,
        0,
        303,
        true,
        Vec::new(),
    )
    .is_err());
}

#[test]
fn membership_package_queries_keep_group_and_region_independent() {
    let group_query =
        MembershipPackageGroupListQuery::new("100001", Some("0"), Some("month")).unwrap();
    let package_query = MembershipPackageListQuery::new(
        "100001",
        Some("0"),
        Some("membership-package-group-month"),
        Some("membership-plan-pro"),
    )
    .unwrap();

    assert_eq!(group_query.billing_cycle.as_deref(), Some("month"));
    assert_eq!(
        package_query.package_group_id.as_deref(),
        Some("membership-package-group-month")
    );
    assert_eq!(
        package_query.plan_id.as_deref(),
        Some("membership-plan-pro")
    );
}

#[test]
fn membership_purchase_reserves_package_without_payment_method() {
    let purchase = MembershipPurchaseDraft::new("100001", "0", "user-1", 303, None).unwrap();

    assert_eq!(purchase.package_id, 303);
    assert!(purchase.coupon_id.is_none());
    assert!(MembershipPurchaseDraft::new("100001", "0", "user-1", 0, None).is_err());
}

#[test]
fn membership_service_contract_exposes_membership_package_catalog_operations() {
    let contract = membership_service_contract();

    for query in [
        "memberships.current.retrieve",
        "memberships.current.status.retrieve",
        "memberships.benefits.list",
        "memberships.packageGroups.list",
        "memberships.packageGroups.retrieve",
        "memberships.packageGroups.packages.list",
        "memberships.packages.list",
        "memberships.packages.retrieve",
        "memberships.points.balance.retrieve",
        "memberships.points.history.list",
        "memberships.points.dailyRewards.status.retrieve",
        "memberships.privileges.usage.retrieve",
        "memberships.team.subscription.retrieve",
        "memberships.team.seats.list",
    ] {
        assert!(
            contract.read_queries.contains(&query),
            "membership contract must expose read query {query}",
        );
    }

    for command in [
        "memberships.purchases.create",
        "memberships.purchases.renew",
        "memberships.purchases.upgrade",
        "memberships.points.dailyRewards.create",
        "memberships.privileges.speedUps.create",
        "memberships.team.seats.create",
        "memberships.team.seats.delete",
        "memberships.team.seats.policy.update",
        "memberships.team.seats.reconcile",
    ] {
        assert!(
            contract.write_commands.contains(&command),
            "membership contract must expose write command {command}",
        );
    }
}

#[test]
fn membership_audience_vocabulary_is_personal_and_team() {
    assert_eq!(MembershipAudience::Personal.as_storage_str(), "personal");
    assert_eq!(MembershipAudience::Team.as_storage_str(), "team");
    assert_eq!(
        MembershipAudience::parse(" TEAM ").unwrap(),
        MembershipAudience::Team
    );
    assert!(MembershipAudience::parse("company").is_err());
    assert_eq!(MembershipAudience::Personal.to_string(), "personal");
}

#[test]
fn membership_seat_policy_vocabulary_is_strict_and_flex_overflow() {
    assert_eq!(MembershipSeatPolicy::Strict.as_storage_str(), "strict");
    assert_eq!(
        MembershipSeatPolicy::FlexOverflow.as_storage_str(),
        "flex_overflow"
    );
    assert_eq!(
        MembershipSeatPolicy::parse("flex_overflow").unwrap(),
        MembershipSeatPolicy::FlexOverflow
    );
    assert!(MembershipSeatPolicy::parse("overflow").is_err());

    let draft = TeamSeatPolicyDraft::new("strict", false).expect("seat policy draft");
    assert_eq!(draft.seat_policy, MembershipSeatPolicy::Strict);
    assert!(!draft.auto_assign_seat);
    assert!(TeamSeatPolicyDraft::new("lenient", true).is_err());
}

#[test]
fn team_seat_allocation_picks_the_lowest_free_seat() {
    // Lowest free slot inside the licensed range.
    assert_eq!(
        allocate_team_seat_number(MembershipSeatPolicy::Strict, 5, 2, &[1, 3]).unwrap(),
        2
    );
    // Gaps are filled before extending the seat numbers.
    assert_eq!(
        allocate_team_seat_number(MembershipSeatPolicy::Strict, 5, 4, &[1, 2, 3, 5]).unwrap(),
        4
    );
    // Full licensed capacity still allocates the next seat under flex overflow.
    assert_eq!(
        allocate_team_seat_number(MembershipSeatPolicy::FlexOverflow, 3, 3, &[1, 2, 3]).unwrap(),
        4
    );
    // Strict capacity exhaustion is rejected, not silently overflowed.
    assert_eq!(
        allocate_team_seat_number(MembershipSeatPolicy::Strict, 3, 3, &[1, 2, 3]).unwrap_err(),
        CommerceServiceError::conflict("seat_capacity_exceeded")
    );
}

#[test]
fn team_seat_policy_switch_to_strict_requires_capacity() {
    assert!(validate_team_seat_policy_transition(MembershipSeatPolicy::Strict, 5, 5).is_ok());
    assert!(validate_team_seat_policy_transition(MembershipSeatPolicy::Strict, 5, 6).is_err());
    assert!(validate_team_seat_policy_transition(MembershipSeatPolicy::FlexOverflow, 5, 6).is_ok());
}

#[test]
fn team_seat_assignment_requires_a_target_user() {
    assert!(TeamSeatAssignmentDraft::new("42").is_ok());
    assert!(TeamSeatAssignmentDraft::new("   ").is_err());
}
