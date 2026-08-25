import type { SdkworkSubscriptionCatalogBillingCycleOption, SdkworkSubscriptionCatalogComparisonCategory, SdkworkSubscriptionCatalogPlanCardModel } from "./subscription-catalog-content";
export interface RemoteMembershipCatalogPackage {
    description?: string;
    durationDays?: number | string;
    id?: number | string;
    levelName?: string;
    name?: string;
    originalPrice?: number | string;
    planName?: string;
    pointAmount?: number | string;
    price?: number | string;
    recommended?: boolean;
    sortWeight?: number | string;
    tags?: string[];
}
export interface RemoteMembershipCatalogPackageGroup {
    description?: string;
    id?: number | string;
    name?: string;
    packages?: RemoteMembershipCatalogPackage[];
    sortWeight?: number | string;
}
export interface RemoteMembershipCatalogPlan {
    id?: number | string;
    name?: string;
    rank?: number | string;
}
export interface RemoteMembershipCatalogBenefit {
    benefitKey?: string;
    description?: string;
    displayValue?: string;
    id?: number | string;
    name?: string;
    type?: string;
    usageLimit?: number | string;
}
export interface SdkworkSubscriptionCatalogTierColumnModel {
    buttonDisabled?: boolean;
    buttonText: string;
    isCurrentPlan?: boolean;
    membershipTierKey: string;
    name: string;
    packageId: string;
    packageNumericId: number;
    packagePeriodLabel: string;
    priceLabel: string;
    originalPriceLabel?: string;
}
export interface SdkworkSubscriptionCatalogMemberSummaryModel {
    membershipTierKey: string;
    planRank: number | null;
}
export declare function resolvePlanRankFromPackage(pkg: RemoteMembershipCatalogPackage, plans: readonly RemoteMembershipCatalogPlan[]): number;
export declare function mapPackageGroupsToBillingCycles(groups: readonly RemoteMembershipCatalogPackageGroup[]): SdkworkSubscriptionCatalogBillingCycleOption[];
export declare function mapPackagesToPlanCards(packages: readonly RemoteMembershipCatalogPackage[], plans: readonly RemoteMembershipCatalogPlan[], memberSummary: SdkworkSubscriptionCatalogMemberSummaryModel | null, translate: (key: string, defaultValue?: string) => string): SdkworkSubscriptionCatalogPlanCardModel[];
export declare function mapPackagesToTierColumns(packages: readonly RemoteMembershipCatalogPackage[], plans: readonly RemoteMembershipCatalogPlan[], memberSummary: SdkworkSubscriptionCatalogMemberSummaryModel | null, translate: (key: string, defaultValue?: string) => string): SdkworkSubscriptionCatalogTierColumnModel[];
export declare function buildComparisonCategories(benefitsByRank: Readonly<Record<number, readonly RemoteMembershipCatalogBenefit[]>>): SdkworkSubscriptionCatalogComparisonCategory[];
export declare function resolveMemberSummaryFromPlanRank(planRank: number | null): SdkworkSubscriptionCatalogMemberSummaryModel;
//# sourceMappingURL=subscription-catalog-mapper.d.ts.map