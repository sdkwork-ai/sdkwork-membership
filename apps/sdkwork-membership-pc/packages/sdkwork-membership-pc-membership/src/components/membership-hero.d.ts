import type { SdkworkMembershipLevel, SdkworkMembershipPlan, SdkworkMembershipSummary } from "../membership-service";
export interface SdkworkMembershipMembershipHeroProps {
    isMutating: boolean;
    levels?: SdkworkMembershipLevel[];
    onPurchase: () => void;
    onRenew: () => void;
    onUpgrade: () => void;
    selectedPlan?: SdkworkMembershipPlan | null;
    summary: SdkworkMembershipSummary;
}
export declare function SdkworkMembershipMembershipHero({ isMutating, levels, onPurchase, onRenew, onUpgrade, selectedPlan, summary, }: SdkworkMembershipMembershipHeroProps): import("react").JSX.Element;
//# sourceMappingURL=membership-hero.d.ts.map