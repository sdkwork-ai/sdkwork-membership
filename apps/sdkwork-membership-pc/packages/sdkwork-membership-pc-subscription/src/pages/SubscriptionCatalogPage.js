import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LoadingBlock, StatusNotice } from "@sdkwork/ui-pc-react";
import { hasSdkworkMembershipSession } from "@sdkwork/membership-service";
import { SubscriptionCatalogHero } from "../components/subscription-catalog-hero";
import { SubscriptionCatalogPlanGrid } from "../components/subscription-catalog-plan-grid";
import { SubscriptionCatalogTierCompare } from "../components/subscription-catalog-tier-compare";
import { sdkworkSubscriptionCatalogHostComponents } from "../components/subscription-catalog-host-components";
import { useSdkworkSubscriptionIntl } from "../subscription-intl";
import { useSdkworkSubscriptionCatalogController, useSdkworkSubscriptionCatalogControllerState, } from "../subscription-catalog-controller";
import { SDKWORK_SUBSCRIPTION_CATALOG_UNAVAILABLE_TIER_KEY, } from "../subscription-catalog-host";
/** A no-op component used when no `notifyOutlet` prop is supplied. */
function EmptyNotifyOutlet() {
    return null;
}
function redirectToDefaultLogin() {
    if (typeof window === "undefined") {
        return;
    }
    const { pathname, search, hash } = window.location;
    // Already on the auth surface: re-wrapping the whole current URL would nest
    // the redirect param one level deeper on every bounce. Stay put instead.
    if (pathname === "/auth" || pathname.startsWith("/auth/")) {
        return;
    }
    const returnPath = `${pathname}${search}${hash}`;
    window.location.assign(`/auth/login?redirect=${encodeURIComponent(returnPath || "/")}`);
}
export function SdkworkSubscriptionCatalogPage({ catalogController: catalogControllerProp, checkoutPort, components, memberSummary: memberSummaryProp, notifyOutlet: NotifyOutletProp, onLoginRequired, onMembershipTierUpdated, onNotify, }) {
    const { t } = useTranslation();
    const { copy } = useSdkworkSubscriptionIntl();
    // Use provided host components or fall back to built-in defaults so the
    // page works with zero configuration: <SdkworkSubscriptionCatalogPage />
    const hostComponents = components ?? sdkworkSubscriptionCatalogHostComponents;
    const NotifyOutlet = NotifyOutletProp ?? EmptyNotifyOutlet;
    // Stable no-op-safe callback wrappers for when the caller doesn't supply them.
    const handleMembershipTierUpdated = useCallback((membershipTierKey, durationDays) => {
        onMembershipTierUpdated?.(membershipTierKey, durationDays);
    }, [onMembershipTierUpdated]);
    const handleNotify = useCallback((message, tone) => {
        if (onNotify) {
            onNotify(message, tone);
        }
        else if (tone === "error") {
            // eslint-disable-next-line no-console
            console.error(`[subscription-catalog] ${message}`);
        }
    }, [onNotify]);
    const { checkoutModal: CheckoutModal, pointsDetailsModal: PointsDetailsModal, pointsPurchaseModal: PointsPurchaseModal, redeemModal: RedeemModal, } = hostComponents;
    const controller = useSdkworkSubscriptionCatalogController(catalogControllerProp, {
        checkoutPort,
        translate: (key, defaultValue) => String(t(key, defaultValue ?? key)),
    });
    const state = useSdkworkSubscriptionCatalogControllerState(controller);
    const [isPointsModalOpen, setIsPointsModalOpen] = useState(false);
    const [isPointsDetailsModalOpen, setIsPointsDetailsModalOpen] = useState(false);
    const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);
    const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
    const pendingPurchaseRef = useRef(null);
    const completedPaymentKeyRef = useRef(null);
    const memberSummary = memberSummaryProp ?? state.memberSummary;
    const handleLoginRequired = onLoginRequired ?? redirectToDefaultLogin;
    useEffect(() => {
        if (!state.isBootstrapped && !state.isLoading) {
            void controller.bootstrap().catch(() => undefined);
        }
    }, [controller, state.isBootstrapped, state.isLoading]);
    function openCheckoutForPlan(packageId, membershipTierKey, packageName, priceLabel, packageNumericId, originalPriceLabel, packagePeriodLabel = "年") {
        if (!hasSdkworkMembershipSession()) {
            handleLoginRequired();
            return;
        }
        if (packageNumericId <= 0) {
            handleNotify(t("plan_unavailable_to_purchase", "该套餐暂时无法购买，请稍后重试。"), "error");
            return;
        }
        if (membershipTierKey === SDKWORK_SUBSCRIPTION_CATALOG_UNAVAILABLE_TIER_KEY
            || memberSummary?.membershipTierKey === membershipTierKey) {
            return;
        }
        const checkoutPlan = {
            id: packageId,
            membershipTierKey,
            name: packageName,
            originalPrice: originalPriceLabel,
            packageNumericId,
            packagePeriodLabel,
            priceLabel,
        };
        controller.selectCheckoutPlan(checkoutPlan);
        pendingPurchaseRef.current = null;
        completedPaymentKeyRef.current = null;
        setIsCheckoutModalOpen(true);
    }
    function handlePlanCardSelect(plan) {
        if (plan.packageNumericId <= 0) {
            handleNotify(t("plan_unavailable_to_purchase", "该套餐暂时无法购买，请稍后重试。"), "error");
            return;
        }
        openCheckoutForPlan(plan.id, plan.membershipTierKey, plan.name, plan.priceLabel, plan.packageNumericId, plan.originalPriceLabel || undefined, plan.packagePeriodLabel);
    }
    function openPointsPurchase() {
        setIsPointsModalOpen(true);
    }
    async function handleCheckoutPurchase() {
        const selectedCheckoutPlan = state.selectedCheckoutPlan;
        if (!selectedCheckoutPlan) {
            throw new Error("No subscription plan has been selected.");
        }
        try {
            const result = await controller.purchaseSelectedPlan();
            pendingPurchaseRef.current = result;
            return result;
        }
        catch (error) {
            handleNotify(error instanceof Error ? error.message : t("subscription_failed", "订阅失败，请稍后重试。"), "error");
            throw error;
        }
    }
    async function handleCheckoutPaymentStatus(orderId) {
        return controller.getPurchaseStatus(orderId);
    }
    async function handleCheckoutPaymentCompleted(payment) {
        if (payment.status !== "completed") {
            return;
        }
        const selectedCheckoutPlan = state.selectedCheckoutPlan;
        const paymentKey = payment.orderId ?? selectedCheckoutPlan?.id;
        if (!selectedCheckoutPlan || !paymentKey || completedPaymentKeyRef.current === paymentKey) {
            return;
        }
        completedPaymentKeyRef.current = paymentKey;
        handleMembershipTierUpdated(selectedCheckoutPlan.membershipTierKey, pendingPurchaseRef.current?.durationDays ?? 365);
        handleNotify(t("subscription_success", "订阅成功！"), "success");
        await controller.refresh();
    }
    function closeCheckoutModal() {
        pendingPurchaseRef.current = null;
        completedPaymentKeyRef.current = null;
        setIsCheckoutModalOpen(false);
        controller.clearCheckoutPlan();
    }
    return (_jsxs("div", { className: "w-full pb-20 font-sans", children: [_jsx(NotifyOutlet, {}), _jsx(CheckoutModal, { isOpen: isCheckoutModalOpen, onClose: closeCheckoutModal, onPaymentCompleted: handleCheckoutPaymentCompleted, onPaymentStatus: handleCheckoutPaymentStatus, onPurchase: handleCheckoutPurchase, plan: state.selectedCheckoutPlan }), state.isLoading && !state.isBootstrapped ? (_jsx("div", { className: "px-6 py-12", children: _jsx(LoadingBlock, { label: t("loading_catalog", "正在加载套餐信息...") }) })) : null, state.lastError && state.catalog === null && !state.isLoading ? (_jsxs("div", { className: "px-6 py-12", children: [_jsx(StatusNotice, { title: t("load_failed", "加载失败"), tone: "danger", children: state.lastError }), _jsx("div", { className: "mt-4 text-center", children: _jsx("button", { className: "rounded-lg bg-zinc-900 px-6 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100", onClick: () => {
                                void controller.retry().catch(() => undefined);
                            }, type: "button", children: t("retry", "重试") }) })] })) : null, state.isBootstrapped && state.catalog !== null ? (_jsxs(_Fragment, { children: [_jsx(SubscriptionCatalogHero, { billingCycleIndex: state.billingCycleIndex, billingCycles: state.billingCycles, onOpenPointsDetails: () => setIsPointsDetailsModalOpen(true), onOpenPointsPurchase: openPointsPurchase, onOpenRedeem: () => setIsRedeemModalOpen(true), onSelectBillingCycle: (index) => {
                            controller.selectBillingCycle(index);
                        }, subtitleLead: t("choose_suitable_plan", "选择合适你的套餐，或直接"), subtitlePointsActionLabel: t("buy_points", "购买算力积分"), subtitleRedeemActionLabel: t("redeem_vip", "会员兑换"), title: t("unlock_infinite", "订阅特权，解锁无尽竞技能力") }), _jsx(SubscriptionCatalogPlanGrid, { onSelectPlan: handlePlanCardSelect, plans: state.planCards }), _jsxs("div", { className: "flex items-center justify-center gap-2 py-1", children: [_jsx("span", { className: "inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-500/10 dark:text-sky-300", children: copy.catalog.categoryToken }), _jsx("span", { className: "text-xs text-slate-400 dark:text-slate-500", children: copy.catalog.categoryLabel })] }), _jsx(SubscriptionCatalogTierCompare, { billingCycleIndex: state.billingCycleIndex, billingCycles: state.billingCycles, comingSoonLabel: t("coming_soon", "敬请期待"), comparisonCategories: state.comparisonCategories, currentPlanLabel: t("current_plan", "当前计划"), firstYear58Label: t("first_year_58", "首年5.8折"), firstYear60Label: t("first_year_60", "首年6折"), onSelectBillingCycle: (index) => {
                            controller.selectBillingCycle(index);
                        }, onSelectPackage: (packageId, membershipTierKey, packageName, priceLabel, originalPriceLabel, packagePeriodLabel) => {
                            const tierColumn = state.tierColumns.find((column) => column.packageId === packageId);
                            if (!tierColumn) {
                                return;
                            }
                            openCheckoutForPlan(packageId, membershipTierKey, packageName, priceLabel, tierColumn.packageNumericId, originalPriceLabel, packagePeriodLabel);
                        }, perMonthShortLabel: t("per_month_short", "每月"), perYearShortLabel: t("per_year_short", "每年"), premiumPlanLabel: t("premium_plan", "高级会员"), sectionTitle: t("which_plan_suits_you", "哪个计划更适合你"), standardPlanLabel: t("standard_plan", "标准会员"), superPlanLabel: t("super_plan", "超级会员"), tierColumns: state.tierColumns, basicPlanLabel: t("basic_plan", "基础会员") }), _jsx(PointsPurchaseModal, { currentPoints: memberSummaryProp?.pointBalance ?? null, isOpen: isPointsModalOpen, onClose: () => setIsPointsModalOpen(false) }), _jsx(PointsDetailsModal, { isOpen: isPointsDetailsModalOpen, onClose: () => setIsPointsDetailsModalOpen(false) }), _jsx(RedeemModal, { isOpen: isRedeemModalOpen, onClose: () => setIsRedeemModalOpen(false) })] })) : null] }));
}
//# sourceMappingURL=SubscriptionCatalogPage.js.map