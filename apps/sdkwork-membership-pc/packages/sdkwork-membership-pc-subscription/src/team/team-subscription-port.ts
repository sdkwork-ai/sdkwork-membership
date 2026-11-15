/**
 * Host-injected organization (team) subscription port and the shared view
 * models the team surface renders.
 *
 * This module owns no transport and imports no SDK: every membership-, IAM-,
 * and order-owned fact reaches the surface through
 * {@link SdkworkTeamSubscriptionPort}. A host implements the port with its own
 * generated SDK clients, so both the Cloud Router console and the BirdCoder
 * desktop render one team surface instead of duplicating it per app.
 *
 * Ownership split expressed by the port:
 *
 * - membership owns the subscription overview and the seat assignment rows;
 * - IAM owns the organization roster, the caller's role, and the organization
 *   name;
 * - the order service owns the checkout that pays for team seats.
 */

import {
  composeTeamSeatComposition,
  SDKWORK_TEAM_PLATFORM_ORGANIZATION_ID,
  resolveTeamOrganizationId,
  resolveTeamViewerRole,
  type SdkworkTeamSeatComposition,
} from "./team-roster-composition";

export { SDKWORK_TEAM_PLATFORM_ORGANIZATION_ID } from "./team-roster-composition";

/** Over-seat policy accepted by the membership seat policy endpoint. */
export type SdkworkTeamSeatPolicy = "strict" | "flex_overflow";

/** IAM organization role vocabulary shared by the roster and own memberships. */
export type SdkworkTeamMembershipKind = "owner" | "admin" | "member";

/**
 * Organization binding lifecycle of a team subscription.
 *
 * - `bound`: the subscription licenses a real IAM organization;
 * - `unbound`: the buyer paid for team seats before choosing an organization.
 *   Seats cannot be assigned until one is bound, and the buyer is the only
 *   person who can bind it.
 */
export type SdkworkTeamOrganizationBindingStatus = "bound" | "unbound";

/** Organization (team) subscription overview (`GET /memberships/team/subscription`). */
export interface SdkworkTeamSubscriptionOverview {
  /**
   * IAM organization id resolved from the authenticated principal.
   *
   * Empty when the answer is the caller's unbound team subscription: the
   * subscription exists but no organization was chosen yet.
   */
  readonly organizationId: string;
  /**
   * Organization binding lifecycle of the reported subscription.
   *
   * Absent when the caller has no team subscription at all. `organizationId`
   * being empty together with `organizationBindingStatus === "unbound"` is the
   * "buy first, bind later" state the surface renders.
   */
  readonly organizationBindingStatus?: SdkworkTeamOrganizationBindingStatus;
  /** `false` is a normal answer for an organization without an active plan. */
  readonly hasSubscription: boolean;
  readonly subscriptionId?: string;
  /** Catalog plan id as served by the membership plan endpoint. */
  readonly planId?: string;
  readonly planName?: string;
  readonly planRank?: string;
  readonly status?: string;
  readonly startsAt?: string;
  readonly expiresAt?: string;
  readonly seatsPurchased: number;
  readonly seatsUsed: number;
  readonly seatsAvailable: number;
  readonly seatPolicy: SdkworkTeamSeatPolicy;
  readonly autoAssignSeat: boolean;
}

/** One active seat assignment (`GET /memberships/team/seats`). */
export interface SdkworkTeamSeatAssignment {
  /** IAM user id the seat is assigned to. */
  readonly userId: string;
  /** IAM membership row id snapshotted at assignment time. */
  readonly membershipId?: string;
  readonly seatNo: number;
  readonly assignedAt?: string;
}

/** Result of assigning a seat (`POST /memberships/team/seats`). */
export interface SdkworkTeamSeatAssignmentResult {
  readonly userId: string;
  readonly membershipId?: string;
  readonly seatNo: number;
  readonly assignedAt?: string;
}

/** Result of one member-removal seat reconciliation sweep. */
export interface SdkworkTeamSeatReconciliationResult {
  /** Seats revoked because their user left the organization; 0 when idempotent. */
  readonly revokedCount: number;
  readonly seatsUsed: number;
  readonly seatsPurchased: number;
}

/** Organization (team) catalog package (`GET /memberships/packages?audience=team`). */
export interface SdkworkTeamPackage {
  /** Catalog package id carried as an int64 decimal string. */
  readonly id: string;
  /**
   * Catalog package group this package belongs to, as served by
   * {@link SdkworkTeamPackageGroup.id}.
   *
   * The billing-cycle tabs select the package of the chosen group through this
   * id, so a host never has to infer the cycle from `recurrenceCycle`.
   */
  readonly packageGroupId?: string;
  readonly name: string;
  readonly planId: string;
  readonly planName?: string;
  readonly planRank: string;
  readonly recurrenceCycle?: string | null;
  readonly price: string;
  readonly originalPrice?: string;
  /** Minimum purchasable seat count for this plan. */
  readonly seatMin: string;
  /** Maximum purchasable seat count for this plan. */
  readonly seatMax: string;
  /** Membership points every assigned seat receives per billing period. */
  readonly seatPointsAmount: string;
  readonly recommended: boolean;
  readonly sortWeight: string;
}

/**
 * One billing-cycle group of organization (team) packages
 * (`GET /memberships/package_groups?audience=team`).
 *
 * The team plan cards render one cycle tab per group, in the order the
 * membership catalog returns them (annual, monthly, quarterly, single month),
 * and label it with `name` plus `description` — the same contract the personal
 * catalog renders (`连续包年 9.7折`).
 */
export interface SdkworkTeamPackageGroup {
  /** Catalog group id carried as an int64 decimal string. */
  readonly id: string;
  readonly name: string;
  /** Discount / billing description shown next to the group name. */
  readonly description?: string;
  /** Group billing cycle (`once` | `day` | `week` | `month` | `quarter` | `year`). */
  readonly billingCycle?: string | null;
  /** Billing duration in days for this group, as a decimal string. */
  readonly durationDays?: string;
  /** Packages that belong to this group. */
  readonly packages: readonly SdkworkTeamPackage[];
}

/** One organization roster row as IAM publishes it. */
export interface SdkworkTeamRosterMember {
  readonly userId: string;
  readonly membershipId: string;
  readonly membershipKind: SdkworkTeamMembershipKind;
  readonly displayName?: string;
  readonly username?: string;
  readonly email?: string;
}

/** Normalized IAM roster page, with numeric totals for the surface. */
export interface SdkworkTeamRosterPage {
  readonly hasMore: boolean;
  readonly items: readonly SdkworkTeamRosterMember[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

/** One paged roster read: the seat directory page or the totals walk. */
export interface SdkworkTeamRosterQuery {
  readonly organizationId: string;
  readonly page: number;
  readonly pageSize: number;
  /** Free-text member search (`q`). */
  readonly q?: string;
}

/** Caller's own IAM organization membership (one per organization). */
export interface SdkworkTeamOwnMembership {
  readonly isPrimary: boolean;
  readonly organizationId: string;
  readonly role?: SdkworkTeamMembershipKind;
  readonly status?: string;
}

/**
 * Membership lifecycle action a team checkout can start.
 *
 * `add_seats` buys additional seats for the organization's existing active team
 * subscription: it never extends the period (`renew` does that) and never
 * creates a second subscription.
 */
export type SdkworkTeamCheckoutAction = "purchase" | "add_seats";

/** One team checkout start request. */
export interface SdkworkTeamCheckoutInput {
  readonly action: SdkworkTeamCheckoutAction;
  /** Catalog package id as served by the team package list (int64 string). */
  readonly packageId: string;
  /**
   * Seat count sent as the order `quantity`.
   *
   * `purchase` sends the total seat count; `add_seats` sends the number of
   * seats to ADD to the current subscription.
   */
  readonly seats: number;
}

/** Payment state the team checkout dialog polls and presents. */
export interface SdkworkTeamCheckoutPayment {
  readonly status: "completed" | "failed" | "pending";
  readonly orderId?: string;
  /** Payment QR payload, data URL, or provider cashier URL. */
  readonly qrCode?: string;
  readonly cashierUrl?: string;
  readonly amountCny?: number | null;
  readonly expiresAt?: string;
}

/** Seat policy patch accepted by the port. */
export interface SdkworkTeamSeatPolicyInput {
  readonly autoAssignSeat: boolean;
  readonly seatPolicy: SdkworkTeamSeatPolicy;
}

/**
 * Everything the team surface needs from its host.
 *
 * Methods throw {@link SdkworkTeamSubscriptionError} so the surface can render
 * one localized message per machine-readable failure reason. Hosts normalize
 * their SDK errors with {@link normalizeSdkworkTeamError} — the shared package
 * reads `ProblemDetail.reason`/`ProblemDetail.code` and never inspects a
 * transport-specific envelope itself.
 */
export interface SdkworkTeamSubscriptionPort {
  /** Current organization team subscription overview. */
  getOverview(): Promise<SdkworkTeamSubscriptionOverview>;
  /** Active seat assignments, paged internally up to `seatLimit` rows. */
  listSeatAssignments(seatLimit: number): Promise<readonly SdkworkTeamSeatAssignment[]>;
  /** One page of the IAM-owned organization roster, searched with `q`. */
  listRosterPage(query: SdkworkTeamRosterQuery): Promise<SdkworkTeamRosterPage>;
  /** The caller's own IAM organization memberships (authoritative org + role). */
  listOwnMemberships(): Promise<readonly SdkworkTeamOwnMembership[]>;
  /** Every active organization (team) token package in the catalog. */
  listPackages(): Promise<readonly SdkworkTeamPackage[]>;
  /**
   * Every active organization (team) billing-cycle group, with its packages.
   *
   * The groups drive the four cycle tabs of the team plan cards (continuous
   * annual / monthly / quarterly and the single-month purchase). A host that
   * cannot read the group endpoint returns an empty list; the cards then fall
   * back to grouping packages by `recurrenceCycle`.
   */
  listPackageGroups(): Promise<readonly SdkworkTeamPackageGroup[]>;
  /**
   * Display name of the organization, when the caller may read it.
   *
   * Both IAM reads behind this are permission-gated, so a host resolves
   * `undefined` instead of failing and the surface falls back to the org id.
   */
  loadOrganizationName(organizationId: string): Promise<string | undefined>;
  /** Assigns the lowest free seat to an active organization member. */
  assignSeat(userId: string): Promise<SdkworkTeamSeatAssignmentResult>;
  /** Revokes an organization member's active seat. */
  revokeSeat(userId: string): Promise<void>;
  /** Updates the over-seat policy and returns the refreshed overview. */
  updateSeatPolicy(input: SdkworkTeamSeatPolicyInput): Promise<SdkworkTeamSubscriptionOverview>;
  /** Reconciles the seat ledger with the IAM-owned roster. */
  reconcileSeats(): Promise<SdkworkTeamSeatReconciliationResult>;
  /**
   * Binds the caller's unbound team subscription to an organization.
   *
   * This is the second half of the "buy first, bind later" rule: the buyer paid
   * for team seats without an organization, and this call turns that purchase
   * into that organization's team subscription. The caller must be an active
   * member of the organization allowed to manage team seats; the organization
   * may license only one team subscription at a time. Binding is idempotent for
   * a subscription already bound to the same organization.
   *
   * @param organizationId - IAM organization id to bind the subscription to.
   * @returns the bound team subscription overview.
   */
  bindOrganization(organizationId: string): Promise<SdkworkTeamSubscriptionOverview>;
  /** Starts the order-owned membership checkout for a team plan. */
  startCheckout(input: SdkworkTeamCheckoutInput): Promise<SdkworkTeamCheckoutPayment>;
  /** Polls one team checkout order through the same order-owned service. */
  getCheckoutStatus(orderId: string): Promise<SdkworkTeamCheckoutPayment>;
  /**
   * Switches the authenticated session to another organization.
   *
   * Team endpoints resolve the organization from the authenticated principal, so
   * a personal/platform-scoped session answers `organization_scope_required`
   * until the session itself is organization-scoped. Hosts implement this with
   * the IAM app SDK's organization selection followed by their own session
   * refresh; a host whose platform requires a fresh sign-in for the selection
   * rejects with `organization_sign_in_required` instead of clearing the
   * session.
   */
  switchOrganization(organizationId: string): Promise<void>;
}

/**
 * Reasons the membership app API attaches as `ProblemDetail.reason` for team
 * seat failures, plus the two client-side classifications the surface adds.
 */
export const SDKWORK_TEAM_ERROR_REASONS = [
  "seat_capacity_exceeded",
  "seat_already_assigned",
  "not_organization_member",
  "seat_management_forbidden",
  "team_subscription_inactive",
  "last_seat_owner_required",
  "seat_assignment_not_found",
  "organization_scope_required",
  "team_subscription_unbound",
  "team_subscription_already_unbound",
  "team_subscription_not_found",
  "team_organization_already_subscribed",
] as const;

/** Machine-readable reason for a team seat/subscription failure. */
export type SdkworkTeamErrorReason =
  | (typeof SDKWORK_TEAM_ERROR_REASONS)[number]
  /** The platform requires a fresh sign-in that selects this organization. */
  | "organization_sign_in_required"
  | "unauthenticated"
  | "unknown";

/**
 * Normalized team surface failure; components map `reason` to localized copy.
 */
export class SdkworkTeamSubscriptionError extends Error {
  readonly reason: SdkworkTeamErrorReason;
  readonly httpStatus: number | undefined;

  constructor(
    reason: SdkworkTeamErrorReason,
    message: string,
    httpStatus?: number,
  ) {
    super(message);
    this.name = "SdkworkTeamSubscriptionError";
    this.reason = reason;
    this.httpStatus = httpStatus;
  }
}

interface TeamProblemRecord {
  code?: number | string;
  detail?: string;
  reason?: unknown;
  status?: number;
}

const UNAUTHORIZED_PLATFORM_CODE = 40101;

function readProblemRecord(error: unknown): TeamProblemRecord | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  const candidate = (error as { problem?: unknown }).problem;
  return candidate && typeof candidate === "object" ? (candidate as TeamProblemRecord) : undefined;
}

function readHttpStatus(
  error: unknown,
  problem: TeamProblemRecord | undefined,
): number | undefined {
  const direct = error && typeof error === "object"
    ? (error as { httpStatus?: unknown }).httpStatus
    : undefined;
  if (typeof direct === "number" && Number.isFinite(direct)) {
    return direct;
  }
  if (typeof problem?.status === "number" && Number.isFinite(problem.status)) {
    return problem.status;
  }
  if (problem?.code === UNAUTHORIZED_PLATFORM_CODE) {
    return 401;
  }
  return undefined;
}

function readErrorMessage(error: unknown, problem: TeamProblemRecord | undefined): string {
  const detail = typeof problem?.detail === "string" ? problem.detail.trim() : "";
  if (detail.length > 0) {
    return detail;
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return "Team subscription request failed.";
}

function readReason(problem: TeamProblemRecord | undefined): string {
  return typeof problem?.reason === "string" ? problem.reason.trim() : "";
}

/**
 * Normalizes any thrown value into a typed team surface failure.
 *
 * A host wraps its SDK call and rethrows this value; the reason vocabulary is
 * the one the membership app API actually sends, never an invented client code.
 *
 * @param error - the value thrown by the host port implementation.
 * @returns the typed failure the surface renders.
 */
export function normalizeSdkworkTeamError(error: unknown): SdkworkTeamSubscriptionError {
  if (error instanceof SdkworkTeamSubscriptionError) {
    return error;
  }
  const problem = readProblemRecord(error);
  const httpStatus = readHttpStatus(error, problem);
  const message = readErrorMessage(error, problem);
  if (httpStatus === 401) {
    return new SdkworkTeamSubscriptionError("unauthenticated", message, httpStatus);
  }
  const rawReason = readReason(problem);
  const known = SDKWORK_TEAM_ERROR_REASONS.find((reason) => reason === rawReason);
  return new SdkworkTeamSubscriptionError(known ?? "unknown", message, httpStatus);
}

/**
 * Reads the numeric checkout package id from the catalog's int64 string.
 *
 * The order checkout contract takes a number, so the string is accepted only
 * when it round-trips exactly; a precision-truncated package id can never be
 * sent to the payment service.
 *
 * @param packageId - catalog package id as served by the membership catalog.
 * @returns the numeric package id accepted by the order checkout.
 */
export function readSdkworkTeamPackageNumericId(packageId: string): number {
  const normalized = packageId.trim();
  const numeric = Number(normalized);
  if (
    normalized.length === 0
    || !/^\d+$/.test(normalized)
    || !Number.isSafeInteger(numeric)
    || numeric <= 0
    || String(numeric) !== normalized
  ) {
    throw new SdkworkTeamSubscriptionError(
      "unknown",
      `Team subscription package id is not a valid catalog id: ${packageId}`,
    );
  }
  return numeric;
}

/**
 * Everything the team page renders: membership facts plus derived IAM facts.
 */
export interface SdkworkTeamSnapshot {
  readonly composition: SdkworkTeamSeatComposition;
  readonly overview: SdkworkTeamSubscriptionOverview;
  readonly seatAssignments: readonly SdkworkTeamSeatAssignment[];
}

/** One organization the signed-in account may switch the team surface to. */
export interface SdkworkTeamOrganizationChoice {
  readonly organizationId: string;
  /** Display name when the host resolved one; the id is the fallback label. */
  readonly organizationName?: string;
  readonly role?: SdkworkTeamMembershipKind;
  /** Whether the active session already runs in this organization. */
  readonly isCurrent: boolean;
}

const TEAM_ROLE_RANK: Record<SdkworkTeamMembershipKind, number> = {
  admin: 2,
  member: 1,
  owner: 3,
};

/**
 * Reduces the caller's own IAM memberships to the switchable team organizations.
 *
 * The platform organization is not a team scope, so it is dropped; a person can
 * hold several rows in one organization (the uniqueness key includes the kind),
 * so the highest privilege wins and each organization appears once.
 *
 * @param memberships - the caller's own IAM organization memberships.
 * @param currentOrganizationId - the organization the active session runs in.
 * @returns the switchable organizations, current one marked.
 */
export function resolveTeamOrganizationChoices(
  memberships: readonly SdkworkTeamOwnMembership[],
  currentOrganizationId: string | undefined,
): SdkworkTeamOrganizationChoice[] {
  const byOrganization = new Map<string, SdkworkTeamOwnMembership>();
  for (const membership of memberships) {
    const organizationId = membership.organizationId.trim();
    if (organizationId.length === 0 || organizationId === SDKWORK_TEAM_PLATFORM_ORGANIZATION_ID) {
      continue;
    }
    if (membership.status && membership.status.toLowerCase() !== "active") {
      continue;
    }
    const existing = byOrganization.get(organizationId);
    const existingRank = existing?.role ? TEAM_ROLE_RANK[existing.role] : 0;
    const candidateRank = membership.role ? TEAM_ROLE_RANK[membership.role] : 0;
    if (existing === undefined || candidateRank > existingRank) {
      byOrganization.set(organizationId, membership);
    }
  }
  return [...byOrganization.values()].map((membership) => ({
    organizationId: membership.organizationId.trim(),
    ...(membership.role ? { role: membership.role } : {}),
    isCurrent: membership.organizationId.trim() === currentOrganizationId,
  }));
}

/** Paged seat assignments are read in 100-row pages, bounded to 20 pages. */
const TEAM_SEAT_PAGE_SIZE = 100;
const TEAM_SEAT_MAX_PAGES = 20;

/** IAM caps an organization roster page at 200 rows. */
const TEAM_ROSTER_PAGE_SIZE = 200;
/** Bounded roster walk for the derived member totals (200 x 10 = 2000 members). */
const TEAM_ROSTER_MAX_PAGES = 10;

/**
 * Walks the IAM organization roster for the derived member totals.
 *
 * @param port - the host port owning the roster read.
 * @param organizationId - IAM organization id the roster is read from.
 * @returns every roster row the bounded walk reached, plus its total.
 */
export async function loadSdkworkTeamRoster(
  port: SdkworkTeamSubscriptionPort,
  organizationId: string,
): Promise<{ items: SdkworkTeamRosterMember[]; total: number }> {
  const items: SdkworkTeamRosterMember[] = [];
  let total = 0;
  for (let page = 1; page <= TEAM_ROSTER_MAX_PAGES; page += 1) {
    const result = await port.listRosterPage({
      organizationId,
      page,
      pageSize: TEAM_ROSTER_PAGE_SIZE,
    });
    items.push(...result.items);
    total = Math.max(total, result.total);
    if (!result.hasMore) {
      break;
    }
  }
  return { items, total: total > 0 ? total : items.length };
}

/** Reads the bounded seat assignment page walk through the host port. */
function readTeamSeatLimit(overview: SdkworkTeamSubscriptionOverview): number {
  return Math.max(1, overview.seatsPurchased, overview.seatsUsed);
}

/**
 * True when the overview describes a team subscription that is not bound to an
 * organization yet ("buy first, bind later").
 *
 * The seat ledger and the organization roster are organization-scoped, so the
 * unbound state has neither: the surface renders the bind step instead of the
 * seat directory.
 *
 * @param overview - the membership-owned overview.
 * @returns `true` for an unbound team subscription.
 */
export function isSdkworkTeamSubscriptionUnbound(
  overview: SdkworkTeamSubscriptionOverview,
): boolean {
  return overview.organizationBindingStatus === "unbound";
}

/**
 * True when the overview is scoped to a real IAM team organization.
 *
 * A platform/personal session (empty organization id or the platform
 * organization `0`) has no organization-scoped facts to read, so the surface
 * must not walk the roster or page a seat ledger for it.
 *
 * @param overview - the membership-owned overview.
 * @returns `true` when the organization roster and seat reads make sense.
 */
export function hasSdkworkTeamOrganizationScope(
  overview: SdkworkTeamSubscriptionOverview,
): boolean {
  const organizationId = overview.organizationId.trim();
  return (
    organizationId.length > 0
    && organizationId !== SDKWORK_TEAM_PLATFORM_ORGANIZATION_ID
    && !isSdkworkTeamSubscriptionUnbound(overview)
  );
}

/**
 * Loads the complete team surface state in two parallel stages.
 *
 * Stage one fetches the membership overview, the membership seat assignments,
 * and the caller's own IAM membership at the same time. Stage two runs once the
 * organization id (authoritative from IAM) and the purchased seat bound are
 * known, and fetches the IAM roster walk and the organization name in parallel.
 *
 * An unbound subscription (bought without an organization) skips both
 * organization-scoped stages: there is no organization to read a roster, a seat
 * ledger, or a name from, and the surface renders the bind step instead.
 *
 * @param port - the host port owning every read.
 * @param preloadedMemberships - own memberships the surface already fetched for
 * the organization selector, so the snapshot does not read them twice.
 * @returns the composed view state the surface renders.
 */
export async function loadSdkworkTeamSnapshot(
  port: SdkworkTeamSubscriptionPort,
  preloadedMemberships?: readonly SdkworkTeamOwnMembership[],
): Promise<SdkworkTeamSnapshot> {
  const overview = await port.getOverview();
  const [ownMemberships, allSeatAssignments] = await Promise.all([
    preloadedMemberships === undefined
      ? port.listOwnMemberships()
      : Promise.resolve(preloadedMemberships),
    port.listSeatAssignments(TEAM_SEAT_PAGE_SIZE * TEAM_SEAT_MAX_PAGES).catch((error: unknown) => {
      // A session without an organization scope has no seat ledger yet: the
      // no-org and unbound states are normal answers, so an empty seat list is
      // expected there instead of failing the whole surface.
      if (!hasSdkworkTeamOrganizationScope(overview)) {
        return [] as SdkworkTeamSeatAssignment[];
      }
      throw error;
    }),
  ]);

  if (!hasSdkworkTeamOrganizationScope(overview)) {
    // No organization scope (platform session, or a subscription bought before
    // an organization exists): there is no roster, no seat directory, and no
    // organization name to read. The surface renders the plan cards or the bind
    // step from the membership facts alone.
    const organizationId = overview.organizationId.trim();
    const composition = composeTeamSeatComposition({
      membersTotal: 0,
      organizationId,
      overview,
      roster: [],
      seatAssignments: allSeatAssignments,
      viewerRole: resolveTeamViewerRole(ownMemberships, organizationId),
    });
    return { composition, overview, seatAssignments: allSeatAssignments };
  }

  const organizationId = resolveTeamOrganizationId(
    ownMemberships,
    overview.organizationId,
  );
  const seatLimit = readTeamSeatLimit(overview);
  const seatAssignments = allSeatAssignments.slice(0, seatLimit);
  const [roster, organizationName] = await Promise.all([
    loadSdkworkTeamRoster(port, organizationId),
    port.loadOrganizationName(organizationId),
  ]);

  const composition = composeTeamSeatComposition({
    membersTotal: roster.total,
    organizationId,
    ...(organizationName ? { organizationName } : {}),
    overview,
    roster: roster.items,
    seatAssignments,
    viewerRole: resolveTeamViewerRole(ownMemberships, organizationId),
  });

  return { composition, overview, seatAssignments };
}
