import { type CreateSdkworkAppCapabilityManifestOptions, type SdkworkAppCapabilityManifest } from "@sdkwork/appbase-pc-react";
import { type SdkworkCouponDiscountInput, type SdkworkCouponStatus } from "@sdkwork/promotion-pc-coupon";
export type SdkworkSubscriptionAction = "purchase" | "renew" | "upgrade";
export declare function resolveAvailableSubscriptionActions(summary: {
    isMember: boolean;
}): SdkworkSubscriptionAction[];
export declare function isSdkworkSubscriptionActionAllowed(summary: {
    isMember: boolean;
}, action: SdkworkSubscriptionAction): boolean;
export type SdkworkSubscriptionCouponStatus = SdkworkCouponStatus;
export type SdkworkSubscriptionPaymentMethod = "ALIPAY" | "WECHAT";
export type SdkworkSubscriptionStage = "checkout" | "plans";
export type SdkworkSubscriptionPaymentMethodKind = "card" | "other" | "qr" | "wallet";
export type SdkworkSubscriptionPaymentProductType = "app" | "h5" | "jsapi" | "miniapp" | "native" | "online_bank" | "pc";
export interface SdkworkSubscriptionPaymentProductTypeOption {
    available: boolean;
    code: SdkworkSubscriptionPaymentProductType | string;
    label: string;
}
export interface SdkworkSubscriptionPaymentMethodOption {
    available: boolean;
    code: string;
    description?: string;
    id: string;
    kind: SdkworkSubscriptionPaymentMethodKind;
    label: string;
    paymentMethod: SdkworkSubscriptionPaymentMethod;
    productTypes: SdkworkSubscriptionPaymentProductTypeOption[];
    recommended: boolean;
    recommendedProductType: SdkworkSubscriptionPaymentProductType;
}
export interface SdkworkSubscriptionWorkspaceManifest extends SdkworkAppCapabilityManifest {
    capability: "subscription";
    routePath: string;
}
export interface CreateSubscriptionWorkspaceManifestOptions extends Partial<Pick<CreateSdkworkAppCapabilityManifestOptions, "description" | "host" | "id" | "packageNames" | "theme" | "title">> {
    routePath?: string;
}
export interface SdkworkSubscriptionRouteIntent {
    focusWindow: boolean;
    mode?: SdkworkSubscriptionAction;
    packageId?: number;
    route: string;
    source: "subscription-workspace";
    type: "subscription-route-intent";
}
export interface CreateSubscriptionRouteIntentOptions {
    basePath?: string;
    focusWindow?: boolean;
    mode?: SdkworkSubscriptionAction;
    packageId?: number;
}
export interface SdkworkSubscriptionPlanEstimateInput {
    description?: string | null;
    durationDays?: number | null;
    id: string;
    includedPoints: number;
    levelName?: string;
    name: string;
    originalPriceCny?: number | null;
    packageId: number;
    priceCny: number;
    recommended: boolean;
    tags: string[];
}
export interface SdkworkSubscriptionPackageGroup {
    description?: string;
    id: string;
    name: string;
    packageGroupId: number;
    packages: SdkworkSubscriptionPlanEstimateInput[];
    sortWeight: number;
}
export interface SdkworkSubscriptionCouponEstimateInput extends SdkworkCouponDiscountInput {
    amountCny?: number | null;
}
export interface EstimateSdkworkSubscriptionCheckoutOptions {
    action: SdkworkSubscriptionAction;
    coupon?: SdkworkSubscriptionCouponEstimateInput | null;
    paymentMethodCode?: string | null;
    paymentMethodId?: string | null;
    plan?: SdkworkSubscriptionPlanEstimateInput | null;
}
export interface SdkworkSubscriptionCheckoutEstimate {
    action: SdkworkSubscriptionAction;
    discountAmountCny: number;
    originalAmountCny: number;
    payableAmountCny: number;
    selectedCouponId: string | null;
    selectedPackageId: number | null;
    selectedPaymentMethodCode: string | null;
    selectedPaymentMethodId: string | null;
}
export declare function createDefaultSdkworkSubscriptionPaymentMethodOptions(): SdkworkSubscriptionPaymentMethodOption[];
export declare function resolveSdkworkSubscriptionPaymentMethod(paymentMethodCode: string | null | undefined): SdkworkSubscriptionPaymentMethod | null;
export declare function resolveSdkworkSubscriptionPaymentMethodOption(methods: readonly SdkworkSubscriptionPaymentMethodOption[], selectedPaymentMethodId: string | null | undefined): SdkworkSubscriptionPaymentMethodOption | null;
export declare function estimateSdkworkSubscriptionCheckout({ action, coupon, paymentMethodCode, paymentMethodId, plan, }: EstimateSdkworkSubscriptionCheckoutOptions): SdkworkSubscriptionCheckoutEstimate;
export declare function createSubscriptionWorkspaceManifest({ description, host, id, packageNames, routePath, theme, title, }?: CreateSubscriptionWorkspaceManifestOptions): SdkworkSubscriptionWorkspaceManifest;
export declare function createSubscriptionRouteIntent(options?: CreateSubscriptionRouteIntentOptions): SdkworkSubscriptionRouteIntent;
export declare const subscriptionPackageMeta: {
    readonly architecture: "pc-react";
    readonly domain: "membership";
    readonly package: "@sdkwork/membership-pc-subscription";
    readonly status: "ready";
};
export type SubscriptionPackageMeta = typeof subscriptionPackageMeta;
//# sourceMappingURL=subscription.d.ts.map