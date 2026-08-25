import type { SdkworkSubscriptionCatalogBillingCycleOption, SdkworkSubscriptionCatalogComparisonCategory } from "../subscription-catalog-content";
import type { SdkworkSubscriptionCatalogTierColumnModel } from "../subscription-catalog-mapper";
interface SubscriptionCatalogTierCompareProps {
    basicPlanLabel: string;
    billingCycleIndex: number;
    billingCycles: SdkworkSubscriptionCatalogBillingCycleOption[];
    comingSoonLabel: string;
    comparisonCategories: SdkworkSubscriptionCatalogComparisonCategory[];
    currentPlanLabel: string;
    firstYear58Label: string;
    firstYear60Label: string;
    onSelectBillingCycle: (index: number) => void;
    onSelectPackage: (packageId: string, membershipTierKey: string, packageName: string, priceLabel: string, originalPriceLabel: string | undefined, packagePeriodLabel: string) => void;
    perMonthShortLabel: string;
    perYearShortLabel: string;
    premiumPlanLabel: string;
    sectionTitle: string;
    standardPlanLabel: string;
    superPlanLabel: string;
    tierColumns?: SdkworkSubscriptionCatalogTierColumnModel[];
}
export declare function SubscriptionCatalogTierCompare({ billingCycleIndex, billingCycles, comingSoonLabel, comparisonCategories, currentPlanLabel, onSelectBillingCycle, onSelectPackage, perMonthShortLabel, perYearShortLabel, superPlanLabel, sectionTitle, tierColumns, }: SubscriptionCatalogTierCompareProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=subscription-catalog-tier-compare.d.ts.map