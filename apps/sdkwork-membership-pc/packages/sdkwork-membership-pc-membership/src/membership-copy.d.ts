export type SdkworkMembershipLocale = "en-US" | "zh-CN";
export type SdkworkMembershipMessagesOverrides = DeepPartial<SdkworkMembershipMessages>;
export interface SdkworkMembershipMessages {
    actions: {
        benefits: string;
        levels: string;
        plans: string;
        refresh: string;
        renew: string;
        selectPlan: string;
        selected: string;
        upgrade: string;
        claim: string;
        compare: string;
        viewBenefits: string;
    };
    benefits: {
        claimed: string;
        descriptionFallback: string;
        emptyDescription: string;
        emptyTitle: string;
        eyebrow: string;
        pending: string;
        title: string;
        typeFallback: string;
        usageValue: string;
        valueLabel: string;
        locked: string;
        unlockAt: string;
        unlimited: string;
    };
    common: {
        flexibleDuration: string;
        noValue: string;
        perYear: string;
        billedYearly: string;
        save: string;
    };
    format: {
        daysValue: string;
        priceWasValue: string;
        pointsToNext: string;
        expiresOn: string;
        memberSince: string;
    };
    headerEntry: {
        ariaLabel: string;
        fallbackLevel: string;
        title: string;
    };
    hero: {
        currentLevel: string;
        description: string;
        eyebrow: string;
        includedPoints: string;
        noPackageDescription: string;
        noPackageSelected: string;
        price: string;
        remaining: string;
        selectedOffer: string;
        status: string;
        title: string;
        points: string;
        progressToNext: string;
        nextLevel: string;
        topLevel: string;
        pointsLabel: string;
        growthLabel: string;
    };
    levels: {
        compareLevel: string;
        currentLevelAction: string;
        currentLabel: string;
        descriptionFallback: string;
        emptyDescription: string;
        emptyTitle: string;
        eyebrow: string;
        requiredPoints: string;
        title: string;
        ladderEyebrow: string;
        ladderTitle: string;
        locked: string;
        perks: string;
    };
    menu: {
        continueCheckout: string;
        emptyDescription: string;
        emptyTitle: string;
        openCenter: string;
        signInRequiredDescription: string;
        signInRequiredTitle: string;
        title: string;
    };
    page: {
        errorTitle: string;
        loading: string;
        subtitle: string;
    };
    plans: {
        descriptionFallback: string;
        emptyDescription: string;
        emptyTitle: string;
        eyebrow: string;
        popular: string;
        title: string;
        subtitle: string;
        features: string;
        allFeatures: string;
        duration: string;
        pointsIncluded: string;
    };
    service: {
        purchaseFailed: string;
        renewFailed: string;
        signInRequired: string;
        upgradeFailed: string;
        rechargeFailed: string;
    };
    status: {
        active: string;
        free: string;
        guest: string;
    };
    quota: {
        title: string;
        description: string;
        quantityLabel: string;
        quantityPlaceholder: string;
        amountLabel: string;
        amountPlaceholder: string;
        submit: string;
        submitting: string;
        error: string;
        onlyForMembers: string;
    };
    gates: {
        title: string;
        description: string;
        requiredLevel: string;
        unlocked: string;
        locked: string;
        statusUnavailable: string;
        labels: {
            aiChat: string;
            imageGeneration: string;
            prioritySpeedUp: string;
            priorityQueue: string;
            exclusiveModel: string;
        };
    };
}
type DeepPartial<T> = {
    [K in keyof T]?: T[K] extends (...args: never[]) => unknown ? T[K] : T[K] extends object ? DeepPartial<T[K]> : T[K];
};
export declare function normalizeSdkworkMembershipLocale(locale?: string | null): SdkworkMembershipLocale;
export declare function createSdkworkMembershipMessages(locale?: string | null, overrides?: SdkworkMembershipMessagesOverrides): SdkworkMembershipMessages;
export declare function formatSdkworkMembershipTemplate(template: string, replacements: Record<string, string>): string;
export declare function formatSdkworkMembershipStatusLabel(value: "active" | "free" | "guest", locale?: string | null, overrides?: SdkworkMembershipMessagesOverrides): string;
export declare function formatSdkworkMembershipDurationLabel(value: number | null, locale?: string | null, overrides?: SdkworkMembershipMessagesOverrides): string;
export declare function formatSdkworkMembershipIncludedPointsLabel(value: number, locale?: string | null): string;
export declare function formatSdkworkMembershipUsageLabel(used: number | null, limit: number | null, locale?: string | null, overrides?: SdkworkMembershipMessagesOverrides): string;
export declare function formatSdkworkMembershipPriceWasLabel(value: string, locale?: string | null, overrides?: SdkworkMembershipMessagesOverrides): string;
export {};
//# sourceMappingURL=membership-copy.d.ts.map