use sdkwork_contract_service::{CommerceMoney, CommerceServiceError, CommerceSurfaceProfile};

/// Catalog classification of membership plans, package groups, and packages.
///
/// The catalog is organized into plan families: `token` (Token Plan
/// compute-credit plans) and `community` (circle/community membership plans).
/// The vocabulary is extensible; new values are added here and in the
/// database CHECK constraints via migration.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum MembershipCategory {
    Token,
    Community,
}

impl MembershipCategory {
    pub const fn as_storage_str(&self) -> &'static str {
        match self {
            Self::Token => "token",
            Self::Community => "community",
        }
    }

    pub fn parse(value: &str) -> Result<Self, CommerceServiceError> {
        match value.trim().to_ascii_lowercase().as_str() {
            "token" => Ok(Self::Token),
            "community" => Ok(Self::Community),
            _ => Err(CommerceServiceError::validation(
                "membership category must be token or community",
            )),
        }
    }
}

impl std::fmt::Display for MembershipCategory {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(self.as_storage_str())
    }
}

/// Catalog audience: `personal` plans serve one user, `team` plans serve an
/// organization and license seats.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum MembershipAudience {
    Personal,
    Team,
}

impl MembershipAudience {
    pub const fn as_storage_str(&self) -> &'static str {
        match self {
            Self::Personal => "personal",
            Self::Team => "team",
        }
    }

    pub fn parse(value: &str) -> Result<Self, CommerceServiceError> {
        match value.trim().to_ascii_lowercase().as_str() {
            "personal" => Ok(Self::Personal),
            "team" => Ok(Self::Team),
            _ => Err(CommerceServiceError::validation(
                "membership audience must be personal or team",
            )),
        }
    }
}

impl std::fmt::Display for MembershipAudience {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(self.as_storage_str())
    }
}

/// Seat policy of an organization (team) subscription.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum MembershipSeatPolicy {
    /// Assignments beyond `seats_purchased` are rejected.
    Strict,
    /// Assignments beyond `seats_purchased` are allowed and tracked as
    /// overflow.
    FlexOverflow,
}

impl MembershipSeatPolicy {
    pub const fn as_storage_str(&self) -> &'static str {
        match self {
            Self::Strict => "strict",
            Self::FlexOverflow => "flex_overflow",
        }
    }

    pub fn parse(value: &str) -> Result<Self, CommerceServiceError> {
        match value.trim().to_ascii_lowercase().as_str() {
            "strict" => Ok(Self::Strict),
            "flex_overflow" => Ok(Self::FlexOverflow),
            _ => Err(CommerceServiceError::validation(
                "membership seat policy must be strict or flex_overflow",
            )),
        }
    }
}

impl std::fmt::Display for MembershipSeatPolicy {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(self.as_storage_str())
    }
}

/// Seat policy mutation accepted by `PATCH /team/seats/policy`.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct TeamSeatPolicyDraft {
    pub seat_policy: MembershipSeatPolicy,
    pub auto_assign_seat: bool,
}

impl TeamSeatPolicyDraft {
    pub fn new(seat_policy: &str, auto_assign_seat: bool) -> Result<Self, CommerceServiceError> {
        Ok(Self {
            seat_policy: MembershipSeatPolicy::parse(seat_policy)?,
            auto_assign_seat,
        })
    }
}

/// Rejects a policy switch that the current seat usage cannot satisfy.
///
/// `flex_overflow` may leave `seats_used` above `seats_purchased`; switching
/// that subscription back to `strict` would violate the licensed capacity, so
/// the transition is rejected until enough seats are released.
pub fn validate_team_seat_policy_transition(
    seat_policy: MembershipSeatPolicy,
    seats_purchased: i64,
    seats_used: i64,
) -> Result<(), CommerceServiceError> {
    if seat_policy == MembershipSeatPolicy::Strict && seats_used > seats_purchased.max(1) {
        return Err(CommerceServiceError::conflict("seat_capacity_exceeded"));
    }
    Ok(())
}

/// Chooses the lowest free seat number for a new assignment.
///
/// The candidate range is `1..=max(seats_purchased, seats_used + 1)`: under
/// `flex_overflow` the extra seat above the licensed capacity is always
/// addressable, and under `strict` the caller has already been rejected when
/// the licensed capacity is exhausted.
pub fn allocate_team_seat_number(
    seat_policy: MembershipSeatPolicy,
    seats_purchased: i64,
    seats_used: i64,
    occupied_seat_numbers: &[i64],
) -> Result<i64, CommerceServiceError> {
    let seats_purchased = seats_purchased.max(1);
    let seats_used = seats_used.max(0);
    if seat_policy == MembershipSeatPolicy::Strict && seats_used >= seats_purchased {
        return Err(CommerceServiceError::conflict("seat_capacity_exceeded"));
    }
    let max_seat = seats_purchased.max(seats_used.saturating_add(1));
    for candidate in 1..=max_seat {
        if !occupied_seat_numbers.contains(&candidate) {
            return Ok(candidate);
        }
    }
    Err(CommerceServiceError::conflict("seat_capacity_exceeded"))
}

/// Seat assignment request draft (`POST /team/seats` body `{ userId }`).
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TeamSeatAssignmentDraft {
    pub user_id: String,
}

impl TeamSeatAssignmentDraft {
    pub fn new(user_id: &str) -> Result<Self, CommerceServiceError> {
        crate::validation::require_non_empty("user_id", user_id)?;
        Ok(Self {
            user_id: user_id.trim().to_string(),
        })
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MembershipBillingCycle {
    Once,
    Day,
    Week,
    Month,
    Quarter,
    Year,
}

impl MembershipBillingCycle {
    pub const fn as_storage_str(&self) -> &'static str {
        match self {
            Self::Once => "once",
            Self::Day => "day",
            Self::Week => "week",
            Self::Month => "month",
            Self::Quarter => "quarter",
            Self::Year => "year",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MembershipPlanDraft {
    pub plan_id: String,
    pub category: MembershipCategory,
    pub name: String,
    pub tenant_id: String,
    pub validity_days: u32,
    pub visible_surfaces: Vec<CommerceSurfaceProfile>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MembershipPackageGroupDraft {
    pub tenant_id: String,
    pub organization_id: String,
    pub category: MembershipCategory,
    pub external_id: i64,
    pub package_group_no: String,
    pub name: String,
    pub description: Option<String>,
    pub billing_cycle: MembershipBillingCycle,
    pub duration_days: u32,
    pub sort_weight: i64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MembershipPackageGroupDraftInput {
    pub tenant_id: String,
    pub organization_id: String,
    pub category: MembershipCategory,
    pub external_id: i64,
    pub package_group_no: String,
    pub name: String,
    pub description: Option<String>,
    pub billing_cycle: MembershipBillingCycle,
    pub duration_days: u32,
    pub sort_weight: i64,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MembershipPackageDraft {
    pub tenant_id: String,
    pub organization_id: String,
    pub category: MembershipCategory,
    pub external_id: i64,
    pub package_no: String,
    pub package_group_id: String,
    pub plan_id: String,
    pub sku_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub price_amount: String,
    pub original_price_amount: Option<String>,
    pub currency_code: String,
    pub point_amount: i64,
    pub duration_days: u32,
    pub sort_weight: i64,
    pub recommended: bool,
    pub tags: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MembershipStatus {
    PendingActivation,
    Active,
    GracePeriod,
    Expired,
    Cancelled,
}

impl MembershipStatus {
    pub const fn as_storage_str(&self) -> &'static str {
        match self {
            Self::PendingActivation => "pending_activation",
            Self::Active => "active",
            Self::GracePeriod => "grace_period",
            Self::Expired => "expired",
            Self::Cancelled => "cancelled",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MembershipTransition {
    from: MembershipStatus,
    to: MembershipStatus,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MembershipActivationDraft {
    pub idempotency_key: String,
    pub plan_id: String,
    pub order_id: String,
    pub owner_user_id: String,
    pub tenant_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EntitlementGrantDraft {
    pub entitlement_code: String,
    pub membership_id: String,
    pub quantity: u64,
    pub tenant_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MembershipPurchaseDraft {
    pub tenant_id: String,
    pub organization_id: String,
    pub owner_user_id: String,
    pub package_id: i64,
    pub coupon_id: Option<String>,
}

impl MembershipPlanDraft {
    pub fn new(
        tenant_id: &str,
        plan_id: &str,
        category: MembershipCategory,
        name: &str,
        validity_days: u32,
        visible_surfaces: Vec<CommerceSurfaceProfile>,
    ) -> Result<Self, CommerceServiceError> {
        crate::validation::require_non_empty("tenant_id", tenant_id)?;
        crate::validation::require_non_empty("plan_id", plan_id)?;
        crate::validation::require_non_empty("name", name)?;
        if validity_days == 0 {
            return Err(CommerceServiceError::validation(
                "validity_days must be greater than zero",
            ));
        }
        if visible_surfaces.is_empty() {
            return Err(CommerceServiceError::validation(
                "visible_surfaces requires at least one surface",
            ));
        }

        Ok(Self {
            plan_id: plan_id.to_string(),
            category,
            name: name.to_string(),
            tenant_id: tenant_id.to_string(),
            validity_days,
            visible_surfaces,
        })
    }
}

impl MembershipPackageGroupDraft {
    pub fn from_input(
        input: MembershipPackageGroupDraftInput,
    ) -> Result<Self, CommerceServiceError> {
        crate::validation::require_non_empty("tenant_id", &input.tenant_id)?;
        crate::validation::require_non_empty("organization_id", &input.organization_id)?;
        crate::validation::require_non_empty("package_group_no", &input.package_group_no)?;
        crate::validation::require_non_empty("name", &input.name)?;
        if input.external_id <= 0 {
            return Err(CommerceServiceError::validation(
                "external_id must be greater than zero",
            ));
        }
        if input.duration_days == 0 {
            return Err(CommerceServiceError::validation(
                "duration_days must be greater than zero",
            ));
        }

        Ok(Self {
            tenant_id: input.tenant_id,
            organization_id: input.organization_id,
            category: input.category,
            external_id: input.external_id,
            package_group_no: input.package_group_no,
            name: input.name,
            description: crate::validation::normalize_optional_text(input.description.as_deref()),
            billing_cycle: input.billing_cycle,
            duration_days: input.duration_days,
            sort_weight: input.sort_weight,
        })
    }

    #[allow(clippy::too_many_arguments)]
    pub fn new(
        tenant_id: &str,
        organization_id: &str,
        category: MembershipCategory,
        external_id: i64,
        package_group_no: &str,
        name: &str,
        description: Option<&str>,
        billing_cycle: MembershipBillingCycle,
        duration_days: u32,
        sort_weight: i64,
    ) -> Result<Self, CommerceServiceError> {
        Self::from_input(MembershipPackageGroupDraftInput {
            tenant_id: tenant_id.to_string(),
            organization_id: organization_id.to_string(),
            category,
            external_id,
            package_group_no: package_group_no.to_string(),
            name: name.to_string(),
            description: crate::validation::normalize_optional_text(description),
            billing_cycle,
            duration_days,
            sort_weight,
        })
    }
}

impl MembershipPackageDraft {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        tenant_id: &str,
        organization_id: &str,
        category: MembershipCategory,
        external_id: i64,
        package_no: &str,
        package_group_id: &str,
        plan_id: &str,
        sku_id: Option<&str>,
        name: &str,
        description: Option<&str>,
        price_amount: &str,
        original_price_amount: Option<&str>,
        currency_code: &str,
        point_amount: i64,
        duration_days: u32,
        sort_weight: i64,
        recommended: bool,
        tags: Vec<String>,
    ) -> Result<Self, CommerceServiceError> {
        crate::validation::require_non_empty("tenant_id", tenant_id)?;
        crate::validation::require_non_empty("organization_id", organization_id)?;
        crate::validation::require_non_empty("package_no", package_no)?;
        crate::validation::require_non_empty("package_group_id", package_group_id)?;
        crate::validation::require_non_empty("plan_id", plan_id)?;
        crate::validation::require_non_empty("name", name)?;
        crate::validation::require_non_empty("currency_code", currency_code)?;
        if external_id <= 0 {
            return Err(CommerceServiceError::validation(
                "external_id must be greater than zero",
            ));
        }
        if point_amount < 0 {
            return Err(CommerceServiceError::validation(
                "point_amount must be greater than or equal to zero",
            ));
        }
        if duration_days == 0 {
            return Err(CommerceServiceError::validation(
                "duration_days must be greater than zero",
            ));
        }
        validate_money_amount("price_amount", price_amount)?;
        if let Some(original_price_amount) = original_price_amount {
            validate_money_amount("original_price_amount", original_price_amount)?;
        }

        Ok(Self {
            tenant_id: tenant_id.to_string(),
            organization_id: organization_id.to_string(),
            category,
            external_id,
            package_no: package_no.to_string(),
            package_group_id: package_group_id.to_string(),
            plan_id: plan_id.to_string(),
            sku_id: crate::validation::normalize_optional_text(sku_id),
            name: name.to_string(),
            description: crate::validation::normalize_optional_text(description),
            price_amount: price_amount.to_string(),
            original_price_amount: crate::validation::normalize_optional_text(
                original_price_amount,
            ),
            currency_code: currency_code.to_string(),
            point_amount,
            duration_days,
            sort_weight,
            recommended,
            tags: tags
                .into_iter()
                .map(|tag| tag.trim().to_string())
                .filter(|tag| !tag.is_empty())
                .collect(),
        })
    }
}

impl MembershipTransition {
    pub fn new(from: MembershipStatus, to: MembershipStatus) -> Self {
        Self { from, to }
    }

    pub fn validate(&self) -> Result<(), CommerceServiceError> {
        match (&self.from, &self.to) {
            (MembershipStatus::PendingActivation, MembershipStatus::Active)
            | (MembershipStatus::Active, MembershipStatus::GracePeriod)
            | (MembershipStatus::GracePeriod, MembershipStatus::Active)
            | (MembershipStatus::Active, MembershipStatus::Expired)
            | (MembershipStatus::GracePeriod, MembershipStatus::Expired)
            | (MembershipStatus::PendingActivation, MembershipStatus::Cancelled)
            | (MembershipStatus::Active, MembershipStatus::Cancelled) => Ok(()),
            _ => Err(CommerceServiceError::invalid_state(
                "invalid membership status transition",
            )),
        }
    }
}

impl MembershipActivationDraft {
    pub fn new(
        tenant_id: &str,
        order_id: &str,
        owner_user_id: &str,
        plan_id: &str,
        idempotency_key: &str,
    ) -> Result<Self, CommerceServiceError> {
        crate::validation::require_non_empty("tenant_id", tenant_id)?;
        crate::validation::require_non_empty("order_id", order_id)?;
        crate::validation::require_non_empty("owner_user_id", owner_user_id)?;
        crate::validation::require_non_empty("plan_id", plan_id)?;
        crate::validation::require_non_empty("idempotency_key", idempotency_key)?;

        Ok(Self {
            idempotency_key: idempotency_key.to_string(),
            plan_id: plan_id.to_string(),
            order_id: order_id.to_string(),
            owner_user_id: owner_user_id.to_string(),
            tenant_id: tenant_id.to_string(),
        })
    }
}

impl MembershipPurchaseDraft {
    pub fn new(
        tenant_id: &str,
        organization_id: &str,
        owner_user_id: &str,
        package_id: i64,
        coupon_id: Option<&str>,
    ) -> Result<Self, CommerceServiceError> {
        crate::validation::require_non_empty("tenant_id", tenant_id)?;
        crate::validation::require_non_empty("organization_id", organization_id)?;
        crate::validation::require_non_empty("owner_user_id", owner_user_id)?;
        if package_id <= 0 {
            return Err(CommerceServiceError::validation(
                "package_id must be greater than zero",
            ));
        }

        Ok(Self {
            tenant_id: tenant_id.to_string(),
            organization_id: organization_id.to_string(),
            owner_user_id: owner_user_id.to_string(),
            package_id,
            coupon_id: crate::validation::normalize_optional_text(coupon_id),
        })
    }
}

fn validate_money_amount(field_name: &str, value: &str) -> Result<(), CommerceServiceError> {
    CommerceMoney::new(value)
        .map(|_| ())
        .map_err(|message| CommerceServiceError::validation(format!("{field_name}: {message}")))
}

impl EntitlementGrantDraft {
    pub fn new(
        tenant_id: &str,
        membership_id: &str,
        entitlement_code: &str,
        quantity: u64,
    ) -> Result<Self, CommerceServiceError> {
        crate::validation::require_non_empty("tenant_id", tenant_id)?;
        crate::validation::require_non_empty("membership_id", membership_id)?;
        crate::validation::require_non_empty("entitlement_code", entitlement_code)?;
        if quantity == 0 {
            return Err(CommerceServiceError::validation(
                "quantity must be greater than zero",
            ));
        }

        Ok(Self {
            entitlement_code: entitlement_code.to_string(),
            membership_id: membership_id.to_string(),
            quantity,
            tenant_id: tenant_id.to_string(),
        })
    }
}
