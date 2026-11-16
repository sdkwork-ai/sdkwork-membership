import type { ComponentType } from "react";
import type { SdkworkSubscriptionPurchaseResult } from "./subscription-service";
import type { SdkworkMembershipCheckoutPort } from "@sdkwork/membership-pc-membership";
import type { SdkworkSubscriptionCatalogTeamProps } from "./subscription-catalog-team";

export { SDKWORK_SUBSCRIPTION_CATALOG_UNAVAILABLE_TIER_KEY } from "./subscription-catalog-content";

export interface SdkworkSubscriptionCatalogModalProps {
  currentPoints?: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export interface SdkworkSubscriptionCatalogCheckoutPlan {
  id: string;
  membershipTierKey: string;
  name: string;
  originalPrice?: string;
  packageNumericId: number;
  packagePeriodLabel: string;
  priceLabel: string;
  /**
   * Audience that selected this plan.
   *
   * `team` plans are priced per seat and are paid through the same order-owned
   * checkout; the host dialog presents the payment and never re-prices it.
   */
  audience?: "personal" | "team";
}

export interface SdkworkSubscriptionCatalogCheckoutPayment {
  amountCny?: number | null;
  expiresAt?: string;
  orderId?: string;
  qrCode?: string;
  status: "completed" | "failed" | "pending";
}

export interface SdkworkSubscriptionCatalogCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentCompleted?: (
    payment: SdkworkSubscriptionCatalogCheckoutPayment,
  ) => Promise<void> | void;
  onPaymentStatus?: (
    orderId: string,
  ) => Promise<SdkworkSubscriptionCatalogCheckoutPayment>;
  onPurchase: () => Promise<SdkworkSubscriptionPurchaseResult>;
  plan: SdkworkSubscriptionCatalogCheckoutPlan | null;
}

export interface SdkworkSubscriptionMemberSummary {
  membershipTierKey: string;
  pointBalance?: number | null;
}

export interface SdkworkSubscriptionCatalogHostComponents {
  checkoutModal: ComponentType<SdkworkSubscriptionCatalogCheckoutModalProps>;
  pointsDetailsModal: ComponentType<SdkworkSubscriptionCatalogModalProps>;
  pointsPurchaseModal: ComponentType<SdkworkSubscriptionCatalogModalProps>;
  redeemModal: ComponentType<SdkworkSubscriptionCatalogModalProps>;
}

export interface SdkworkSubscriptionCatalogPageProps {
  checkoutPort?: SdkworkMembershipCheckoutPort;
  components?: SdkworkSubscriptionCatalogHostComponents;
  /**
   * Points balance the host's points modals display.
   *
   * Hosts whose points ledger is not the Membership points asset (for example a
   * Token Bank compute-credit account) supply the figure they want the details
   * and purchase modals to show. When omitted, the page falls back to
   * `memberSummary.pointBalance`.
   */
  currentPoints?: number | null;
  memberSummary?: SdkworkSubscriptionMemberSummary | null;
  notifyOutlet?: ComponentType;
  onLoginRequired?: () => void;
  onMembershipTierUpdated?: (membershipTierKey: string, durationDays: number) => void;
  onNotify?: (message: string, tone: "error" | "info" | "success") => void;
  /**
   * Optional organization (team) capability.
   *
   * When present the page renders the audience switch above the personal hero
   * and the team seat surface when the team audience is selected; when absent
   * the page stays personal-only.
   */
  team?: SdkworkSubscriptionCatalogTeamProps;
}

export type SdkworkSubscriptionCatalogTranslate = (
  key: string,
  defaultValue?: string,
) => string;
