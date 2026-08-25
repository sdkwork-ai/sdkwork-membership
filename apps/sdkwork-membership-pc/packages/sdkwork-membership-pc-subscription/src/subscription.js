import { createSdkworkAppCapabilityManifest, } from "@sdkwork/appbase-pc-react";
import { estimateSdkworkCouponDiscountAmount, } from "@sdkwork/promotion-pc-coupon";
export function resolveAvailableSubscriptionActions(summary) {
    return summary.isMember ? ["renew", "upgrade"] : ["purchase"];
}
export function isSdkworkSubscriptionActionAllowed(summary, action) {
    return resolveAvailableSubscriptionActions(summary).includes(action);
}
function normalizeBasePath(basePath) {
    const normalized = (basePath ?? "/subscription").trim();
    if (!normalized || normalized === "/") {
        return "/subscription";
    }
    return normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}
function toSafeNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
function sortPaymentMethods(methods) {
    return [...methods].sort((left, right) => Number(right.available) - Number(left.available)
        || Number(right.recommended) - Number(left.recommended)
        || left.label.localeCompare(right.label));
}
function findPaymentMethodByCode(methods, paymentMethodCode) {
    const normalizedCode = String(paymentMethodCode || "").trim().toUpperCase();
    const normalizedSubmitMethod = resolveSdkworkSubscriptionPaymentMethod(paymentMethodCode);
    if (!normalizedCode && !normalizedSubmitMethod) {
        return null;
    }
    return methods.find((method) => {
        const methodCode = method.code.trim().toUpperCase();
        return methodCode === normalizedCode || method.paymentMethod === normalizedSubmitMethod;
    }) ?? null;
}
function resolvePaymentMethodDescription(recommendedProductType) {
    if (recommendedProductType === "native" || recommendedProductType === "jsapi" || recommendedProductType === "miniapp") {
        return "Scan to pay";
    }
    if (recommendedProductType === "pc" || recommendedProductType === "online_bank") {
        return "Desktop payment";
    }
    if (recommendedProductType === "app" || recommendedProductType === "h5") {
        return "Open in payment app";
    }
    return undefined;
}
function createSubscriptionPaymentMethodOption(option) {
    return {
        ...option,
        description: option.description ?? resolvePaymentMethodDescription(option.recommendedProductType),
    };
}
export function createDefaultSdkworkSubscriptionPaymentMethodOptions() {
    return sortPaymentMethods([
        createSubscriptionPaymentMethodOption({
            available: true,
            code: "WECHAT_PAY",
            id: "wechat-pay",
            kind: "qr",
            label: "WeChat Pay",
            paymentMethod: "WECHAT",
            productTypes: [
                {
                    available: true,
                    code: "native",
                    label: "Native",
                },
            ],
            recommended: true,
            recommendedProductType: "native",
        }),
        createSubscriptionPaymentMethodOption({
            available: true,
            code: "ALIPAY",
            id: "alipay-pay",
            kind: "qr",
            label: "Alipay",
            paymentMethod: "ALIPAY",
            productTypes: [
                {
                    available: true,
                    code: "pc",
                    label: "PC Web",
                },
            ],
            recommended: false,
            recommendedProductType: "pc",
        }),
    ]);
}
export function resolveSdkworkSubscriptionPaymentMethod(paymentMethodCode) {
    const normalizedCode = String(paymentMethodCode || "").trim().toUpperCase();
    if (normalizedCode === "ALIPAY") {
        return "ALIPAY";
    }
    if (normalizedCode === "WECHAT" || normalizedCode === "WECHAT_PAY") {
        return "WECHAT";
    }
    return null;
}
export function resolveSdkworkSubscriptionPaymentMethodOption(methods, selectedPaymentMethodId) {
    const availableMethods = sortPaymentMethods(methods).filter((method) => method.available);
    if (selectedPaymentMethodId) {
        return availableMethods.find((method) => method.id === selectedPaymentMethodId) ?? null;
    }
    return availableMethods.find((method) => method.recommended) ?? availableMethods[0] ?? null;
}
export function estimateSdkworkSubscriptionCheckout({ action, coupon, paymentMethodCode, paymentMethodId, plan, }) {
    const fallbackPaymentMethods = createDefaultSdkworkSubscriptionPaymentMethodOptions();
    const resolvedPaymentMethod = paymentMethodId
        ? resolveSdkworkSubscriptionPaymentMethodOption(fallbackPaymentMethods, paymentMethodId)
        : findPaymentMethodByCode(fallbackPaymentMethods, paymentMethodCode)
            ?? resolveSdkworkSubscriptionPaymentMethodOption(fallbackPaymentMethods, null);
    const originalAmountCny = Math.max(toSafeNumber(plan?.priceCny), 0);
    const discountAmountCny = originalAmountCny > 0
        ? estimateSdkworkCouponDiscountAmount(originalAmountCny, coupon
            ? {
                ...coupon,
                discountAmountCny: coupon.discountAmountCny ?? coupon.amountCny ?? null,
            }
            : null)
        : 0;
    const payableAmountCny = Math.max(0, Math.round((originalAmountCny - discountAmountCny) * 100) / 100);
    return {
        action,
        discountAmountCny,
        originalAmountCny,
        payableAmountCny,
        selectedCouponId: coupon?.id ?? null,
        selectedPackageId: plan?.packageId ?? null,
        selectedPaymentMethodCode: paymentMethodCode ?? resolvedPaymentMethod?.code ?? null,
        selectedPaymentMethodId: paymentMethodId ?? resolvedPaymentMethod?.id ?? null,
    };
}
export function createSubscriptionWorkspaceManifest({ description = "Subscription workspace for premium membership checkout, coupon application, and renewal routing.", host, id = "sdkwork-subscription", packageNames = [
    "@sdkwork/membership-pc-subscription",
    "@sdkwork/promotion-pc-coupon",
    "@sdkwork/membership-pc-membership",
    "@sdkwork/account-pc-wallet",
], routePath = "/subscription", theme, title = "Subscription", } = {}) {
    return {
        ...createSdkworkAppCapabilityManifest({
            description,
            host,
            id,
            packageNames,
            theme,
            title,
        }),
        capability: "subscription",
        routePath: normalizeBasePath(routePath),
    };
}
export function createSubscriptionRouteIntent(options = {}) {
    const basePath = normalizeBasePath(options.basePath);
    const queryParams = new URLSearchParams();
    if (options.mode) {
        queryParams.set("mode", options.mode);
    }
    if (typeof options.packageId === "number" && Number.isFinite(options.packageId)) {
        queryParams.set("packageId", String(options.packageId));
    }
    const querySuffix = queryParams.toString() ? `?${queryParams.toString()}` : "";
    return {
        focusWindow: options.focusWindow !== false,
        ...(options.mode ? { mode: options.mode } : {}),
        ...(typeof options.packageId === "number" && Number.isFinite(options.packageId)
            ? { packageId: options.packageId }
            : {}),
        route: `${basePath}${querySuffix}`,
        source: "subscription-workspace",
        type: "subscription-route-intent",
    };
}
export const subscriptionPackageMeta = {
    architecture: "pc-react",
    domain: "membership",
    package: "@sdkwork/membership-pc-subscription",
    status: "ready",
};
//# sourceMappingURL=subscription.js.map