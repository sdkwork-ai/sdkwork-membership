import type { ComponentType } from "react";
import type { SdkworkSubscriptionPurchaseResult } from "./subscription-service";
import type { SdkworkMembershipCheckoutPort } from "@sdkwork/membership-pc-membership";
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
    onPaymentCompleted?: (payment: SdkworkSubscriptionCatalogCheckoutPayment) => Promise<void> | void;
    onPaymentStatus?: (orderId: string) => Promise<SdkworkSubscriptionCatalogCheckoutPayment>;
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
    memberSummary?: SdkworkSubscriptionMemberSummary | null;
    notifyOutlet?: ComponentType;
    onLoginRequired?: () => void;
    onMembershipTierUpdated?: (membershipTierKey: string, durationDays: number) => void;
    onNotify?: (message: string, tone: "error" | "info" | "success") => void;
}
export type SdkworkSubscriptionCatalogTranslate = (key: string, defaultValue?: string) => string;
//# sourceMappingURL=subscription-catalog-host.d.ts.map