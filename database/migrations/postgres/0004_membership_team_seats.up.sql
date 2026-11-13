-- sdkwork:migration
-- id: 0004_membership_team_seats
-- engine: postgres
-- module: sdkwork-membership
-- purpose: Add organization (team) subscriptions with seat licensing: plan/package audience, per-seat pricing bounds, subscription seat counters/policy, and the membership_seat_assignment table.
-- reversible: true
-- rollback: down-migration
-- transactional: true
-- lock: lightweight
-- lock_timeout: 2s
-- statement_timeout: 30s

BEGIN;

-- =============================================================================
-- 1. Catalog audience: personal plans vs team (organization) plans.
-- =============================================================================
ALTER TABLE membership_plan
    ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'personal';

ALTER TABLE membership_plan
    DROP CONSTRAINT IF EXISTS ck_membership_plan_audience;
ALTER TABLE membership_plan
    ADD CONSTRAINT ck_membership_plan_audience CHECK (audience IN ('personal', 'team'));

CREATE INDEX IF NOT EXISTS idx_membership_plan_tenant_audience
    ON membership_plan (tenant_id, organization_id, category, audience, status, sort_weight);

ALTER TABLE membership_package_group
    ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'personal';

ALTER TABLE membership_package_group
    DROP CONSTRAINT IF EXISTS ck_membership_package_group_audience;
ALTER TABLE membership_package_group
    ADD CONSTRAINT ck_membership_package_group_audience CHECK (audience IN ('personal', 'team'));

-- =============================================================================
-- 2. Per-seat pricing for team packages.
--    price_unit = 'seat' means price_amount is the unit price of one seat for
--    one billing period; the checkout total is unit price x seats.
-- =============================================================================
ALTER TABLE membership_package
    ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'personal';
ALTER TABLE membership_package
    ADD COLUMN IF NOT EXISTS price_unit TEXT NOT NULL DEFAULT 'package';
ALTER TABLE membership_package
    ADD COLUMN IF NOT EXISTS seat_min INTEGER NOT NULL DEFAULT 1;
ALTER TABLE membership_package
    ADD COLUMN IF NOT EXISTS seat_max INTEGER NOT NULL DEFAULT 500;
ALTER TABLE membership_package
    ADD COLUMN IF NOT EXISTS seat_points_amount INTEGER NOT NULL DEFAULT 0;

ALTER TABLE membership_package
    DROP CONSTRAINT IF EXISTS ck_membership_package_audience;
ALTER TABLE membership_package
    ADD CONSTRAINT ck_membership_package_audience CHECK (audience IN ('personal', 'team'));
ALTER TABLE membership_package
    DROP CONSTRAINT IF EXISTS ck_membership_package_price_unit;
ALTER TABLE membership_package
    ADD CONSTRAINT ck_membership_package_price_unit CHECK (price_unit IN ('package', 'seat'));
ALTER TABLE membership_package
    DROP CONSTRAINT IF EXISTS ck_membership_package_seat_bounds;
ALTER TABLE membership_package
    ADD CONSTRAINT ck_membership_package_seat_bounds CHECK (
        seat_min >= 1 AND seat_max >= seat_min AND seat_max <= 10000
    );
ALTER TABLE membership_package
    DROP CONSTRAINT IF EXISTS ck_membership_package_seat_points;
ALTER TABLE membership_package
    ADD CONSTRAINT ck_membership_package_seat_points CHECK (seat_points_amount >= 0);
ALTER TABLE membership_package
    DROP CONSTRAINT IF EXISTS ck_membership_package_team_seat_price;
ALTER TABLE membership_package
    ADD CONSTRAINT ck_membership_package_team_seat_price CHECK (
        price_unit <> 'seat' OR audience = 'team'
    );

-- =============================================================================
-- 3. Subscription subject + seat counters.
--    team subscriptions use subject_type = 'organization' and subject_id = the
--    IAM organization id; seats_purchased is the licensed capacity and
--    seats_used is the number of active seat assignments.
-- =============================================================================
ALTER TABLE membership_subscription
    ADD COLUMN IF NOT EXISTS seats_purchased INTEGER NOT NULL DEFAULT 1;
ALTER TABLE membership_subscription
    ADD COLUMN IF NOT EXISTS seats_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE membership_subscription
    ADD COLUMN IF NOT EXISTS seat_policy TEXT NOT NULL DEFAULT 'strict';
ALTER TABLE membership_subscription
    ADD COLUMN IF NOT EXISTS auto_assign_seat INTEGER NOT NULL DEFAULT 1;

ALTER TABLE membership_subscription
    DROP CONSTRAINT IF EXISTS ck_membership_subscription_subject_type;
ALTER TABLE membership_subscription
    ADD CONSTRAINT ck_membership_subscription_subject_type CHECK (
        subject_type IN ('user', 'organization')
    );
ALTER TABLE membership_subscription
    DROP CONSTRAINT IF EXISTS ck_membership_subscription_seat_policy;
ALTER TABLE membership_subscription
    ADD CONSTRAINT ck_membership_subscription_seat_policy CHECK (
        seat_policy IN ('strict', 'flex_overflow')
    );
ALTER TABLE membership_subscription
    DROP CONSTRAINT IF EXISTS ck_membership_subscription_seats;
ALTER TABLE membership_subscription
    ADD CONSTRAINT ck_membership_subscription_seats CHECK (
        seats_purchased >= 1
        AND seats_used >= 0
        AND (seat_policy = 'flex_overflow' OR seats_used <= seats_purchased)
    );

CREATE INDEX IF NOT EXISTS idx_membership_subscription_subject
    ON membership_subscription (tenant_id, subject_type, subject_id, category, status, expires_at DESC);

-- =============================================================================
-- 4. Seat assignment ledger.
-- =============================================================================
CREATE TABLE IF NOT EXISTS membership_seat_assignment (
    id                    TEXT NOT NULL,
    uuid                  VARCHAR(64),
    tenant_id             TEXT NOT NULL,
    organization_id       TEXT NOT NULL DEFAULT '0',
    subscription_id       TEXT NOT NULL,
    seat_no               INTEGER NOT NULL,
    user_id               TEXT NOT NULL,
    membership_id         TEXT,
    member_display_name   TEXT,
    member_email          TEXT,
    state                 TEXT NOT NULL DEFAULT 'active',
    assigned_by_user_id   TEXT NOT NULL,
    assigned_at           TIMESTAMPTZ NOT NULL,
    revoked_at            TIMESTAMPTZ,
    revoked_reason        TEXT,
    revoke_actor_user_id  TEXT,
    version               BIGINT NOT NULL DEFAULT 0,
    created_at            TIMESTAMPTZ NOT NULL,
    updated_at            TIMESTAMPTZ NOT NULL,
    CONSTRAINT pk_membership_seat_assignment PRIMARY KEY (id),
    CONSTRAINT ck_membership_seat_assignment_state CHECK (state IN ('active', 'revoked')),
    CONSTRAINT ck_membership_seat_assignment_seat_no CHECK (seat_no >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_membership_seat_assignment_uuid
    ON membership_seat_assignment (uuid);
CREATE UNIQUE INDEX IF NOT EXISTS uk_membership_seat_assignment_active_user
    ON membership_seat_assignment (subscription_id, user_id) WHERE state = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS uk_membership_seat_assignment_active_seat
    ON membership_seat_assignment (subscription_id, seat_no) WHERE state = 'active';
CREATE INDEX IF NOT EXISTS idx_membership_seat_assignment_subscription
    ON membership_seat_assignment (tenant_id, subscription_id, state, seat_no);
CREATE INDEX IF NOT EXISTS idx_membership_seat_assignment_user
    ON membership_seat_assignment (tenant_id, user_id, state, assigned_at DESC);

-- =============================================================================
-- 5. Membership change log: allow seat lifecycle audit actions.
-- =============================================================================
ALTER TABLE membership_change_log
    DROP CONSTRAINT IF EXISTS chk_change_log_action;
ALTER TABLE membership_change_log
    ADD CONSTRAINT chk_change_log_action CHECK (action IN (
        'activate', 'renew', 'upgrade', 'downgrade',
        'expire', 'cancel', 'grace', 'restore',
        'seat_purchase', 'seat_assign', 'seat_revoke', 'seat_policy'
    ));

COMMIT;
