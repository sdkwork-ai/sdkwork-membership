import { type SdkworkMembershipAppService, type SdkworkMediaResource } from "@sdkwork/membership-service";
import { type SdkworkMembershipMessagesOverrides } from "./membership-copy";
import { type SdkworkMembershipQrPaymentStrategyId } from "./payment-qr-strategy";
export interface SdkworkMembershipBenefit {
    benefitKey?: string;
    claimed: boolean;
    description?: string;
    displayValue?: string;
    id: string;
    name: string;
    type?: string;
    usageLimit: number | null;
    usedCount: number | null;
}
export interface SdkworkMembershipLevel {
    badge?: string;
    description?: string;
    icon?: SdkworkMediaResource;
    id: string;
    isCurrent: boolean;
    levelValue: number;
    name: string;
    requiredPoints: number | null;
}
export interface SdkworkMembershipPlan {
    description?: string;
    durationDays: number | null;
    id: string;
    includedPoints: number;
    levelName?: string;
    name: string;
    originalPriceCny: number | null;
    packageId: number;
    priceCny: number;
    recommended: boolean;
    tags: string[];
}
export interface SdkworkMembershipSummary {
    currentLevelName: string;
    currentLevelValue: number | null;
    expireTime?: string;
    growthValue: number | null;
    isAuthenticated: boolean;
    isMember: boolean;
    pointBalance: number | null;
    points: number | null;
    remainingDays: number | null;
    status: "active" | "free" | "guest";
    totalSpent: number | null;
    upgradeGrowthValue: number | null;
}
export interface SdkworkMembershipDashboardData {
    benefits: SdkworkMembershipBenefit[];
    levels: SdkworkMembershipLevel[];
    plans: SdkworkMembershipPlan[];
    summary: SdkworkMembershipSummary;
}
export interface SdkworkMembershipMutationInput {
    couponId?: string;
    packageId?: number;
    paymentMethod?: string;
    /** 订阅期额度充值数量（仅 action=recharge）。 */
    grantQuantity?: number;
    /** 订阅期额度充值金额（仅 action=recharge，货币金额字符串）。 */
    amountCny?: string;
}
export interface SdkworkMembershipPurchaseResult {
    amountCny: number | null;
    cashierUrl?: string;
    durationDays: number | null;
    expiresAt?: string;
    orderId?: string;
    packageId: number | null;
    packageName?: string;
    qrCode?: string;
    qrPaymentStrategy?: SdkworkMembershipQrPaymentStrategyId;
    status: "completed" | "failed" | "pending";
    targetLevelName?: string;
}
export interface SdkworkMembershipCheckoutRequest extends SdkworkMembershipMutationInput {
    action: "purchase" | "renew" | "upgrade" | "recharge";
}
/** 会员功能门槛校验结果。 */
export interface SdkworkMembershipFeatureGate {
    allowed: boolean;
    active: boolean;
    currentLevel: number | null;
    featureCode: string;
    requiredLevel: number;
    status: string;
    expiresAt?: string | null;
    reason?: string | null;
}
/** 注册的功能门槛清单（对齐服务端功能码）。 */
export declare const SDKWORK_MEMBERSHIP_FEATURE_CODES: readonly ["ai_chat", "image_generation", "priority_speed_up", "priority_queue", "exclusive_model"];
export type SdkworkMembershipFeatureCode = (typeof SDKWORK_MEMBERSHIP_FEATURE_CODES)[number];
export interface SdkworkMembershipCheckoutPort {
    createCheckout(input: SdkworkMembershipCheckoutRequest): Promise<SdkworkMembershipPurchaseResult>;
    getCheckoutStatus(orderId: string): Promise<SdkworkMembershipPurchaseResult>;
}
export interface CreateSdkworkMembershipServiceOptions {
    checkoutPort?: SdkworkMembershipCheckoutPort;
    membershipAppService?: SdkworkMembershipAppService;
    locale?: string | null;
    messages?: SdkworkMembershipMessagesOverrides;
}
export interface SdkworkMembershipService {
    getDashboard(): Promise<SdkworkMembershipDashboardData>;
    getEmptyDashboard(): SdkworkMembershipDashboardData;
    getPurchaseStatus(orderId: string): Promise<SdkworkMembershipPurchaseResult>;
    purchaseMembership(input: SdkworkMembershipMutationInput): Promise<SdkworkMembershipPurchaseResult>;
    renewMembership(input: SdkworkMembershipMutationInput): Promise<SdkworkMembershipPurchaseResult>;
    upgradeMembership(input: SdkworkMembershipMutationInput): Promise<SdkworkMembershipPurchaseResult>;
    /** 订阅期额度充值：向当前有效订阅追加权益额度。 */
    rechargeQuota(input: SdkworkMembershipMutationInput): Promise<SdkworkMembershipPurchaseResult>;
    /** 按功能码校验会员等级门槛；匿名会话全部返回未解锁。 */
    checkFeatureAccess(featureCodes: string[]): Promise<SdkworkMembershipFeatureGate[]>;
}
export declare function createSdkworkMembershipService(options?: CreateSdkworkMembershipServiceOptions): SdkworkMembershipService;
export declare const sdkworkMembershipService: SdkworkMembershipService;
//# sourceMappingURL=membership-service.d.ts.map