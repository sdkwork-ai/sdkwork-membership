import { type SdkworkMembershipAppService } from "@sdkwork/membership-service";
import { type SdkworkSubscriptionMutationInput, type SdkworkSubscriptionPurchaseResult, type SdkworkSubscriptionService } from "./subscription-service";
import { type RemoteMembershipCatalogBenefit, type RemoteMembershipCatalogPackageGroup, type RemoteMembershipCatalogPlan, type SdkworkSubscriptionCatalogMemberSummaryModel, type SdkworkSubscriptionCatalogTierColumnModel } from "./subscription-catalog-mapper";
import type { SdkworkSubscriptionCatalogBillingCycleOption, SdkworkSubscriptionCatalogComparisonCategory, SdkworkSubscriptionCatalogPlanCardModel } from "./subscription-catalog-content";
import type { SdkworkMembershipCheckoutPort } from "@sdkwork/membership-pc-membership";
export interface SdkworkSubscriptionCatalogData {
    benefitsByRank: Readonly<Record<number, readonly RemoteMembershipCatalogBenefit[]>>;
    billingCycles: SdkworkSubscriptionCatalogBillingCycleOption[];
    comparisonCategories: SdkworkSubscriptionCatalogComparisonCategory[];
    memberSummary: SdkworkSubscriptionCatalogMemberSummaryModel | null;
    packageGroupIds: readonly number[];
    packageGroups: readonly RemoteMembershipCatalogPackageGroup[];
    plans: readonly RemoteMembershipCatalogPlan[];
}
export interface SdkworkSubscriptionCatalogViewModel {
    billingCycleIndex: number;
    billingCycles: SdkworkSubscriptionCatalogBillingCycleOption[];
    comparisonCategories: SdkworkSubscriptionCatalogComparisonCategory[];
    memberSummary: SdkworkSubscriptionCatalogMemberSummaryModel | null;
    planCards: SdkworkSubscriptionCatalogPlanCardModel[];
    selectedPackageGroupId: number | null;
    tierColumns: SdkworkSubscriptionCatalogTierColumnModel[];
}
export interface CreateSdkworkSubscriptionCatalogServiceOptions {
    checkoutPort?: SdkworkMembershipCheckoutPort;
    locale?: string | null;
    membershipAppService?: SdkworkMembershipAppService;
    subscriptionService?: SdkworkSubscriptionService;
    translate?: (key: string, defaultValue?: string) => string;
}
export interface SdkworkSubscriptionCatalogService {
    getCatalog(): Promise<SdkworkSubscriptionCatalogData>;
    getPurchaseStatus(orderId: string): Promise<SdkworkSubscriptionPurchaseResult>;
    getViewModel(catalog: SdkworkSubscriptionCatalogData, billingCycleIndex: number): SdkworkSubscriptionCatalogViewModel;
    getFallbackViewModel(billingCycleIndex?: number): SdkworkSubscriptionCatalogViewModel;
    purchasePackage(input: SdkworkSubscriptionMutationInput): Promise<SdkworkSubscriptionPurchaseResult>;
}
export declare function createSdkworkSubscriptionCatalogService(options?: CreateSdkworkSubscriptionCatalogServiceOptions): SdkworkSubscriptionCatalogService;
//# sourceMappingURL=subscription-catalog-service.d.ts.map