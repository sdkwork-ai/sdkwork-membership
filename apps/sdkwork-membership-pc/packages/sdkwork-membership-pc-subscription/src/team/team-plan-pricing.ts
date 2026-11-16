/**
 * Pure seat/pricing helpers for the organization (team) subscription surface.
 *
 * These helpers are intentionally free of React, SDK, and browser APIs so the
 * seat-stepper math and the monthly/annual selection can be unit tested
 * directly. The team components own all rendering; the host port owns all data
 * access.
 */

/** Billing recurrence the team plan cards can present. */
export type SdkworkTeamBillingCycle = "month" | "once" | "quarter" | "year";

/**
 * Tab order of the four team billing options, mirroring the personal catalog:
 * continuous annual, continuous monthly, continuous quarterly, single month.
 */
export const TEAM_BILLING_CYCLE_ORDER: readonly SdkworkTeamBillingCycle[] = [
  "year",
  "month",
  "quarter",
  "once",
];

/**
 * The subset of an organization (team) package these helpers need.
 *
 * The membership app SDK's `AppMembershipPackageItem` is structurally
 * assignable to it, so the team surface never has to copy the package model.
 */
export interface SdkworkTeamPlanPackageLike {
  id: string;
  name: string;
  planId: string;
  planName?: string;
  planRank: string;
  /** Catalog group this package belongs to (`SdkworkTeamPackageGroup.id`). */
  packageGroupId?: string;
  recurrenceCycle?: string | null;
  price: string;
  originalPrice?: string;
  seatMin: string;
  seatMax: string;
  seatPointsAmount: string;
  recommended: boolean;
  sortWeight: string;
}

/** One purchasable plan in the team catalog, with every cycle variant. */
export interface SdkworkTeamPlanGroup<T extends SdkworkTeamPlanPackageLike = SdkworkTeamPlanPackageLike> {
  packages: T[];
  planId: string;
  planName: string;
  planRank: number;
  recommended: boolean;
  sortWeight: number;
}

/**
 * One billing-cycle tab of the team plan cards.
 *
 * A tab is either backed by a membership catalog package group (the normal
 * case: annual / monthly / quarterly / single month) or derived from the
 * packages' `recurrenceCycle` when the host cannot read the group endpoint.
 */
export interface SdkworkTeamCycleOption<T extends SdkworkTeamPlanPackageLike = SdkworkTeamPlanPackageLike> {
  /** Stable React key: the package group id, or the recurrence cycle. */
  key: string;
  /** Tab label: the package group name. */
  label: string;
  /** Discount description rendered next to the label (`9.7折`). */
  description?: string;
  /** Package group id this tab selects packages through; absent in fallback mode. */
  groupId?: string;
  /** Billing cycle of the tab, `null` when neither the group nor its packages name one. */
  billingCycle: SdkworkTeamBillingCycle | null;
  /** Billing duration in days of the group, when the catalog publishes one. */
  durationDays?: number;
  /** Packages that belong to this tab. */
  packages: readonly T[];
}

/** The subset of an organization (team) package group these helpers need. */
export interface SdkworkTeamCycleGroupLike<T extends SdkworkTeamPlanPackageLike = SdkworkTeamPlanPackageLike> {
  id: string;
  name: string;
  description?: string;
  billingCycle?: string | null;
  durationDays?: string;
  packages: readonly T[];
}

/** Inclusive seat purchase bounds for one package. */
export interface SdkworkTeamSeatBounds {
  max: number;
  min: number;
}

const FALLBACK_SEAT_MIN = 1;

/**
 * Floor for the "seats to add" stepper when expanding an existing team
 * subscription. `add_seats` quantity is the number of seats ADDED, so the
 * smallest meaningful value is one seat — never the current seat total.
 */
const ADDITIONAL_SEAT_MIN = 1;

/** Default number of seats to add when the buyer has not touched the stepper. */
const ADDITIONAL_SEAT_DEFAULT = 5;

function toFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function toPositiveInteger(value: unknown, fallback: number): number {
  const parsed = toFiniteNumber(value, fallback);
  const integer = Math.trunc(parsed);
  return integer > 0 ? integer : fallback;
}

/** Normalizes a package `recurrenceCycle` into a card billing cycle. */
export function toTeamBillingCycle(value: string | null | undefined): SdkworkTeamBillingCycle | null {
  return value === "month" || value === "year" || value === "quarter" || value === "once"
    ? value
    : null;
}

/** Reads the inclusive seat bounds, self-healing a backend `max < min` pair. */
export function resolveTeamSeatBounds(
  pkg: Pick<SdkworkTeamPlanPackageLike, "seatMax" | "seatMin"> | null | undefined,
): SdkworkTeamSeatBounds {
  const min = Math.max(FALLBACK_SEAT_MIN, toPositiveInteger(pkg?.seatMin, FALLBACK_SEAT_MIN));
  const max = Math.max(min, toPositiveInteger(pkg?.seatMax, min));
  return { max, min };
}

/** Clamps a requested seat count into `[min, max]` as a whole number. */
export function clampTeamSeatCount(seats: number, bounds: SdkworkTeamSeatBounds): number {
  if (!Number.isFinite(seats)) {
    return bounds.min;
  }
  const integer = Math.trunc(seats);
  if (integer <= bounds.min) {
    return bounds.min;
  }
  if (integer >= bounds.max) {
    return bounds.max;
  }
  return integer;
}

/**
 * Default seat count for a plan card: the plan minimum, raised to the current
 * purchased seat count when the surface expands an existing subscription.
 */
export function resolveDefaultTeamSeatCount(
  bounds: SdkworkTeamSeatBounds,
  seatsPurchased: number,
): number {
  const target = Number.isFinite(seatsPurchased) ? Math.trunc(seatsPurchased) : bounds.min;
  return clampTeamSeatCount(Math.max(bounds.min, target), bounds);
}

/**
 * Stepper bounds when buying MORE seats for an existing subscription.
 *
 * `add_seats` sends the number of seats to ADD, so the floor stays at one seat
 * (adding a single seat is always meaningful) while the ceiling remains the
 * package's seat maximum.
 */
export function resolveAdditionalSeatBounds(
  bounds: SdkworkTeamSeatBounds,
): SdkworkTeamSeatBounds {
  return {
    max: Math.max(ADDITIONAL_SEAT_MIN, bounds.max),
    min: ADDITIONAL_SEAT_MIN,
  };
}

/**
 * Default number of seats to ADD when expanding a subscription: five seats, or
 * the plan minimum when that is larger — never the current seat total.
 */
export function resolveDefaultAdditionalSeatCount(bounds: SdkworkTeamSeatBounds): number {
  const additional = resolveAdditionalSeatBounds(bounds);
  return clampTeamSeatCount(Math.max(ADDITIONAL_SEAT_DEFAULT, bounds.min), additional);
}

/** Parses the stepper input, falling back to the plan minimum. */
export function parseTeamSeatInput(text: string, bounds: SdkworkTeamSeatBounds): number {
  const digits = text.replaceAll(/[^0-9]/g, "");
  if (digits.length === 0) {
    return bounds.min;
  }
  return toPositiveInteger(digits, bounds.min);
}

/** `total = unitPrice × seats`, rounded to currency precision. */
export function computeTeamSeatTotal(unitPrice: string | number, seats: number): number {
  const price = toFiniteNumber(unitPrice, 0);
  if (price <= 0 || !Number.isFinite(seats) || seats <= 0) {
    return 0;
  }
  return Math.round(price * seats * 100) / 100;
}

/** Formats a CNY amount as `¥{total}` with thousands separators. */
export function formatTeamCnyAmount(amount: number): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const fractionDigits = Number.isInteger(safeAmount) ? 0 : 2;
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: fractionDigits,
  }).format(safeAmount);
  return `¥${formatted}`;
}

/** Groups team packages by plan, sorted by `planRank`. */
export function groupTeamPlanPackages<T extends SdkworkTeamPlanPackageLike>(
  packages: readonly T[],
): SdkworkTeamPlanGroup<T>[] {
  const groups = new Map<string, SdkworkTeamPlanGroup<T>>();

  for (const pkg of packages) {
    const planKey = pkg.planId.trim() || pkg.id;
    const existing = groups.get(planKey);
    const group: SdkworkTeamPlanGroup<T> = existing ?? {
      packages: [],
      planId: planKey,
      planName: pkg.planName?.trim() || pkg.name,
      planRank: toFiniteNumber(pkg.planRank, Number.MAX_SAFE_INTEGER),
      recommended: false,
      sortWeight: toFiniteNumber(pkg.sortWeight, 0),
    };

    group.packages.push(pkg);
    group.recommended = group.recommended || Boolean(pkg.recommended);
    groups.set(planKey, group);
  }

  return [...groups.values()].sort(
    (left, right) =>
      left.planRank - right.planRank
      || left.sortWeight - right.sortWeight
      || left.planName.localeCompare(right.planName),
  );
}

/**
 * Names the recurrence a package was grouped under when the host serves no
 * package groups.
 *
 * The cards still render four tabs in that fallback, so the label has to come
 * from copy rather than from a catalog row; the caller supplies the lookup.
 */
export type SdkworkTeamCycleFallbackLabel = (cycle: SdkworkTeamBillingCycle) => string;

function cycleSortIndex(cycle: SdkworkTeamBillingCycle | null): number {
  if (cycle === null) {
    return TEAM_BILLING_CYCLE_ORDER.length;
  }
  const index = TEAM_BILLING_CYCLE_ORDER.indexOf(cycle);
  return index < 0 ? TEAM_BILLING_CYCLE_ORDER.length : index;
}

/**
 * Builds the billing-cycle tabs of the team plan cards.
 *
 * The membership catalog publishes the four billing options as package groups
 * (continuous annual / monthly / quarterly and single month), ordered by the
 * group's `sortWeight`, and those groups are authoritative: the cards render one
 * tab per group, in the order the catalog returned them, labelled with the group
 * name plus its discount description.
 *
 * When the host cannot read package groups (an older membership deployment), the
 * tabs fall back to the packages' own `recurrenceCycle`, in the canonical
 * annual / monthly / quarterly / single-month order, labelled by
 * `resolveFallbackLabel`.
 *
 * @param packages - every team package the catalog served (fallback source).
 * @param groups - the package groups the catalog served, in catalog order.
 * @param resolveFallbackLabel - names a recurrence when no groups are served.
 * @returns the cycle tabs, empty when neither input holds a package.
 */
export function buildTeamCycleOptions<T extends SdkworkTeamPlanPackageLike>(
  packages: readonly T[],
  groups: readonly SdkworkTeamCycleGroupLike<T>[],
  resolveFallbackLabel: SdkworkTeamCycleFallbackLabel,
): SdkworkTeamCycleOption<T>[] {
  const known = new Set(packages.map((pkg) => pkg.id));

  if (groups.length > 0) {
    return groups.map((group) => {
      const groupPackages = group.packages.filter((pkg) => known.has(pkg.id));
      const durationDays = toFiniteNumber(group.durationDays, 0);
      return {
        billingCycle: toTeamBillingCycle(group.billingCycle),
        ...(group.description?.trim() ? { description: group.description.trim() } : {}),
        ...(durationDays > 0 ? { durationDays } : {}),
        groupId: group.id,
        key: group.id,
        label: group.name.trim() || group.id,
        packages: groupPackages.length > 0 ? groupPackages : group.packages,
      };
    });
  }

  const byCycle = new Map<SdkworkTeamBillingCycle | null, T[]>();
  for (const pkg of packages) {
    const cycle = toTeamBillingCycle(pkg.recurrenceCycle);
    const bucket = byCycle.get(cycle);
    if (bucket) {
      bucket.push(pkg);
    } else {
      byCycle.set(cycle, [pkg]);
    }
  }

  return [...byCycle.entries()]
    .sort(([left], [right]) => cycleSortIndex(left) - cycleSortIndex(right))
    .map(([cycle, cyclePackages]) => ({
      billingCycle: cycle,
      key: cycle ?? "other",
      label: cycle === null ? resolveFallbackLabel("month") : resolveFallbackLabel(cycle),
      packages: cyclePackages,
    }));
}

/**
 * Picks the package of one plan for the active billing-cycle tab.
 *
 * Selection is by `packageGroupId` so the buyer always gets the package that
 * belongs to the chosen group; a package whose group is unknown (older catalog)
 * falls back to its `recurrenceCycle`, and a plan that does not sell the chosen
 * cycle falls back to its first package so a tab never renders an empty card.
 *
 * @param group - the plan whose card is being rendered.
 * @param option - the active cycle tab, or `null` when no tab is available.
 * @returns the package the card prices and checks out, or `null` for no plan.
 */
export function selectTeamPlanPackage<T extends SdkworkTeamPlanPackageLike>(
  group: SdkworkTeamPlanGroup<T>,
  option: SdkworkTeamCycleOption<T> | null,
): T | null {
  if (!option) {
    return group.packages[0] ?? null;
  }
  if (option.groupId) {
    const byGroup = group.packages.find((pkg) => pkg.packageGroupId === option.groupId);
    if (byGroup) {
      return byGroup;
    }
  }
  if (option.billingCycle) {
    const byCycle = group.packages.find(
      (pkg) => toTeamBillingCycle(pkg.recurrenceCycle) === option.billingCycle,
    );
    if (byCycle) {
      return byCycle;
    }
  }
  return group.packages[0] ?? null;
}
