import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Crown } from "lucide-react";
import { Button, StatusNotice } from "@sdkwork/ui-pc-react";
import { formatSdkworkMembershipCurrencyCny } from "@sdkwork/membership-service";
import { createMembershipCheckoutRouteIntent, resolveSdkworkMembershipPurchaseMode, } from "../membership.js";
import { createSdkworkMembershipPanelStyle, createSdkworkMembershipToneStyle, } from "../membership-appearance.js";
import { useSdkworkMembershipController, useSdkworkMembershipControllerState, } from "../membership-controller.js";
import { useSdkworkMembershipIntl } from "../membership-intl.js";
export function SdkworkMembershipHeaderMenu({ checkoutBasePath, controller: controllerProp, onNavigate, onOpenCenter, }) {
    const controller = useSdkworkMembershipController(controllerProp);
    const state = useSdkworkMembershipControllerState(controller);
    const [selectedPackageId, setSelectedPackageId] = useState(controller.getState().selectedPlanId);
    const { copy, formatDuration, formatIncludedPoints, locale, } = useSdkworkMembershipIntl();
    const selectedPlan = state.dashboard.plans.find((plan) => plan.packageId === selectedPackageId)
        ?? state.dashboard.plans.find((plan) => plan.packageId === state.selectedPlanId)
        ?? state.dashboard.plans[0]
        ?? null;
    const purchaseMode = resolveSdkworkMembershipPurchaseMode({
        plan: selectedPlan,
        summary: state.dashboard.summary,
    });
    const canContinue = Boolean(selectedPlan)
        && state.dashboard.summary.isAuthenticated
        && Boolean(onNavigate);
    useEffect(() => {
        if (!state.isBootstrapped && !state.isLoading && !state.lastError) {
            void controller.bootstrap().catch(() => undefined);
        }
    }, [controller, state.isBootstrapped, state.isLoading, state.lastError]);
    useEffect(() => {
        if (selectedPackageId && state.dashboard.plans.some((plan) => plan.packageId === selectedPackageId)) {
            return;
        }
        setSelectedPackageId(state.dashboard.plans.find((plan) => plan.recommended)?.packageId
            ?? state.dashboard.plans[0]?.packageId
            ?? null);
    }, [selectedPackageId, state.dashboard.plans]);
    function continueToCheckout() {
        if (!selectedPlan || !onNavigate) {
            return;
        }
        controller.selectPlan(selectedPlan.packageId);
        onNavigate(createMembershipCheckoutRouteIntent({
            basePath: checkoutBasePath,
            mode: purchaseMode,
            plan: selectedPlan,
        }).route);
    }
    return (_jsxs("div", { className: "w-[min(92vw,30rem)] rounded-[1.5rem] border border-[var(--sdk-color-border-default)] bg-[var(--sdk-color-surface-panel)] p-4 shadow-[var(--sdk-shadow-lg)]", style: createSdkworkMembershipPanelStyle("brand", {
            backgroundWeight: 4,
            borderWeight: 18,
        }), children: [_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("div", { className: "text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sdk-color-text-muted)]", children: copy.headerEntry.title }), _jsx("div", { className: "mt-1 text-lg font-semibold text-[var(--sdk-color-text-primary)]", children: copy.menu.title })] }), _jsx("div", { className: "flex h-10 w-10 items-center justify-center rounded-[1rem] border", style: createSdkworkMembershipToneStyle("accent", {
                            backgroundWeight: 12,
                            borderWeight: 24,
                        }), children: _jsx(Crown, { className: "h-5 w-5" }) })] }), !state.dashboard.summary.isAuthenticated ? (_jsx(StatusNotice, { className: "mt-4", title: copy.menu.signInRequiredTitle, tone: "warning", children: copy.menu.signInRequiredDescription })) : null, _jsx("div", { className: "mt-4 grid gap-3", children: state.dashboard.plans.length === 0 ? (_jsxs("div", { className: "rounded-[1.25rem] border border-dashed border-[var(--sdk-color-border-default)] px-4 py-6 text-sm text-[var(--sdk-color-text-secondary)]", children: [_jsx("div", { className: "font-semibold text-[var(--sdk-color-text-primary)]", children: copy.menu.emptyTitle }), _jsx("div", { className: "mt-2", children: copy.menu.emptyDescription })] })) : state.dashboard.plans.map((plan) => {
                    const isSelected = selectedPlan?.packageId === plan.packageId;
                    return (_jsx("button", { "aria-pressed": isSelected, className: "rounded-[1.25rem] border px-4 py-4 text-left", onClick: () => {
                            setSelectedPackageId(plan.packageId);
                            controller.selectPlan(plan.packageId);
                        }, style: createSdkworkMembershipPanelStyle(isSelected ? "accent" : "neutral", {
                            backgroundWeight: isSelected ? 10 : 4,
                            borderWeight: isSelected ? 28 : 14,
                            surfaceColor: "var(--sdk-color-surface-panel-muted)",
                        }), type: "button", children: _jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("div", { className: "font-semibold text-[var(--sdk-color-text-primary)]", children: plan.name }), _jsxs("div", { className: "mt-2 text-sm text-[var(--sdk-color-text-secondary)]", children: [formatDuration(plan.durationDays), " · ", formatIncludedPoints(plan.includedPoints)] })] }), _jsxs("div", { className: "text-right", children: [_jsx("div", { className: "font-semibold text-[var(--sdk-color-text-primary)]", children: formatSdkworkMembershipCurrencyCny(plan.priceCny, locale) }), _jsx("div", { className: "mt-1 text-xs text-[var(--sdk-color-text-muted)]", children: isSelected ? copy.actions.selected : copy.actions.selectPlan })] })] }) }, plan.id));
                }) }), _jsxs("div", { className: "mt-4 flex flex-wrap justify-end gap-2", children: [onOpenCenter ? (_jsx(Button, { onClick: onOpenCenter, type: "button", variant: "ghost", children: copy.menu.openCenter })) : null, _jsx(Button, { disabled: !canContinue, onClick: continueToCheckout, type: "button", children: purchaseMode === "purchase"
                            ? copy.menu.continueCheckout
                            : purchaseMode === "renew"
                                ? copy.actions.renew
                                : copy.actions.upgrade })] })] }));
}
//# sourceMappingURL=membership-header-menu.js.map