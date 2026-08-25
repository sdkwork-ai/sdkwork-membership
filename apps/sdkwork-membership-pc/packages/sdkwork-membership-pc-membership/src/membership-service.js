import { createSdkworkMembershipListQuery, getSdkworkMembershipService, hasSdkworkMembershipSession, requireSdkworkMembershipSession, toNullableSdkworkMembershipNumber, toSdkworkMembershipNumber, toSdkworkMembershipOptionalString, unwrapSdkworkMembershipPageItems, unwrapSdkworkMembershipResponse, readSdkworkMediaResource, } from "@sdkwork/membership-service";
import { createSdkworkMembershipMessages, } from "./membership-copy";
/** 注册的功能门槛清单（对齐服务端功能码）。 */
export const SDKWORK_MEMBERSHIP_FEATURE_CODES = [
    "ai_chat",
    "image_generation",
    "priority_speed_up",
    "priority_queue",
    "exclusive_model",
];
function mapPlan(membershipPackage) {
    const packageId = toSdkworkMembershipNumber(membershipPackage.id);
    return {
        description: toSdkworkMembershipOptionalString(membershipPackage.description),
        durationDays: toNullableSdkworkMembershipNumber(membershipPackage.durationDays),
        id: `membership-package-${packageId}`,
        includedPoints: toSdkworkMembershipNumber(membershipPackage.pointAmount),
        levelName: toSdkworkMembershipOptionalString(membershipPackage.levelName ?? membershipPackage.planName),
        name: toSdkworkMembershipOptionalString(membershipPackage.name) || "Membership package",
        originalPriceCny: toNullableSdkworkMembershipNumber(membershipPackage.originalPrice),
        packageId,
        priceCny: toSdkworkMembershipNumber(membershipPackage.price),
        recommended: Boolean(membershipPackage.recommended),
        tags: Array.isArray(membershipPackage.tags)
            ? membershipPackage.tags.map((tag) => tag.trim()).filter(Boolean)
            : [],
    };
}
function sortPlans(plans) {
    return [...plans].sort((left, right) => Number(right.recommended) - Number(left.recommended)
        || right.includedPoints - left.includedPoints
        || left.priceCny - right.priceCny
        || left.id.localeCompare(right.id));
}
function sortBenefits(benefits) {
    return [...benefits].sort((left, right) => Number(right.claimed) - Number(left.claimed)
        || left.name.localeCompare(right.name));
}
function sortLevels(levels) {
    return [...levels].sort((left, right) => left.levelValue - right.levelValue || left.name.localeCompare(right.name));
}
function mapSummary(membershipInfo, membershipStatus) {
    const isMember = Boolean(membershipStatus?.active || (membershipInfo?.membershipStatus || "").toUpperCase() === "ACTIVE");
    const currentLevelValue = toNullableSdkworkMembershipNumber(membershipStatus?.planRank ?? membershipInfo?.planRank);
    return {
        currentLevelName: toSdkworkMembershipOptionalString(membershipInfo?.planName) || (isMember ? "Member" : "Free"),
        currentLevelValue,
        expireTime: toSdkworkMembershipOptionalString(membershipStatus?.expireTime) || toSdkworkMembershipOptionalString(membershipInfo?.expireTime),
        growthValue: toNullableSdkworkMembershipNumber(membershipInfo?.growthValue),
        isAuthenticated: true,
        isMember,
        pointBalance: toNullableSdkworkMembershipNumber(membershipStatus?.pointBalance),
        points: toNullableSdkworkMembershipNumber(membershipInfo?.points),
        remainingDays: toNullableSdkworkMembershipNumber(membershipInfo?.remainingDays),
        status: isMember ? "active" : "free",
        totalSpent: toNullableSdkworkMembershipNumber(membershipInfo?.totalSpent),
        upgradeGrowthValue: toNullableSdkworkMembershipNumber(membershipInfo?.upgradeGrowthValue),
    };
}
function mapLevels(levels, currentLevelValue) {
    return sortLevels(levels.map((level) => ({
        badge: toSdkworkMembershipOptionalString(level.badge),
        description: toSdkworkMembershipOptionalString(level.description),
        icon: readSdkworkMediaResource(level.icon),
        id: `membership-level-${toSdkworkMembershipNumber(level.id)}`,
        isCurrent: currentLevelValue !== null && toSdkworkMembershipNumber(level.levelValue) === currentLevelValue,
        levelValue: toSdkworkMembershipNumber(level.levelValue),
        name: toSdkworkMembershipOptionalString(level.name) || "Membership level",
        requiredPoints: toNullableSdkworkMembershipNumber(level.requiredPoints),
    })));
}
function mapBenefits(benefits) {
    return sortBenefits(benefits.map((benefit) => ({
        benefitKey: toSdkworkMembershipOptionalString(benefit.benefitKey),
        claimed: Boolean(benefit.claimed),
        description: toSdkworkMembershipOptionalString(benefit.description),
        displayValue: toSdkworkMembershipOptionalString(benefit.displayValue),
        id: `membership-benefit-${toSdkworkMembershipNumber(benefit.id)}`,
        name: toSdkworkMembershipOptionalString(benefit.name) || "Membership benefit",
        type: toSdkworkMembershipOptionalString(benefit.type),
        usageLimit: toNullableSdkworkMembershipNumber(benefit.usageLimit),
        usedCount: toNullableSdkworkMembershipNumber(benefit.usedCount),
    })));
}
function mapFeatureGate(featureCode, gate) {
    return {
        allowed: Boolean(gate.allowed),
        active: Boolean(gate.active),
        currentLevel: toNullableSdkworkMembershipNumber(gate.currentLevel),
        featureCode,
        requiredLevel: toSdkworkMembershipNumber(gate.requiredLevel),
        status: toSdkworkMembershipOptionalString(gate.status) ?? "unavailable",
        expiresAt: gate.expiresAt,
        reason: gate.reason,
    };
}
function deniedFeatureGates(featureCodes) {
    return featureCodes.map((featureCode) => ({
        allowed: false,
        active: false,
        currentLevel: null,
        featureCode,
        requiredLevel: 0,
        status: "free",
        reason: "membership is not active",
    }));
}
async function runPurchaseMutation(copy, action, input, checkoutPort) {
    requireSdkworkMembershipSession(copy.signInRequired);
    if (!checkoutPort) {
        throw new Error("Membership checkout is not configured by the host application.");
    }
    return checkoutPort.createCheckout({ ...input, action });
}
function createEmptyDashboard() {
    return {
        benefits: [],
        levels: [],
        plans: [],
        summary: {
            currentLevelName: "Guest",
            currentLevelValue: null,
            growthValue: null,
            isAuthenticated: false,
            isMember: false,
            pointBalance: null,
            points: null,
            remainingDays: null,
            status: "guest",
            totalSpent: null,
            upgradeGrowthValue: null,
        },
    };
}
export function createSdkworkMembershipService(options = {}) {
    const copy = createSdkworkMembershipMessages(options.locale, options.messages);
    const getCommerceService = () => options.membershipAppService ?? getSdkworkMembershipService();
    return {
        async getDashboard() {
            const membershipAppService = getCommerceService();
            if (!hasSdkworkMembershipSession()) {
                // Anonymous visitors can still browse membership plans/packages.
                // The packages endpoint serves public catalog data; if it fails,
                // return an empty dashboard so the page renders gracefully.
                try {
                    const packagesPayload = await membershipAppService.memberships.packages.list(createSdkworkMembershipListQuery(1, 200));
                    const packages = unwrapSdkworkMembershipPageItems(packagesPayload);
                    return {
                        ...createEmptyDashboard(),
                        plans: sortPlans(packages.map(mapPlan)),
                    };
                }
                catch {
                    return createEmptyDashboard();
                }
            }
            const [membershipInfoPayload, membershipStatusPayload, levelsPayload, benefitsPayload, packagesPayload] = await Promise.all([
                membershipAppService.memberships.current.retrieve(),
                membershipAppService.memberships.current.status.retrieve(),
                membershipAppService.memberships.plans.list(createSdkworkMembershipListQuery(1, 200)),
                membershipAppService.memberships.benefits.list(createSdkworkMembershipListQuery(1, 200)),
                membershipAppService.memberships.packages.list(createSdkworkMembershipListQuery(1, 200)),
            ]);
            const membershipInfo = unwrapSdkworkMembershipResponse(membershipInfoPayload);
            const membershipStatus = unwrapSdkworkMembershipResponse(membershipStatusPayload);
            const levels = unwrapSdkworkMembershipPageItems(levelsPayload);
            const benefits = unwrapSdkworkMembershipPageItems(benefitsPayload);
            const packages = unwrapSdkworkMembershipPageItems(packagesPayload);
            const summary = mapSummary(membershipInfo, membershipStatus);
            return {
                benefits: mapBenefits(benefits),
                levels: mapLevels(levels, summary.currentLevelValue),
                plans: sortPlans(packages.map(mapPlan)),
                summary,
            };
        },
        getEmptyDashboard() {
            return createEmptyDashboard();
        },
        async getPurchaseStatus(orderId) {
            requireSdkworkMembershipSession(copy.service.signInRequired);
            const normalizedOrderId = toSdkworkMembershipOptionalString(orderId);
            if (!normalizedOrderId || !options.checkoutPort) {
                throw new Error(copy.service.purchaseFailed);
            }
            return options.checkoutPort.getCheckoutStatus(normalizedOrderId);
        },
        async purchaseMembership(input) {
            return runPurchaseMutation(copy.service, "purchase", input, options.checkoutPort);
        },
        async renewMembership(input) {
            return runPurchaseMutation(copy.service, "renew", input, options.checkoutPort);
        },
        async upgradeMembership(input) {
            return runPurchaseMutation(copy.service, "upgrade", input, options.checkoutPort);
        },
        async rechargeQuota(input) {
            return runPurchaseMutation(copy.service, "recharge", input, options.checkoutPort);
        },
        async checkFeatureAccess(featureCodes) {
            const membershipAppService = getCommerceService();
            if (!hasSdkworkMembershipSession()) {
                return deniedFeatureGates(featureCodes);
            }
            const results = await Promise.all(featureCodes.map((featureCode) => membershipAppService.memberships.accessChecks
                .create({ featureCode })
                .then((gate) => mapFeatureGate(featureCode, gate))
                .catch(() => ({
                allowed: false,
                active: false,
                currentLevel: null,
                featureCode,
                requiredLevel: 0,
                status: "unavailable",
                reason: "feature access check is unavailable",
            }))));
            return results;
        },
    };
}
export const sdkworkMembershipService = createSdkworkMembershipService();
//# sourceMappingURL=membership-service.js.map