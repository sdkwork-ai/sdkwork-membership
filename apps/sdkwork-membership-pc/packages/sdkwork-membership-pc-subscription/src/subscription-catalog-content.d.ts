export declare const SDKWORK_SUBSCRIPTION_CATALOG_UNAVAILABLE_TIER_KEY: "none";
export interface SdkworkSubscriptionCatalogPlanFeature {
    emptyCheck?: boolean;
    tag?: string;
    text: string;
}
export interface SdkworkSubscriptionCatalogPlanCardModel {
    buttonStyle: string;
    buttonText: string;
    disabled: boolean;
    features: SdkworkSubscriptionCatalogPlanFeature[];
    id: string;
    membershipTierKey: string;
    name: string;
    originalPriceLabel: string;
    /**
     * The numeric package id used to open checkout and place the order.
     *
     * Kept separate from `id` because fallback/static cards carry non-numeric
     * placeholder ids ("basic", "pro", ...) that cannot be parsed back into a
     * purchasable package id. `0` means the card is a placeholder without a
     * real purchasable package.
     */
    packageNumericId: number;
    packagePeriodLabel: string;
    pointsAllowanceLabel: string;
    pointsConversionLabel: string;
    priceLabel: string;
    subtitle: string;
}
export interface SdkworkSubscriptionCatalogBillingCycleOption {
    discountLabel?: string;
    label: string;
}
export type SdkworkSubscriptionCatalogComparisonCell = boolean | string;
export interface SdkworkSubscriptionCatalogComparisonRow {
    benefitLabel: string;
    values: SdkworkSubscriptionCatalogComparisonCell[];
}
export interface SdkworkSubscriptionCatalogComparisonCategory {
    categoryLabel: string;
    rows: SdkworkSubscriptionCatalogComparisonRow[];
}
export declare function createSdkworkSubscriptionCatalogBillingCycles(translate: (key: string, defaultValue?: string) => string): SdkworkSubscriptionCatalogBillingCycleOption[];
export declare function createSdkworkSubscriptionCatalogPlanCards(translate: (key: string, defaultValue?: string) => string): SdkworkSubscriptionCatalogPlanCardModel[];
export declare function createSdkworkSubscriptionCatalogComparisonCategories(): SdkworkSubscriptionCatalogComparisonCategory[];
//# sourceMappingURL=subscription-catalog-content.d.ts.map