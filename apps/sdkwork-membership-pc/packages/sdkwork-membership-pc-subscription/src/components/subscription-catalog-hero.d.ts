import type { SdkworkSubscriptionCatalogBillingCycleOption } from "../subscription-catalog-content";
interface SubscriptionCatalogHeroProps {
    billingCycleIndex: number;
    billingCycles: SdkworkSubscriptionCatalogBillingCycleOption[];
    onOpenPointsDetails: () => void;
    onOpenPointsPurchase: () => void;
    onOpenRedeem: () => void;
    onSelectBillingCycle: (index: number) => void;
    subtitleLead: string;
    subtitlePointsActionLabel: string;
    subtitleRedeemActionLabel: string;
    title: string;
}
export declare function SubscriptionCatalogHero({ billingCycleIndex, billingCycles, onOpenPointsDetails, onOpenPointsPurchase, onOpenRedeem, onSelectBillingCycle, subtitleLead, subtitlePointsActionLabel, subtitleRedeemActionLabel, title, }: SubscriptionCatalogHeroProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=subscription-catalog-hero.d.ts.map