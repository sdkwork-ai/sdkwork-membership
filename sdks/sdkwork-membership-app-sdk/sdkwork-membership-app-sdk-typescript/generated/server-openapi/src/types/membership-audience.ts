/** Catalog audience. `personal` plans serve a single user; `team` plans serve an organization with licensed seats. The catalog reads default to `personal` so the personal token-plan surface keeps its exact behaviour. */
export type MembershipAudience = 'personal' | 'team';
