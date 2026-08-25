import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from "react";
import { Button } from "@sdkwork/ui-pc-react/components/ui/actions";
import { LoadingBlock, StatusNotice, } from "@sdkwork/ui-pc-react/components/ui/feedback";
import { formatSdkworkMembershipCurrencyCny as formatSdkworkCurrencyCny } from "@sdkwork/membership-service";
import { useSdkworkMembershipController, useSdkworkMembershipControllerState, } from "../membership-controller";
import { createMembershipCheckoutRouteIntent, } from "../membership.js";
import { createSdkworkMembershipBackdropStyle, createSdkworkMembershipPanelStyle, createSdkworkMembershipToneStyle, } from "../membership-appearance";
import { SdkworkMembershipIntlProvider, useSdkworkMembershipIntl, } from "../membership-intl";
import { SdkworkMembershipBenefitsGrid } from "../components/membership-benefits-grid";
import { SdkworkMembershipLevelComparison } from "../components/membership-level-comparison";
import { SdkworkMembershipMembershipHero } from "../components/membership-hero";
function resolveMembershipPurchaseFlow(purchaseFlow, onNavigate) {
    if (purchaseFlow === "direct") {
        return "direct";
    }
    if (purchaseFlow === "checkout") {
        return "checkout";
    }
    return onNavigate ? "checkout" : "direct";
}
const MEMBERSHIP_SECTION_IDS = {
    benefits: "membership-section-benefits",
    levels: "membership-section-levels",
    plans: "membership-section-plans",
};
function scrollToMembershipSection(view) {
    const element = document.getElementById(MEMBERSHIP_SECTION_IDS[view]);
    if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
}
function resolveSavingsPercent(price, original) {
    if (original === null || original <= price || original <= 0) {
        return null;
    }
    return Math.round((1 - price / original) * 100);
}
function SdkworkMembershipPageContent({ checkoutBasePath, controller: controllerProp, onNavigate, purchaseFlow, }) {
    const controller = useSdkworkMembershipController(controllerProp);
    const state = useSdkworkMembershipControllerState(controller);
    const { copy, formatDuration, formatIncludedPoints, formatPriceWas, formatSave, locale, } = useSdkworkMembershipIntl();
    const selectedPlan = state.dashboard.plans.find((plan) => plan.packageId === state.selectedPlanId) ?? null;
    const resolvedPurchaseFlow = resolveMembershipPurchaseFlow(purchaseFlow, onNavigate);
    useEffect(() => {
        if (!state.isBootstrapped && !state.isLoading && !state.lastError) {
            void controller.bootstrap().catch(() => undefined);
        }
    }, [controller, state.isBootstrapped, state.isLoading, state.lastError]);
    function navigateToMembershipCheckout(mode) {
        if (!selectedPlan || !onNavigate || resolvedPurchaseFlow !== "checkout") {
            return false;
        }
        onNavigate(createMembershipCheckoutRouteIntent({
            basePath: checkoutBasePath,
            mode,
            plan: selectedPlan,
        }).route);
        return true;
    }
    const sectionTabs = [
        { view: "plans", label: copy.actions.plans },
        { view: "benefits", label: copy.actions.benefits },
        { view: "levels", label: copy.actions.levels },
    ];
    return (_jsxs("div", { className: "relative h-full overflow-y-auto", children: [_jsx("div", { className: "pointer-events-none absolute inset-x-0 top-0 h-72", style: createSdkworkMembershipBackdropStyle() }), _jsx("div", { className: "relative px-4 py-5 sm:px-6 sm:py-6", children: _jsxs("div", { className: "mx-auto max-w-[80rem] space-y-5", children: [_jsx(SdkworkMembershipMembershipHero, { isMutating: state.isMutating, levels: state.dashboard.levels, onPurchase: () => {
                                if (navigateToMembershipCheckout("purchase")) {
                                    return;
                                }
                                void controller.purchaseSelectedPlan();
                            }, onRenew: () => {
                                if (navigateToMembershipCheckout("renew")) {
                                    return;
                                }
                                void controller.renewSelectedPlan();
                            }, onUpgrade: () => {
                                if (navigateToMembershipCheckout("upgrade")) {
                                    return;
                                }
                                void controller.upgradeSelectedPlan();
                            }, selectedPlan: selectedPlan, summary: state.dashboard.summary }), state.isLoading && !state.isBootstrapped ? _jsx(LoadingBlock, { label: copy.page.loading }) : null, state.lastError ? (_jsx(StatusNotice, { title: copy.page.errorTitle, tone: "danger", children: state.lastError })) : null, _jsxs("nav", { className: "sticky top-0 z-10 flex flex-wrap items-center gap-1.5 rounded-[1.25rem] border border-[var(--sdk-color-border-default)] bg-[var(--sdk-color-surface-panel)] px-3 py-2 shadow-[var(--sdk-shadow-sm)] backdrop-blur-md", children: [sectionTabs.map((tab) => (_jsx("button", { onClick: () => {
                                        controller.setView(tab.view);
                                        scrollToMembershipSection(tab.view);
                                    }, type: "button", className: `rounded-[0.75rem] px-4 py-1.5 text-sm font-medium transition-colors ${state.activeView === tab.view
                                        ? "bg-[var(--sdk-color-brand-primary)] text-white"
                                        : "text-[var(--sdk-color-text-secondary)] hover:bg-[var(--sdk-color-surface-panel-muted)] hover:text-[var(--sdk-color-text-primary)]"}`, children: tab.label }, tab.view))), _jsx("div", { className: "ml-auto", children: _jsx(Button, { onClick: () => void controller.refresh(), type: "button", variant: "ghost", size: "sm", children: copy.actions.refresh }) })] }), _jsxs("section", { id: MEMBERSHIP_SECTION_IDS.plans, className: "scroll-mt-24 rounded-[1.5rem] border border-[var(--sdk-color-border-default)] bg-[var(--sdk-color-surface-panel)] shadow-[var(--sdk-shadow-sm)]", children: [_jsxs("div", { className: "border-b border-[var(--sdk-color-border-subtle)] px-6 py-5", children: [_jsx("div", { className: "text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sdk-color-text-muted)]", children: copy.plans.eyebrow }), _jsx("h2", { className: "mt-2 text-xl font-semibold text-[var(--sdk-color-text-primary)]", children: copy.plans.title }), _jsx("p", { className: "mt-1.5 text-sm text-[var(--sdk-color-text-secondary)]", children: copy.plans.subtitle })] }), _jsx("div", { className: "grid gap-4 px-6 py-6 lg:grid-cols-3", children: state.dashboard.plans.length === 0 ? (_jsxs("div", { className: "col-span-full rounded-[1.25rem] border border-dashed border-[var(--sdk-color-border-default)] px-5 py-12 text-center", children: [_jsx("div", { className: "text-base font-semibold text-[var(--sdk-color-text-primary)]", children: copy.plans.emptyTitle }), _jsx("div", { className: "mt-2 text-sm text-[var(--sdk-color-text-secondary)]", children: copy.plans.emptyDescription })] })) : state.dashboard.plans.map((plan) => {
                                        const isSelected = plan.packageId === state.selectedPlanId;
                                        const tone = isSelected ? "accent" : plan.recommended ? "brand" : "neutral";
                                        const originalPriceLabel = plan.originalPriceCny !== null && plan.originalPriceCny > plan.priceCny
                                            ? formatPriceWas(formatSdkworkCurrencyCny(plan.originalPriceCny, locale))
                                            : null;
                                        const isAnnual = plan.durationDays !== null && plan.durationDays >= 360;
                                        const savingsPercent = resolveSavingsPercent(plan.priceCny, plan.originalPriceCny);
                                        return (_jsxs("article", { className: `relative flex flex-col rounded-[1.5rem] border bg-[var(--sdk-color-surface-panel-muted)] p-6 ${isSelected ? "ring-2 ring-[var(--sdk-color-brand-accent)]" : ""}`, style: createSdkworkMembershipPanelStyle(tone, {
                                                backgroundWeight: isSelected ? 12 : 8,
                                                borderWeight: isSelected ? 24 : 18,
                                                surfaceColor: "var(--sdk-color-surface-panel-muted)",
                                            }), children: [plan.recommended ? (_jsx("div", { className: "absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border px-4 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.16em] whitespace-nowrap", style: createSdkworkMembershipToneStyle("accent", {
                                                        backgroundWeight: 24,
                                                        borderWeight: 36,
                                                    }), children: copy.plans.popular })) : null, _jsx("div", { className: "text-lg font-semibold text-[var(--sdk-color-text-primary)]", children: plan.name }), _jsx("div", { className: "mt-2 text-sm text-[var(--sdk-color-text-secondary)]", children: plan.description || copy.plans.descriptionFallback }), _jsxs("div", { className: "mt-5 flex items-baseline gap-1.5", children: [_jsx("span", { className: "text-4xl font-semibold tabular-nums text-[var(--sdk-color-text-primary)]", children: formatSdkworkCurrencyCny(plan.priceCny, locale) }), isAnnual ? (_jsx("span", { className: "text-sm text-[var(--sdk-color-text-muted)]", children: copy.common.perYear })) : null] }), _jsxs("div", { className: "mt-1.5 flex items-center gap-2 text-xs", children: [originalPriceLabel ? (_jsx("span", { className: "text-[var(--sdk-color-text-muted)] line-through", children: originalPriceLabel })) : null, savingsPercent !== null ? (_jsx("span", { className: "rounded-full border px-2 py-0.5 font-semibold", style: createSdkworkMembershipToneStyle("success", {
                                                                backgroundWeight: 10,
                                                                borderWeight: 18,
                                                            }), children: formatSave(savingsPercent) })) : null, isAnnual ? (_jsx("span", { className: "text-[var(--sdk-color-text-muted)]", children: copy.common.billedYearly })) : null] }), _jsxs("div", { className: "mt-5 space-y-2.5 rounded-[1rem] border border-[var(--sdk-color-border-subtle)] bg-[var(--sdk-color-surface-panel)] p-4 text-sm", children: [_jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsx("span", { className: "text-[var(--sdk-color-text-muted)]", children: copy.plans.duration }), _jsx("span", { className: "font-medium tabular-nums text-[var(--sdk-color-text-primary)]", children: formatDuration(plan.durationDays) })] }), _jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsx("span", { className: "text-[var(--sdk-color-text-muted)]", children: copy.plans.pointsIncluded }), _jsx("span", { className: "font-medium tabular-nums text-[var(--sdk-color-text-primary)]", children: formatIncludedPoints(plan.includedPoints) })] })] }), plan.tags.length > 0 ? (_jsx("div", { className: "mt-4 flex flex-wrap gap-2", children: plan.tags.map((tag) => (_jsx("span", { className: "rounded-full border px-3 py-1 text-xs font-medium text-[var(--sdk-color-text-secondary)]", style: createSdkworkMembershipToneStyle(tone, {
                                                            backgroundWeight: 8,
                                                            borderWeight: 14,
                                                        }), children: tag }, tag))) })) : null, _jsx(Button, { className: "mt-6 w-full", onClick: () => controller.selectPlan(plan.packageId), type: "button", variant: isSelected ? "secondary" : plan.recommended ? "primary" : "outline", children: isSelected ? copy.actions.selected : copy.actions.selectPlan })] }, plan.id));
                                    }) })] }), _jsx("div", { id: MEMBERSHIP_SECTION_IDS.benefits, className: "scroll-mt-24", children: _jsx(SdkworkMembershipBenefitsGrid, { benefits: state.dashboard.benefits }) }), _jsx("div", { id: MEMBERSHIP_SECTION_IDS.levels, className: "scroll-mt-24", children: _jsx(SdkworkMembershipLevelComparison, { levels: state.dashboard.levels }) })] }) })] }));
}
export function SdkworkMembershipPage({ locale, messages, onNavigate, purchaseFlow, ...props }) {
    const resolvedPurchaseFlow = purchaseFlow ?? (onNavigate ? "checkout" : "direct");
    const content = (_jsx(SdkworkMembershipPageContent, { ...props, onNavigate: onNavigate, purchaseFlow: resolvedPurchaseFlow }));
    if (locale || messages) {
        return (_jsx(SdkworkMembershipIntlProvider, { locale: locale, messages: messages, children: content }));
    }
    return content;
}
//# sourceMappingURL=MembershipPage.js.map