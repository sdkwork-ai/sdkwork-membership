/**
 * Host-injected data plane for the membership subscription surface.
 *
 * The membership domain owns plans, current status and the purchase command but
 * not the commerce/membership transport. A host injects one runtime; before
 * injection the page fails closed instead of showing demo plans.
 */
export interface MembershipStatus {
  expireAt?: string;
  isMember: boolean;
  levelName?: string;
}

export interface MembershipPlan {
  description?: string;
  durationDays?: number | null;
  id: number;
  name: string;
  priceCny: number | null;
  recommended?: boolean;
}

export interface MembershipPaymentMethod {
  code: string;
  label: string;
}

export interface MembershipPurchaseResult {
  message?: string;
  status: "completed" | "failed" | "pending";
}

export interface MembershipSubscriptionRuntime {
  loadPaymentMethods(): Promise<readonly MembershipPaymentMethod[]>;
  loadPlans(): Promise<readonly MembershipPlan[]>;
  loadStatus(): Promise<MembershipStatus | null>;
  purchase(input: { paymentMethod: string; planId: number }): Promise<MembershipPurchaseResult>;
}

let runtime: MembershipSubscriptionRuntime | null = null;

/** Wires the host membership data plane for the subscription page. */
export function configureMembershipSubscriptionRuntime(
  nextRuntime: MembershipSubscriptionRuntime | null,
): void {
  runtime = nextRuntime;
}

/** Returns the injected runtime, or `null` when the host did not compose one. */
export function getMembershipSubscriptionRuntime(): MembershipSubscriptionRuntime | null {
  return runtime;
}
