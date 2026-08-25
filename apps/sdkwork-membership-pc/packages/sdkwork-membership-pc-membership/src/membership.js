import { createSdkworkAppCapabilityManifest, } from "@sdkwork/appbase-pc-react";
function normalizeBasePath(basePath) {
    const normalized = (basePath ?? "/memberships").trim();
    if (!normalized || normalized === "/") {
        return "/memberships";
    }
    return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}
export function summarizeSdkworkMembershipBenefits(benefits) {
    return benefits.reduce((summary, benefit) => {
        summary.totalBenefits += 1;
        if (benefit.claimed) {
            summary.claimedBenefits += 1;
        }
        if ((benefit.usageLimit ?? null) !== null) {
            summary.limitedBenefits += 1;
            if ((benefit.usedCount ?? 0) <= 0) {
                summary.unusedLimitedBenefits += 1;
            }
        }
        return summary;
    }, {
        claimedBenefits: 0,
        limitedBenefits: 0,
        totalBenefits: 0,
        unusedLimitedBenefits: 0,
    });
}
export function summarizeSdkworkMembershipLevels(levels) {
    const sortedLevels = [...levels].sort((left, right) => left.levelValue - right.levelValue || left.name.localeCompare(right.name));
    const currentLevel = sortedLevels.find((level) => level.isCurrent);
    const highestLevel = sortedLevels[sortedLevels.length - 1];
    const nextLevel = currentLevel
        ? sortedLevels.find((level) => level.levelValue > currentLevel.levelValue)
        : sortedLevels[0];
    return {
        currentLevelName: currentLevel?.name,
        currentLevelValue: currentLevel?.levelValue ?? null,
        highestLevelName: highestLevel?.name,
        levelCount: sortedLevels.length,
        nextLevelName: nextLevel?.name,
    };
}
export function createMembershipWorkspaceManifest({ description = "Membership workspace for plan levels, benefit comparison, and premium upgrade routing.", host, id = "sdkwork-membership", packageNames = ["@sdkwork/membership-pc-membership"], routePath = "/memberships", theme, title = "Membership", } = {}) {
    return {
        ...createSdkworkAppCapabilityManifest({
            description,
            host,
            id,
            packageNames,
            theme,
            title,
        }),
        capability: "membership",
        routePath: normalizeBasePath(routePath),
    };
}
export function resolveSdkworkMembershipPurchaseMode({ plan, summary, }) {
    if (!summary.isMember) {
        return "purchase";
    }
    const remainingDays = summary.remainingDays ?? Number.POSITIVE_INFINITY;
    const durationDays = plan?.durationDays ?? 0;
    return remainingDays <= Math.max(30, Math.ceil(durationDays * 0.2)) ? "renew" : "upgrade";
}
function normalizeCheckoutBasePath(basePath) {
    const normalized = (basePath ?? "/checkout").trim();
    if (!normalized || normalized === "/") {
        return "/checkout";
    }
    return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}
export function createMembershipCheckoutSourceId(plan, mode = "purchase") {
    const base = `membership-plan-${plan.id}`;
    return mode === "purchase" ? base : `${base}-${mode}`;
}
export function createMembershipCheckoutRouteIntent(options) {
    const basePath = normalizeCheckoutBasePath(options.basePath);
    const mode = options.mode ?? "purchase";
    const sourceId = createMembershipCheckoutSourceId(options.plan, mode);
    const queryParams = new URLSearchParams({
        kind: "subscription",
        mode,
        packageId: String(options.plan.packageId),
        sourceId,
    });
    return {
        focusWindow: options.focusWindow !== false,
        kind: "subscription",
        mode,
        route: `${basePath}?${queryParams.toString()}`,
        source: "membership-workspace",
        sourceId,
        type: "membership-checkout-route-intent",
    };
}
export function createMembershipRouteIntent(options = {}) {
    const basePath = normalizeBasePath(options.basePath);
    const queryParams = new URLSearchParams();
    if (options.sectionId) {
        queryParams.set("section", options.sectionId);
    }
    const querySuffix = queryParams.toString() ? `?${queryParams.toString()}` : "";
    return {
        focusWindow: options.focusWindow !== false,
        route: `${basePath}${querySuffix}`,
        ...(options.sectionId ? { sectionId: options.sectionId } : {}),
        source: "membership-workspace",
        type: "membership-route-intent",
    };
}
export const membershipPackageMeta = {
    architecture: "pc-react",
    domain: "commerce",
    package: "@sdkwork/membership-pc-membership",
    status: "ready",
};
//# sourceMappingURL=membership.js.map