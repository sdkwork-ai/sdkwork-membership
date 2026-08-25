import type { SdkworkSubscriptionCatalogBillingCycleOption } from "../subscription-catalog-content";
interface SubscriptionCatalogBillingTabsProps {
    billingCycleIndex: number;
    billingCycles: SdkworkSubscriptionCatalogBillingCycleOption[];
    keyPrefix?: string;
    onSelectBillingCycle: (index: number) => void;
}
export declare function SubscriptionCatalogBillingTabs({ billingCycleIndex, billingCycles, keyPrefix, onSelectBillingCycle, }: SubscriptionCatalogBillingTabsProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=subscription-catalog-billing-tabs.d.ts.map