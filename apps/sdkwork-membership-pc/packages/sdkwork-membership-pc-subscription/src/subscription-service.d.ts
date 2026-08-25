import { type SdkworkMembershipAppService } from "@sdkwork/membership-service";
import { type SdkworkCouponService, type SdkworkUserCoupon } from "@sdkwork/promotion-pc-coupon";
import type { SdkworkPromotionAppService } from "@sdkwork/promotion-service";
import { type SdkworkMembershipCheckoutPort, type SdkworkMembershipBenefit, type SdkworkMembershipLevel, type SdkworkMembershipPlan, type SdkworkMembershipPurchaseResult, type SdkworkMembershipService, type SdkworkMembershipSummary } from "@sdkwork/membership-pc-membership";
import { type SdkworkSubscriptionCheckoutEstimate, type SdkworkSubscriptionPaymentMethod, type SdkworkSubscriptionPaymentMethodKind, type SdkworkSubscriptionPaymentMethodOption, type SdkworkSubscriptionPaymentProductType, type SdkworkSubscriptionPaymentProductTypeOption } from "./subscription";
import { type SdkworkSubscriptionMessagesOverrides } from "./subscription-copy";
import type { SdkworkSubscriptionPackageGroup } from "./subscription";
export interface SdkworkSubscriptionCoupon extends SdkworkUserCoupon {
    discountAmountCny: number | null;
}
export interface SdkworkSubscriptionDashboardData {
    benefits: SdkworkMembershipBenefit[];
    checkout: SdkworkSubscriptionCheckoutEstimate;
    coupons: SdkworkSubscriptionCoupon[];
    levels: SdkworkMembershipLevel[];
    packageGroups: SdkworkSubscriptionPackageGroup[];
    paymentMethods: SdkworkSubscriptionPaymentMethodOption[];
    plans: SdkworkMembershipPlan[];
    summary: SdkworkMembershipSummary;
}
export interface SdkworkSubscriptionMutationInput {
    couponId?: string;
    packageId: number;
    paymentMethod?: SdkworkSubscriptionPaymentMethod;
}
export type SdkworkSubscriptionPurchaseResult = SdkworkMembershipPurchaseResult;
export interface SdkworkSubscriptionPaymentMethodSource {
    available?: boolean;
    code: string;
    description?: string;
    id: string;
    kind?: SdkworkSubscriptionPaymentMethodKind;
    label: string;
    paymentMethod?: SdkworkSubscriptionPaymentMethod;
    productTypes: SdkworkSubscriptionPaymentProductTypeOption[];
    recommended?: boolean;
    recommendedProductType: SdkworkSubscriptionPaymentProductType;
    sort?: number;
}
export interface SdkworkSubscriptionPaymentMethodDashboard {
    methods: readonly SdkworkSubscriptionPaymentMethodSource[];
}
export interface SdkworkSubscriptionPaymentMethodService {
    getDashboard(): Promise<SdkworkSubscriptionPaymentMethodDashboard>;
    getEmptyDashboard(): SdkworkSubscriptionPaymentMethodDashboard;
}
export interface CreateSdkworkSubscriptionServiceOptions {
    checkoutPort?: SdkworkMembershipCheckoutPort;
    promotionAppService?: SdkworkPromotionAppService;
    membershipAppService?: SdkworkMembershipAppService;
    locale?: string | null;
    messages?: SdkworkSubscriptionMessagesOverrides;
    couponService?: Pick<SdkworkCouponService, "getDashboard">;
    paymentMethodService?: Partial<SdkworkSubscriptionPaymentMethodService>;
    membershipService?: Partial<SdkworkMembershipService>;
}
export interface SdkworkSubscriptionService {
    getDashboard(): Promise<SdkworkSubscriptionDashboardData>;
    getEmptyDashboard(): SdkworkSubscriptionDashboardData;
    getPurchaseStatus(orderId: string): Promise<SdkworkSubscriptionPurchaseResult>;
    purchaseSubscription(input: SdkworkSubscriptionMutationInput): Promise<SdkworkSubscriptionPurchaseResult>;
    renewSubscription(input: SdkworkSubscriptionMutationInput): Promise<SdkworkSubscriptionPurchaseResult>;
    upgradeSubscription(input: SdkworkSubscriptionMutationInput): Promise<SdkworkSubscriptionPurchaseResult>;
}
export declare function createSdkworkSubscriptionPaymentMethodService(): SdkworkSubscriptionPaymentMethodService;
export declare function createSdkworkSubscriptionService(options?: CreateSdkworkSubscriptionServiceOptions): SdkworkSubscriptionService;
//# sourceMappingURL=subscription-service.d.ts.map