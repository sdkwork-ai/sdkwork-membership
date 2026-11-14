/** Bind command for the caller's unbound team subscription. The caller must hold the IAM `TEAM_SEAT_MANAGE` capability in the target organization, and the organization may license only one team subscription: a second one answers `409 team_organization_already_subscribed`. */
export interface TeamOrganizationBindCommand {
  /** IAM organization id the unbound team subscription is bound to. */
  organizationId: string;
}
