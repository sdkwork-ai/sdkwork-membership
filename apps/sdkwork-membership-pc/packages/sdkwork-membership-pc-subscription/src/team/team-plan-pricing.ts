/**
 * Pure seat/pricing helpers for the organization (team) subscription surface.
 *
 * These helpers are intentionally free of React, SDK, and browser APIs so the
 * seat-stepper math and the monthly/annual selection can be unit tested
 * directly. The team components own all rendering; the host port owns all data
 * access.
 */

/** Billing recurrence the team plan cards can present. */
export type SdkworkTeamBillingCycle = "month" | "year";

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
  recurrenceCycle?: string | null;
  price: string;
  originalPrice?: string;
  seatMin: string;
  seatMax: string;
  seatPointsAmount: string;
  recommended: boolean;
  sortWeight: string;
}

/** One purchasable plan in the team catalog, with its cycle variants. */
export interface SdkworkTeamPlanGroup<T extends SdkworkTeamPlanPackageLike = SdkworkTeamPlanPackageLike> {
  annual: T | null;
  monthly: T | null;
  packages: T[];
  planId: string;
  planName: string;
  planRank: number;
  recommended: boolean;
  sortWeight: number;
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
  return value === "month" || value === "year" ? value : null;
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
      annual: null,
      monthly: null,
      packages: [],
      planId: planKey,
      planName: pkg.planName?.trim() || pkg.name,
      planRank: toFiniteNumber(pkg.planRank, Number.MAX_SAFE_INTEGER),
      recommended: false,
      sortWeight: toFiniteNumber(pkg.sortWeight, 0),
    };

    group.packages.push(pkg);
    group.recommended = group.recommended || Boolean(pkg.recommended);
    const cycle = toTeamBillingCycle(pkg.recurrenceCycle);
    if (cycle === "year" && !group.annual) {
      group.annual = pkg;
    }
    if (cycle === "month" && !group.monthly) {
      group.monthly = pkg;
    }
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
 * Picks the package for the requested billing cycle, falling back to the other
 * cycle when a plan only sells one of them.
 */
export function selectTeamPlanPackage<T extends SdkworkTeamPlanPackageLike>(
  group: SdkworkTeamPlanGroup<T>,
  cycle: SdkworkTeamBillingCycle,
): T | null {
  const preferred = cycle === "year" ? group.annual : group.monthly;
  if (preferred) {
    return preferred;
  }
  const fallback = cycle === "year" ? group.monthly : group.annual;
  return fallback ?? group.packages[0] ?? null;
}
