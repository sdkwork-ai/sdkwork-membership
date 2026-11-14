-- sdkwork:migration
-- id: 0005_membership_team_organization_binding
-- engine: postgres
-- module: sdkwork-membership
-- purpose: Allow a team (organization) subscription to be purchased before an
--   organization exists. Adds the organization binding lifecycle to
--   membership_subscription (organization_binding_status bound|unbound,
--   bound_at, bound_by_user_id), an owner+binding-status lookup index, and the
--   team_org_bind audit action on membership_change_log. Existing rows are
--   backfilled as 'bound' because every pre-existing team subscription was
--   created against a real organization.
-- reversible: true
-- rollback: down-migration
-- transactional: true
-- lock: lightweight
-- lock_timeout: 2s
-- statement_timeout: 30s

BEGIN;

-- =============================================================================
-- 1. Organization binding lifecycle.
--    'unbound' means the buyer paid for team seats before choosing an
--    organization: subject_type stays 'organization', subject_id is empty,
--    organization_id is the platform scope '0', and the seat ledger stays empty
--    until POST /team/subscription/bind binds the subscription to an IAM org.
-- =============================================================================
ALTER TABLE membership_subscription
    ADD COLUMN IF NOT EXISTS organization_binding_status TEXT NOT NULL DEFAULT 'bound';
ALTER TABLE membership_subscription
    ADD COLUMN IF NOT EXISTS bound_at TIMESTAMPTZ;
ALTER TABLE membership_subscription
    ADD COLUMN IF NOT EXISTS bound_by_user_id TEXT;

ALTER TABLE membership_subscription
    DROP CONSTRAINT IF EXISTS ck_membership_subscription_organization_binding_status;
ALTER TABLE membership_subscription
    ADD CONSTRAINT ck_membership_subscription_organization_binding_status CHECK (
        organization_binding_status IN ('bound', 'unbound')
    );

-- An unbound subscription never licenses an organization subject: the empty
-- subject id is what keeps it invisible to the organization-scoped seat reads.
ALTER TABLE membership_subscription
    DROP CONSTRAINT IF EXISTS ck_membership_subscription_unbound_subject;
ALTER TABLE membership_subscription
    ADD CONSTRAINT ck_membership_subscription_unbound_subject CHECK (
        organization_binding_status = 'bound'
        OR (subject_type = 'organization' AND subject_id = '')
    );

-- Owner lookup for "this buyer's unbound team subscription" and the
-- one-active-unbound-per-owner rule.
CREATE INDEX IF NOT EXISTS idx_membership_subscription_owner_binding
    ON membership_subscription (
        tenant_id, owner_user_id, organization_binding_status, status
    );

-- =============================================================================
-- 2. Audit vocabulary: binding an unbound subscription to an organization.
-- =============================================================================
ALTER TABLE membership_change_log
    DROP CONSTRAINT IF EXISTS chk_change_log_action;
ALTER TABLE membership_change_log
    ADD CONSTRAINT chk_change_log_action CHECK (action IN (
        'activate', 'renew', 'upgrade', 'downgrade',
        'expire', 'cancel', 'grace', 'restore',
        'seat_purchase', 'seat_assign', 'seat_revoke', 'seat_policy',
        'team_org_bind'
    ));

COMMIT;
