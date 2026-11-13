-- sdkwork:migration
-- id: 0004_membership_team_seats
-- engine: postgres
-- module: sdkwork-membership
-- purpose: Revert organization (team) subscription seats: drop the seat ledger, seat counters/policy, per-seat package pricing, and catalog audience.
-- reversible: true
-- rollback: down-migration
-- transactional: true
-- lock: lightweight
-- lock_timeout: 2s
-- statement_timeout: 30s

BEGIN;

DROP TABLE IF EXISTS membership_seat_assignment;

DROP INDEX IF EXISTS idx_membership_subscription_subject;

ALTER TABLE membership_subscription
    DROP CONSTRAINT IF EXISTS ck_membership_subscription_seats;
ALTER TABLE membership_subscription
    DROP CONSTRAINT IF EXISTS ck_membership_subscription_seat_policy;
ALTER TABLE membership_subscription
    DROP CONSTRAINT IF EXISTS ck_membership_subscription_subject_type;
ALTER TABLE membership_subscription
    DROP COLUMN IF EXISTS auto_assign_seat;
ALTER TABLE membership_subscription
    DROP COLUMN IF EXISTS seat_policy;
ALTER TABLE membership_subscription
    DROP COLUMN IF EXISTS seats_used;
ALTER TABLE membership_subscription
    DROP COLUMN IF EXISTS seats_purchased;

ALTER TABLE membership_change_log
    DROP CONSTRAINT IF EXISTS chk_change_log_action;
ALTER TABLE membership_change_log
    ADD CONSTRAINT chk_change_log_action CHECK (action IN (
        'activate', 'renew', 'upgrade', 'downgrade',
        'expire', 'cancel', 'grace', 'restore'
    ));

ALTER TABLE membership_package
    DROP CONSTRAINT IF EXISTS ck_membership_package_team_seat_price;
ALTER TABLE membership_package
    DROP CONSTRAINT IF EXISTS ck_membership_package_seat_points;
ALTER TABLE membership_package
    DROP CONSTRAINT IF EXISTS ck_membership_package_seat_bounds;
ALTER TABLE membership_package
    DROP CONSTRAINT IF EXISTS ck_membership_package_price_unit;
ALTER TABLE membership_package
    DROP CONSTRAINT IF EXISTS ck_membership_package_audience;
ALTER TABLE membership_package
    DROP COLUMN IF EXISTS seat_points_amount;
ALTER TABLE membership_package
    DROP COLUMN IF EXISTS seat_max;
ALTER TABLE membership_package
    DROP COLUMN IF EXISTS seat_min;
ALTER TABLE membership_package
    DROP COLUMN IF EXISTS price_unit;
ALTER TABLE membership_package
    DROP COLUMN IF EXISTS audience;

ALTER TABLE membership_package_group
    DROP CONSTRAINT IF EXISTS ck_membership_package_group_audience;
ALTER TABLE membership_package_group
    DROP COLUMN IF EXISTS audience;

DROP INDEX IF EXISTS idx_membership_plan_tenant_audience;
ALTER TABLE membership_plan
    DROP CONSTRAINT IF EXISTS ck_membership_plan_audience;
ALTER TABLE membership_plan
    DROP COLUMN IF EXISTS audience;

COMMIT;
