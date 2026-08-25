import { type CreateSdkworkAppCapabilityManifestOptions, type SdkworkAppCapabilityManifest } from "@sdkwork/appbase-pc-react";
export interface SdkworkMembershipWorkspaceManifest extends SdkworkAppCapabilityManifest {
    capability: "membership";
    routePath: string;
}
export interface CreateMembershipWorkspaceManifestOptions extends Partial<Pick<CreateSdkworkAppCapabilityManifestOptions, "description" | "host" | "id" | "packageNames" | "theme" | "title">> {
    routePath?: string;
}
export interface SdkworkMembershipRouteIntent {
    focusWindow: boolean;
    route: string;
    sectionId?: string;
    source: "membership-workspace";
    type: "membership-route-intent";
}
export interface CreateMembershipRouteIntentOptions {
    basePath?: string;
    focusWindow?: boolean;
    sectionId?: string;
}
export interface SdkworkMembershipBenefitDigestInput {
    claimed?: boolean;
    id: string;
    name: string;
    usageLimit?: number | null;
    usedCount?: number | null;
}
export interface SdkworkMembershipBenefitsDigest {
    claimedBenefits: number;
    limitedBenefits: number;
    totalBenefits: number;
    unusedLimitedBenefits: number;
}
export interface SdkworkMembershipLevelDigestInput {
    id: string;
    isCurrent?: boolean;
    levelValue: number;
    name: string;
    requiredPoints?: number | null;
}
export interface SdkworkMembershipLevelsDigest {
    currentLevelName?: string;
    currentLevelValue: number | null;
    highestLevelName?: string;
    levelCount: number;
    nextLevelName?: string;
}
export declare function summarizeSdkworkMembershipBenefits(benefits: readonly SdkworkMembershipBenefitDigestInput[]): SdkworkMembershipBenefitsDigest;
export declare function summarizeSdkworkMembershipLevels(levels: readonly SdkworkMembershipLevelDigestInput[]): SdkworkMembershipLevelsDigest;
export declare function createMembershipWorkspaceManifest({ description, host, id, packageNames, routePath, theme, title, }?: CreateMembershipWorkspaceManifestOptions): SdkworkMembershipWorkspaceManifest;
export type SdkworkMembershipPurchaseMode = "purchase" | "renew" | "upgrade";
export interface ResolveSdkworkMembershipPurchaseModeOptions {
    plan?: {
        durationDays?: number | null;
        packageId?: number;
    } | null;
    summary: {
        isMember: boolean;
        remainingDays?: number | null;
    };
}
export declare function resolveSdkworkMembershipPurchaseMode({ plan, summary, }: ResolveSdkworkMembershipPurchaseModeOptions): SdkworkMembershipPurchaseMode;
export interface CreateMembershipCheckoutRouteIntentOptions {
    basePath?: string;
    focusWindow?: boolean;
    mode?: SdkworkMembershipPurchaseMode;
    plan: {
        id: string;
        packageId: number;
    };
}
export interface SdkworkMembershipCheckoutRouteIntent {
    focusWindow: boolean;
    kind: "subscription";
    mode: SdkworkMembershipPurchaseMode;
    route: string;
    source: "membership-workspace";
    sourceId: string;
    type: "membership-checkout-route-intent";
}
export declare function createMembershipCheckoutSourceId(plan: {
    id: string;
}, mode?: SdkworkMembershipPurchaseMode): string;
export declare function createMembershipCheckoutRouteIntent(options: CreateMembershipCheckoutRouteIntentOptions): SdkworkMembershipCheckoutRouteIntent;
export declare function createMembershipRouteIntent(options?: CreateMembershipRouteIntentOptions): SdkworkMembershipRouteIntent;
export declare const membershipPackageMeta: {
    readonly architecture: "pc-react";
    readonly domain: "commerce";
    readonly package: "@sdkwork/membership-pc-membership";
    readonly status: "ready";
};
export type MembershipPackageMeta = typeof membershipPackageMeta;
//# sourceMappingURL=membership.d.ts.map