import { createClient as createGeneratedAppClient, SdkworkAppClient } from '../generated/server-openapi/src/index';
import type { SdkworkAppConfig } from '../generated/server-openapi/src/types/common';
export { SdkworkAppClient, SdkworkAppClient as SdkworkMembershipAppClient, createGeneratedAppClient };
export type { SdkworkAppConfig };
export * from '../generated/server-openapi/src/types/index';
export * from '../generated/server-openapi/src/api/index';
export * from '../generated/server-openapi/src/http/index';
export * from '../generated/server-openapi/src/auth/index';
/**
 * Typed domain interfaces for the Membership App API.
 *
 * These mirror the typed schemas declared in
 * `apis/app-api/membership/membership-app-api.openapi.json` and allow consumers
 * to cast the unwrapped payloads returned by the generated transport
 * (the `sdkwork-v3` generator profile unwraps `data.item` / `data.items`
 * automatically but does not emit the domain item types when the OpenAPI
 * uses `SdkWorkResourceData_<Name>` / `SdkWorkPageData_<Name>` wrappers).
 */
export interface AppMembershipBenefitItem {
    id: number;
    name: string;
    benefitKey?: string;
    type?: string;
    description?: string;
    icon?: string;
    claimed: boolean;
    usageLimit?: number;
    displayValue?: string;
    usedCount?: number;
}
export interface AppMembershipPlanItem {
    id: number;
    name: string;
    rank: number;
    requiredPoints?: number;
    description?: string;
    icon?: string;
    badge?: string;
}
export interface AppMembershipInfoResponse {
    planRank: number;
    planName: string;
    membershipStatus: string;
    startedAt?: string;
    expiresAt?: string;
    remainingDays?: number;
    totalDays?: number;
    totalSpent?: string;
    points?: number;
    growthValue?: number;
    upgradeGrowthValue?: number;
    benefits: AppMembershipBenefitItem[];
}
export interface AppMembershipStatusResponse {
    active: boolean;
    planRank: number;
    expiresAt?: string;
    pointBalance?: number;
}
export interface AppMembershipPackageItem {
    id: number;
    name: string;
    description?: string;
    price: string;
    originalPrice?: string;
    pointAmount: number;
    durationDays: number;
    planName?: string;
    sortWeight: number;
    recommended: boolean;
    tags: string[];
}
export interface AppMembershipPackageGroupItem {
    id: number;
    name: string;
    description?: string;
    sortWeight: number;
    packages: AppMembershipPackageItem[];
}
export interface AppMembershipPointsBalanceResponse {
    points: number;
    availablePoints: number;
    frozenPoints: number;
}
export interface AppMembershipPointsHistoryItem {
    id: string;
    changeType: string;
    changeAmount: number;
    beforeBalance?: number;
    afterBalance: number;
    sourceType: string;
    remark?: string;
    createdAt?: string;
}
export interface AppMembershipDailyRewardStatusResponse {
    canClaim: boolean;
    claimedToday: boolean;
    consecutiveDays: number;
    totalDays: number;
}
export interface AppMembershipDailyRewardResponse {
    rewardPoints: number;
    claimedAt?: string;
    consecutiveDays: number;
}
export interface AppMembershipPrivilegeUsageResponse {
    speedUpUsed: number;
    speedUpLimit: number;
    priorityQueueUsed: number;
    priorityQueueLimit: number;
    exclusiveModelUsed: number;
    exclusiveModelLimit: number;
}
export interface AppMembershipPurchaseOutcome {
    requestNo: string;
    orderId: string;
    packageId: number;
    packageName: string;
    amount: string;
    durationDays: number;
    targetPlanRank: number;
    targetPlanName: string;
    status: string;
}
export interface CommerceOperationCommand {
    action: "purchase" | "renew" | "upgrade" | "claim_daily_reward" | "consume_speed_up";
    packageId?: number;
    orderId?: string;
    requestNo?: string;
    couponId?: string;
    idempotencyKey?: string;
}
export declare function createClient(config: SdkworkAppConfig): SdkworkAppClient;
//# sourceMappingURL=index.d.ts.map