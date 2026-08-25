import { createSdkworkMembershipListQuery, getSdkworkMembershipService, requireSdkworkMembershipSession, toNullableSdkworkMembershipNumber, toSdkworkMembershipNumber, toSdkworkMembershipOptionalString, unwrapSdkworkMembershipPageItems, } from "@sdkwork/membership-service";
import { createSdkworkCouponService, normalizeSdkworkRemoteUserCoupon, sortSdkworkUserCoupons, } from "@sdkwork/promotion-pc-coupon";
import { createSdkworkMembershipService, } from "@sdkwork/membership-pc-membership";
import { createDefaultSdkworkSubscriptionPaymentMethodOptions, estimateSdkworkSubscriptionCheckout, resolveSdkworkSubscriptionPaymentMethod, resolveSdkworkSubscriptionPaymentMethodOption, } from "./subscription";
import { createSdkworkSubscriptionMessages, } from "./subscription-copy";
function mapPackageToPlan(pkg) {
    const packageId = toSdkworkMembershipNumber(pkg.id);
    return {
        description: toSdkworkMembershipOptionalString(pkg.description),
        durationDays: toNullableSdkworkMembershipNumber(pkg.durationDays),
        id: `membership-package-${packageId}`,
        includedPoints: toSdkworkMembershipNumber(pkg.pointAmount),
        levelName: toSdkworkMembershipOptionalString(pkg.levelName ?? pkg.planName),
        name: toSdkworkMembershipOptionalString(pkg.name) || "Membership package",
        originalPriceCny: toNullableSdkworkMembershipNumber(pkg.originalPrice),
        packageId,
        priceCny: toSdkworkMembershipNumber(pkg.price),
        recommended: Boolean(pkg.recommended),
        tags: Array.isArray(pkg.tags)
            ? pkg.tags.map((tag) => tag.trim()).filter(Boolean)
            : [],
    };
}
function normalizeSdkworkSubscriptionCoupon(coupon, index) {
    const normalized = normalizeSdkworkRemoteUserCoupon(coupon, index);
    return {
        ...normalized,
        discountAmountCny: normalized.amountCny,
    };
}
function mapAvailableCoupon(coupon) {
    return {
        ...coupon,
        discountAmountCny: coupon.amountCny,
    };
}
function sortPlansForSubscription(plans) {
    return [...plans].sort((left, right) => Number(right.recommended) - Number(left.recommended)
        || right.includedPoints - left.includedPoints
        || left.priceCny - right.priceCny
        || left.id.localeCompare(right.id));
}
function mapPackageGroup(group) {
    const packageGroupId = toSdkworkMembershipNumber(group.id);
    return {
        description: group.description,
        id: `membership-package-group-${packageGroupId}`,
        name: group.name || "Subscription",
        packageGroupId,
        packages: Array.isArray(group.packages) ? group.packages.map(mapPackageToPlan) : [],
        sortWeight: toSdkworkMembershipNumber(group.sortWeight),
    };
}
function sortPackageGroups(groups) {
    return [...groups].sort((left, right) => left.sortWeight - right.sortWeight || left.name.localeCompare(right.name));
}
function resolveDefaultAction(summary) {
    return summary.isMember ? "upgrade" : "purchase";
}
function resolveDefaultPlan(plans) {
    return plans.find((plan) => plan.recommended) ?? plans[0] ?? null;
}
function resolveBestCoupon(coupons, plan, action) {
    if (!plan) {
        return null;
    }
    return coupons
        .filter((coupon) => coupon.status === "available")
        .map((coupon) => ({
        coupon,
        discountAmountCny: estimateSdkworkSubscriptionCheckout({
            action,
            coupon,
            plan,
        }).discountAmountCny,
    }))
        .filter((item) => item.discountAmountCny > 0)
        .sort((left, right) => right.discountAmountCny - left.discountAmountCny
        || toSdkworkMembershipNumber(left.coupon.remainingDays, Number.MAX_SAFE_INTEGER) - toSdkworkMembershipNumber(right.coupon.remainingDays, Number.MAX_SAFE_INTEGER)
        || left.coupon.name.localeCompare(right.coupon.name))[0]?.coupon ?? null;
}
function resolvePaymentMethodKind(method) {
    if (method.recommendedProductType === "native" || method.recommendedProductType === "jsapi" || method.recommendedProductType === "miniapp") {
        return "qr";
    }
    if (method.recommendedProductType === "online_bank"
        || method.code.includes("UNION")
        || method.code.includes("CARD")) {
        return "card";
    }
    if (method.recommendedProductType === "app"
        || method.recommendedProductType === "h5"
        || method.code.includes("WALLET")) {
        return "wallet";
    }
    if (method.productTypes.some((productType) => productType.code === "native")) {
        return "qr";
    }
    return "other";
}
function resolvePaymentMethodDescription(method) {
    if (method.recommendedProductType === "native" || method.recommendedProductType === "jsapi" || method.recommendedProductType === "miniapp") {
        return "Scan to pay";
    }
    if (method.recommendedProductType === "pc" || method.recommendedProductType === "online_bank") {
        return "Desktop payment";
    }
    if (method.recommendedProductType === "app" || method.recommendedProductType === "h5") {
        return "Open in payment app";
    }
    return undefined;
}
function mapPaymentMethod(method, options) {
    const paymentMethod = method.paymentMethod ?? resolveSdkworkSubscriptionPaymentMethod(method.code);
    if (!paymentMethod) {
        return null;
    }
    const sourceSort = typeof method.sort === "number" && Number.isFinite(method.sort)
        ? method.sort
        : 0;
    return {
        available: method.available !== false,
        code: method.code,
        description: method.description ?? resolvePaymentMethodDescription(method),
        id: method.id,
        kind: method.kind ?? resolvePaymentMethodKind(method),
        label: method.label,
        paymentMethod,
        productTypes: [...method.productTypes],
        recommended: method.recommended ?? sourceSort >= options.recommendedSort,
        recommendedProductType: method.recommendedProductType,
    };
}
function resolvePaymentMethods(methods) {
    const supportedMethods = methods.filter((method) => resolveSdkworkSubscriptionPaymentMethod(method.code));
    const recommendedSort = supportedMethods
        .filter((method) => method.available !== false)
        .reduce((highest, method) => Math.max(highest, typeof method.sort === "number" && Number.isFinite(method.sort) ? method.sort : 0), Number.NEGATIVE_INFINITY);
    const mappedMethods = supportedMethods
        .map((method) => mapPaymentMethod(method, {
        recommendedSort: Number.isFinite(recommendedSort)
            ? recommendedSort
            : typeof method.sort === "number" && Number.isFinite(method.sort)
                ? method.sort
                : 0,
    }))
        .filter((method) => Boolean(method))
        .sort((left, right) => Number(right.available) - Number(left.available)
        || Number(right.recommended) - Number(left.recommended)
        || left.label.localeCompare(right.label));
    return mappedMethods.length > 0
        ? mappedMethods
        : createDefaultSdkworkSubscriptionPaymentMethodOptions();
}
export function createSdkworkSubscriptionPaymentMethodService() {
    function getEmptyDashboard() {
        return {
            methods: createDefaultSdkworkSubscriptionPaymentMethodOptions(),
        };
    }
    return {
        async getDashboard() {
            return getEmptyDashboard();
        },
        getEmptyDashboard,
    };
}
function createDashboard(membershipDashboard, coupons, paymentMethods, packageGroups = []) {
    const action = resolveDefaultAction(membershipDashboard.summary);
    const allPlansFromGroups = packageGroups.flatMap((g) => g.packages);
    const existingPlanIds = new Set(membershipDashboard.plans.map((p) => p.packageId));
    const additionalPlans = allPlansFromGroups
        .filter((p) => !existingPlanIds.has(p.packageId))
        .map((p) => ({
        description: p.description ?? undefined,
        durationDays: p.durationDays ?? null,
        id: p.id,
        includedPoints: p.includedPoints,
        levelName: p.levelName,
        name: p.name,
        originalPriceCny: p.originalPriceCny ?? null,
        packageId: p.packageId,
        priceCny: p.priceCny,
        recommended: p.recommended,
        tags: p.tags,
    }));
    const mergedPlans = sortPlansForSubscription([...membershipDashboard.plans, ...additionalPlans]);
    const plan = resolveDefaultPlan(mergedPlans);
    const coupon = resolveBestCoupon(coupons, plan, action);
    const selectedPaymentMethod = resolveSdkworkSubscriptionPaymentMethodOption(paymentMethods, null);
    return {
        benefits: membershipDashboard.benefits,
        checkout: estimateSdkworkSubscriptionCheckout({
            action,
            coupon,
            paymentMethodCode: selectedPaymentMethod?.code ?? null,
            paymentMethodId: selectedPaymentMethod?.id ?? null,
            plan,
        }),
        coupons: [...coupons],
        levels: membershipDashboard.levels,
        packageGroups: sortPackageGroups([...packageGroups]),
        paymentMethods: [...paymentMethods],
        plans: mergedPlans,
        summary: membershipDashboard.summary,
    };
}
function createEmptyDashboard(membershipService) {
    return createDashboard(membershipService.getEmptyDashboard(), [], createDefaultSdkworkSubscriptionPaymentMethodOptions(), []);
}
async function runMembershipMutation(membershipService, name, payload) {
    return name === "memberships.purchase"
        ? membershipService.purchaseMembership(payload)
        : name === "memberships.renew"
            ? membershipService.renewMembership(payload)
            : membershipService.upgradeMembership(payload);
}
export function createSdkworkSubscriptionService(options = {}) {
    const copy = createSdkworkSubscriptionMessages(options.locale, options.messages);
    const resolveMembershipAppService = () => {
        if (options.membershipAppService)
            return options.membershipAppService;
        return getSdkworkMembershipService();
    };
    const membershipService = options.membershipService
        ? {
            ...createSdkworkMembershipService({
                checkoutPort: options.checkoutPort,
                membershipAppService: options.membershipAppService,
                locale: options.locale,
            }),
            ...options.membershipService,
        }
        : createSdkworkMembershipService({
            checkoutPort: options.checkoutPort,
            membershipAppService: options.membershipAppService,
            locale: options.locale,
        });
    const couponService = options.couponService ?? createSdkworkCouponService({
        promotionAppService: options.promotionAppService,
        locale: options.locale,
    });
    const paymentMethodService = options.paymentMethodService
        ? {
            ...createSdkworkSubscriptionPaymentMethodService(),
            ...options.paymentMethodService,
        }
        : createSdkworkSubscriptionPaymentMethodService();
    async function fetchPackageGroups() {
        try {
            const membershipAppService = resolveMembershipAppService();
            const payload = await membershipAppService.memberships.packageGroups.list(createSdkworkMembershipListQuery(1, 200, "token"));
            const groups = unwrapSdkworkMembershipPageItems(payload);
            return sortPackageGroups(groups.map(mapPackageGroup));
        }
        catch {
            return [];
        }
    }
    return {
        async getDashboard() {
            const [membershipDashboard, packageGroups] = await Promise.all([
                membershipService.getDashboard(),
                fetchPackageGroups(),
            ]);
            if (!membershipDashboard.summary.isAuthenticated) {
                return createDashboard(membershipDashboard, [], createDefaultSdkworkSubscriptionPaymentMethodOptions(), packageGroups);
            }
            const [couponDashboard, paymentDashboard] = await Promise.all([
                couponService.getDashboard(),
                paymentMethodService.getDashboard(),
            ]);
            const coupons = sortSdkworkUserCoupons(couponDashboard.availableCoupons.map(mapAvailableCoupon));
            const paymentMethods = resolvePaymentMethods(paymentDashboard.methods);
            return createDashboard(membershipDashboard, coupons, paymentMethods, packageGroups);
        },
        getEmptyDashboard() {
            return createEmptyDashboard(membershipService);
        },
        async getPurchaseStatus(orderId) {
            requireSdkworkMembershipSession(copy.service.signInRequired);
            return membershipService.getPurchaseStatus(orderId);
        },
        async purchaseSubscription(input) {
            requireSdkworkMembershipSession(copy.service.signInRequired);
            return runMembershipMutation(membershipService, "memberships.purchase", input);
        },
        async renewSubscription(input) {
            requireSdkworkMembershipSession(copy.service.signInRequired);
            return runMembershipMutation(membershipService, "memberships.renew", input);
        },
        async upgradeSubscription(input) {
            requireSdkworkMembershipSession(copy.service.signInRequired);
            return runMembershipMutation(membershipService, "memberships.upgrade", input);
        },
    };
}
//# sourceMappingURL=subscription-service.js.map