import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useMemo, } from "react";
import { formatSdkworkMembershipCurrencyCny as formatSdkworkCurrencyCny, formatSdkworkMembershipPoints as formatSdkworkPoints, } from "@sdkwork/membership-service";
import { createSdkworkSubscriptionMessages, normalizeSdkworkSubscriptionLocale, } from "./subscription-copy";
function formatTemplate(template, values) {
    return Object.entries(values).reduce((output, [key, value]) => output.replaceAll(`{${key}}`, String(value)), template);
}
function resolveProductTypeCode(method) {
    const availableType = method.productTypes.find((productType) => productType.available);
    return String(availableType?.code ?? method.recommendedProductType ?? "").trim().toLowerCase();
}
function createSdkworkSubscriptionIntlValue(locale, overrides) {
    const resolvedLocale = normalizeSdkworkSubscriptionLocale(locale);
    const copy = createSdkworkSubscriptionMessages(resolvedLocale, overrides);
    function formatCurrency(value) {
        return formatSdkworkCurrencyCny(value, resolvedLocale);
    }
    function formatPointsValue(value) {
        return formatSdkworkPoints(value, resolvedLocale);
    }
    return {
        copy,
        formatCouponAvailability(coupon) {
            if (coupon.remainingDays) {
                return formatTemplate(copy.format.couponDaysLeft, {
                    count: coupon.remainingDays,
                    days: copy.common.days,
                });
            }
            return coupon.status
                ? (copy.status[coupon.status] ?? coupon.status)
                : copy.status.available;
        },
        formatCouponCount(couponCount) {
            return formatTemplate(couponCount === 1 ? copy.format.couponCountReadySingular : copy.format.couponCountReadyPlural, {
                count: couponCount,
            });
        },
        formatCouponMinimumSpend(minimumSpendCny) {
            return minimumSpendCny
                ? resolvedLocale === "zh-CN"
                    ? `${copy.couponList.minSpendLabel}${formatCurrency(minimumSpendCny)}`
                    : `${copy.couponList.minSpendLabel} ${formatCurrency(minimumSpendCny)}`
                : copy.couponList.noMinimumSpend;
        },
        formatCouponOffer(coupon) {
            const fixedDiscountCny = coupon.amountCny ?? coupon.discountAmountCny ?? null;
            if (fixedDiscountCny) {
                return `- ${formatCurrency(fixedDiscountCny)}`;
            }
            if (coupon.discountRate) {
                return formatTemplate(copy.format.discountRate, {
                    value: coupon.discountRate,
                });
            }
            return copy.couponList.offerFallback;
        },
        formatCurrencyCny: formatCurrency,
        formatCurrentBalance(points) {
            return `${copy.planGrid.currentBalanceLabel} ${formatPointsValue(points)} ${copy.common.points}`;
        },
        formatCurrentLevelMeta(summary) {
            return summary.remainingDays
                ? formatTemplate(copy.format.currentLevelRemaining, {
                    count: summary.remainingDays,
                    days: copy.common.days,
                })
                : copy.hero.readyForPremiumActivation;
        },
        formatDurationDays(durationDays) {
            return durationDays
                ? `${durationDays} ${copy.common.days}`
                : copy.common.flexibleDuration;
        },
        formatPaymentMethodDescription(method) {
            if (method.recommendedProductType === "native" || method.recommendedProductType === "jsapi" || method.recommendedProductType === "miniapp") {
                return copy.paymentMethods.scanToPay;
            }
            if (method.recommendedProductType === "pc" || method.recommendedProductType === "online_bank") {
                return copy.paymentMethods.desktopPayment;
            }
            if (method.recommendedProductType === "app" || method.recommendedProductType === "h5") {
                return copy.paymentMethods.openInPaymentApp;
            }
            return method.description;
        },
        formatPaymentMethodLabel(method) {
            const normalizedCode = String(method.code || "").trim().toUpperCase();
            if (normalizedCode === "WECHAT_PAY" || normalizedCode === "WECHAT") {
                return copy.paymentMethods.wechatPayLabel;
            }
            if (normalizedCode === "ALIPAY") {
                return copy.paymentMethods.alipayLabel;
            }
            return method.label;
        },
        formatPaymentMethodSelection(selected) {
            return selected ? copy.paymentMethods.selectedState : copy.paymentMethods.tapToUse;
        },
        formatPaymentProductTypeLabel(method) {
            const productTypeCode = resolveProductTypeCode(method);
            if (productTypeCode === "native" || productTypeCode === "jsapi" || productTypeCode === "miniapp") {
                return copy.paymentMethods.nativeLabel;
            }
            if (productTypeCode === "pc" || productTypeCode === "online_bank") {
                return copy.paymentMethods.pcWebLabel;
            }
            if (productTypeCode === "app" || productTypeCode === "h5") {
                return copy.paymentMethods.appRedirectLabel;
            }
            const availableType = method.productTypes.find((productType) => productType.available);
            return availableType?.label ?? method.recommendedProductType;
        },
        formatPoints: formatPointsValue,
        formatStatus(status) {
            const normalized = String(status || "").trim().toLowerCase();
            return copy.status[normalized] ?? status ?? copy.status.inactive;
        },
        locale: resolvedLocale,
        resolveActionButtonLabel(action) {
            if (action === "renew") {
                return copy.actions.confirmRenewal;
            }
            if (action === "upgrade") {
                return copy.actions.confirmPayment;
            }
            return copy.actions.activateMembership;
        },
        resolveActionLabel(action) {
            if (action === "purchase") {
                return copy.actions.purchase;
            }
            if (action === "renew") {
                return copy.actions.renew;
            }
            return copy.actions.upgrade;
        },
        resolveActionTitle(action) {
            if (action === "renew") {
                return copy.actions.renew;
            }
            if (action === "upgrade") {
                return copy.actions.upgrade;
            }
            return copy.actions.purchase;
        },
    };
}
const DEFAULT_SDKWORK_SUBSCRIPTION_INTL = createSdkworkSubscriptionIntlValue();
const SdkworkSubscriptionIntlContext = createContext(DEFAULT_SDKWORK_SUBSCRIPTION_INTL);
export function SdkworkSubscriptionIntlProvider({ children, locale, messages, }) {
    const value = useMemo(() => createSdkworkSubscriptionIntlValue(locale, messages), [locale, messages]);
    return (_jsx(SdkworkSubscriptionIntlContext.Provider, { value: value, children: children }));
}
export function useSdkworkSubscriptionIntl() {
    return useContext(SdkworkSubscriptionIntlContext);
}
//# sourceMappingURL=subscription-intl.js.map