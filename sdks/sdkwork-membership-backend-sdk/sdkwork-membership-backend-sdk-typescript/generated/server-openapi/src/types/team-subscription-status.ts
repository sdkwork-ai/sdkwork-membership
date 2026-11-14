/** Organization (team) subscription lifecycle status. Bare `pending` is an internal pre-order state and is not exposed by the admin read model. */
export type TeamSubscriptionStatus = 'pending_activation' | 'active' | 'grace_period' | 'expired' | 'cancelled';
