-- sdkwork:migration
-- id: 0005_membership_team_organization_binding
-- engine: postgres
-- module: sdkwork-membership
-- purpose: Revert the organization binding lifecycle added by the 0005 up
--   migration: drop the binding columns, the owner+binding index, the binding
--   CHECK constraints, and the team_org_bind audit action.
-- reversible: true
-- rollback: down-migration
-- transactional: true
-- lock: lightweight
-- lock_timeout: 2s
-- statement_timeout: 30s

BEGIN;

-- Audit vocabulary: restore the pre-0005 action list.
ALTER TABLE membership_change_log
    DROP CONSTRAINT IF EXISTS chk_change_log_action;
ALTER TABLE membership_change_log
    ADD CONSTRAINT chk_change_log_action CHECK (action IN (
        'activate', 'renew', 'upgrade', 'downgrade',
        'expire', 'cancel', 'grace', 'restore',
        'seat_purchase', 'seat_assign', 'seat_revoke', 'seat_policy'
    ));

DROP INDEX IF EXISTS idx_membership_subscription_owner_binding;

ALTER TABLE membership_subscription
    DROP CONSTRAINT IF EXISTS ck_membership_subscription_unbound_subject;
ALTER TABLE membership_subscription
    DROP CONSTRAINT IF EXISTS ck_membership_subscription_organization_binding_status;

ALTER TABLE membership_subscription
    DROP COLUMN IF EXISTS bound_by_user_id;
ALTER TABLE membership_subscription
    DROP COLUMN IF EXISTS bound_at;
ALTER TABLE membership_subscription
    DROP COLUMN IF EXISTS organization_binding_status;

COMMIT;
