/**
 * Pure composition of the IAM roster and the membership seat assignments.
 *
 * Membership returns membership-owned facts only (the subscription overview and
 * the seat assignment rows). The organization roster, the caller's role, and
 * the member count are IAM-owned and reach the surface through the host port.
 * This module joins both fact sets; it performs no IO so the derivation stays
 * testable and the same formulas back every caller.
 */

import type {
  SdkworkTeamMembershipKind,
  SdkworkTeamOwnMembership,
  SdkworkTeamRosterMember,
  SdkworkTeamSeatAssignment,
  SdkworkTeamSubscriptionOverview,
} from "./team-subscription-port";

/**
 * Organization id the IAM login context uses for a personal/platform session.
 *
 * The team endpoints resolve the organization from the authenticated principal
 * and reject this id with `organization_scope_required`; it is never a
 * switchable team organization.
 */
export const SDKWORK_TEAM_PLATFORM_ORGANIZATION_ID = "0";

/** Derived team facts the surface renders next to the membership overview. */
export interface SdkworkTeamSeatComposition {
  canManageSeats: boolean;
  licensedMembers: number;
  membersTotal: number;
  organizationId: string;
  organizationName?: string;
  overSeat: boolean;
  overSeatCount: number;
  unlicensedMembers: number;
  viewerRole?: SdkworkTeamMembershipKind;
}

/** One roster row joined with the caller's active seat assignment. */
export interface SdkworkTeamSeatDirectoryRow {
  assignedAt?: string;
  email?: string;
  isAssigned: boolean;
  membershipId: string;
  membershipKind: SdkworkTeamMembershipKind;
  name: string;
  seatNo?: number;
  userId: string;
  username?: string;
}

const MEMBERSHIP_KINDS: readonly SdkworkTeamMembershipKind[] = ["owner", "admin", "member"];

/** Reads a non-empty trimmed string field from an untyped generated payload. */
function readText(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function readFlag(record: Record<string, unknown>, ...keys: string[]): boolean {
  return keys.some((key) => record[key] === true);
}

/** Normalizes an IAM role spelling (`OWNER`, `owner`, `admin`, …). */
export function normalizeSdkworkTeamMembershipKind(
  value: string | undefined,
): SdkworkTeamMembershipKind | undefined {
  const normalized = value?.trim().toLowerCase();
  return MEMBERSHIP_KINDS.find((kind) => kind === normalized);
}

/** True only for the roles IAM allows to manage organization seats. */
export function canManageTeamSeats(role: SdkworkTeamMembershipKind | undefined): boolean {
  return role === "owner" || role === "admin";
}

/**
 * Parses the caller's own memberships (`iam.organizationMemberships.list`).
 *
 * IAM publishes the role as `membershipKind` on the roster and as
 * `membershipType` on the caller's own membership response, so both spellings
 * are accepted; nothing else about the generated page envelope is trusted.
 *
 * @param items - the raw own-membership rows returned by the host port.
 * @returns the normalized own memberships.
 */
export function parseOwnMemberships(
  items: readonly Record<string, unknown>[],
): SdkworkTeamOwnMembership[] {
  return items.flatMap((item) => {
    const organizationId = readText(item, "organizationId", "organization_id");
    if (!organizationId) {
      return [];
    }
    const role = normalizeSdkworkTeamMembershipKind(
      readText(item, "membershipKind", "membership_kind", "membershipType", "membership_type"),
    );
    const status = readText(item, "status");
    return [{
      isPrimary: readFlag(item, "isPrimary", "primary"),
      organizationId,
      ...(role ? { role } : {}),
      ...(status ? { status } : {}),
    }];
  });
}

/**
 * Picks the organization the team surface reads.
 *
 * The membership-reported organization comes from the authenticated principal,
 * so it is the actual session scope and wins over the caller's membership list
 * (whose primary row can be the platform organization, and whose rows do not
 * change when the session switches organizations). The own-membership list is
 * only consulted when the platform reports the personal/platform organization.
 *
 * @param memberships - the caller's own IAM organization memberships.
 * @param fallbackOrganizationId - the membership-reported organization id.
 * @returns the organization id to read the roster from.
 */
export function resolveTeamOrganizationId(
  memberships: readonly SdkworkTeamOwnMembership[],
  fallbackOrganizationId: string,
): string {
  const sessionOrganizationId = fallbackOrganizationId.trim();
  if (
    sessionOrganizationId.length > 0
    && sessionOrganizationId !== SDKWORK_TEAM_PLATFORM_ORGANIZATION_ID
  ) {
    return sessionOrganizationId;
  }
  const active = memberships.filter(
    (membership) => !membership.status || membership.status.toLowerCase() === "active",
  );
  const current = active.find((membership) => membership.isPrimary) ?? active[0];
  const organizationId = current?.organizationId.trim();
  return organizationId && organizationId.length > 0 ? organizationId : sessionOrganizationId;
}

/** Caller's role in the resolved organization, read from its own membership. */
export function resolveTeamViewerRole(
  memberships: readonly SdkworkTeamOwnMembership[],
  organizationId: string,
): SdkworkTeamMembershipKind | undefined {
  return memberships.find((membership) => membership.organizationId === organizationId)?.role;
}

/**
 * Derives the team facts the membership overview no longer carries.
 *
 * - `viewerRole` comes from the caller's own IAM membership;
 * - `canManageSeats` is `owner`/`admin` only;
 * - `membersTotal` is the IAM roster total;
 * - `licensedMembers` counts seat assignments whose user is on the roster;
 * - `unlicensedMembers = max(0, membersTotal - licensedMembers)`;
 * - `overSeat = unlicensedMembers > 0`;
 * - `overSeatCount = max(0, seatsUsed - seatsPurchased)`.
 *
 * @param input - membership-owned facts plus the derived IAM facts.
 * @returns the composition the summary and the seat directory render.
 */
export function composeTeamSeatComposition(input: {
  membersTotal: number;
  organizationId: string;
  organizationName?: string;
  overview: SdkworkTeamSubscriptionOverview;
  roster: readonly SdkworkTeamRosterMember[];
  seatAssignments: readonly SdkworkTeamSeatAssignment[];
  viewerRole?: SdkworkTeamMembershipKind;
}): SdkworkTeamSeatComposition {
  const rosterUserIds = new Set(input.roster.map((member) => member.userId));
  const licensedMembers = input.seatAssignments.filter(
    (assignment) => rosterUserIds.has(assignment.userId),
  ).length;
  const membersTotal = Math.max(0, input.membersTotal);
  const unlicensedMembers = Math.max(0, membersTotal - licensedMembers);
  const overSeatCount = Math.max(0, input.overview.seatsUsed - input.overview.seatsPurchased);
  return {
    canManageSeats: canManageTeamSeats(input.viewerRole),
    licensedMembers,
    membersTotal,
    organizationId: input.organizationId,
    ...(input.organizationName ? { organizationName: input.organizationName } : {}),
    overSeat: unlicensedMembers > 0,
    overSeatCount,
    unlicensedMembers,
    ...(input.viewerRole ? { viewerRole: input.viewerRole } : {}),
  };
}

/**
 * Re-derives the seat-overflow facts after a seat policy / overview update.
 *
 * @param composition - the current composition.
 * @param overview - the overview the policy endpoint returned.
 * @returns the composition with refreshed overflow facts.
 */
export function applyOverviewToComposition(
  composition: SdkworkTeamSeatComposition,
  overview: SdkworkTeamSubscriptionOverview,
): SdkworkTeamSeatComposition {
  const overSeatCount = Math.max(0, overview.seatsUsed - overview.seatsPurchased);
  return {
    ...composition,
    overSeat: composition.unlicensedMembers > 0,
    overSeatCount,
  };
}

/** Human label for a roster row: display name, username, email, then user id. */
export function teamRosterDisplayName(member: {
  displayName?: string;
  email?: string;
  userId: string;
  username?: string;
}): string {
  const displayName = member.displayName?.trim();
  if (displayName) {
    return displayName;
  }
  const username = member.username?.trim();
  if (username) {
    return username;
  }
  const email = member.email?.trim();
  return email ?? member.userId;
}

/**
 * Joins the IAM roster page with the membership seat map by user id so an
 * unassigned member still renders (with an Assign action) and an assigned
 * member renders its seat number.
 *
 * @param roster - the current IAM roster page.
 * @param seatAssignments - the membership-owned seat rows.
 * @returns one directory row per roster member.
 */
export function joinTeamSeatDirectory(
  roster: readonly SdkworkTeamRosterMember[],
  seatAssignments: readonly SdkworkTeamSeatAssignment[],
): SdkworkTeamSeatDirectoryRow[] {
  const seatByUserId = new Map(
    seatAssignments.map((assignment) => [assignment.userId, assignment] as const),
  );
  return roster.map((member) => {
    const assignment = seatByUserId.get(member.userId);
    return {
      ...(assignment?.assignedAt ? { assignedAt: assignment.assignedAt } : {}),
      ...(member.email ? { email: member.email } : {}),
      isAssigned: assignment !== undefined,
      membershipId: member.membershipId,
      membershipKind: normalizeSdkworkTeamMembershipKind(member.membershipKind) ?? "member",
      name: teamRosterDisplayName(member),
      ...(assignment ? { seatNo: assignment.seatNo } : {}),
      userId: member.userId,
      ...(member.username ? { username: member.username } : {}),
    };
  });
}
