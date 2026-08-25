import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { CheckCircle2, Clock3, Gift, Shield, Sparkles, Star, Zap, } from "lucide-react";
import { createSdkworkMembershipPanelStyle, createSdkworkMembershipToneStyle, } from "../membership-appearance";
import { useSdkworkMembershipIntl } from "../membership-intl";
function resolveBenefitIcon(type) {
    const normalized = String(type || "").toLowerCase();
    if (normalized.includes("quota") || normalized.includes("credit") || normalized.includes("compute") || normalized.includes("render")) {
        return Zap;
    }
    if (normalized.includes("security") || normalized.includes("shield") || normalized.includes("protect")) {
        return Shield;
    }
    if (normalized.includes("gift") || normalized.includes("perk") || normalized.includes("reward")) {
        return Gift;
    }
    if (normalized.includes("star") || normalized.includes("premium") || normalized.includes("vip")) {
        return Star;
    }
    return Sparkles;
}
function resolveUsageTone(used, limit) {
    if (limit <= 0) {
        return "success";
    }
    const ratio = used / limit;
    if (ratio >= 1) {
        return "danger";
    }
    if (ratio >= 0.8) {
        return "warning";
    }
    return "success";
}
export function SdkworkMembershipBenefitsGrid({ benefits, }) {
    const { copy, formatUsage } = useSdkworkMembershipIntl();
    return (_jsxs("section", { className: "rounded-[1.5rem] border border-[var(--sdk-color-border-default)] bg-[var(--sdk-color-surface-panel)] shadow-[var(--sdk-shadow-sm)]", children: [_jsxs("div", { className: "border-b border-[var(--sdk-color-border-subtle)] px-6 py-5", children: [_jsx("div", { className: "text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sdk-color-text-muted)]", children: copy.benefits.eyebrow }), _jsx("h2", { className: "mt-2 text-xl font-semibold text-[var(--sdk-color-text-primary)]", children: copy.benefits.title })] }), _jsx("div", { className: "grid gap-4 px-6 py-6 md:grid-cols-2 xl:grid-cols-3", children: benefits.length === 0 ? (_jsxs("div", { className: "col-span-full rounded-[1.25rem] border border-dashed border-[var(--sdk-color-border-default)] px-5 py-12 text-center", children: [_jsx("div", { className: "mx-auto flex h-12 w-12 items-center justify-center rounded-[1rem] border border-[var(--sdk-color-border-default)] bg-[var(--sdk-color-surface-panel-muted)]", children: _jsx(Gift, { className: "h-5 w-5 text-[var(--sdk-color-text-muted)]" }) }), _jsx("div", { className: "mt-4 text-base font-semibold text-[var(--sdk-color-text-primary)]", children: copy.benefits.emptyTitle }), _jsx("div", { className: "mt-2 text-sm text-[var(--sdk-color-text-secondary)]", children: copy.benefits.emptyDescription })] })) : benefits.map((benefit) => {
                    const BenefitIcon = resolveBenefitIcon(benefit.type);
                    const statusTone = benefit.claimed ? "success" : "warning";
                    const usageRatio = benefit.usageLimit !== null && benefit.usageLimit > 0
                        ? Math.min((benefit.usedCount ?? 0) / benefit.usageLimit, 1)
                        : 0;
                    const usageTone = benefit.usageLimit !== null
                        ? resolveUsageTone(benefit.usedCount ?? 0, benefit.usageLimit)
                        : "success";
                    return (_jsxs("article", { className: "flex flex-col rounded-[1.5rem] border bg-[var(--sdk-color-surface-panel-muted)] p-5", style: createSdkworkMembershipPanelStyle(statusTone, {
                            backgroundWeight: 6,
                            borderWeight: 16,
                            surfaceColor: "var(--sdk-color-surface-panel-muted)",
                        }), children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "truncate text-lg font-semibold text-[var(--sdk-color-text-primary)]", children: benefit.name }), _jsx("div", { className: "mt-2 text-sm text-[var(--sdk-color-text-secondary)]", children: benefit.description || copy.benefits.descriptionFallback })] }), _jsx("div", { className: "flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] border", style: createSdkworkMembershipToneStyle(statusTone, {
                                            backgroundWeight: 12,
                                            borderWeight: 22,
                                        }), children: _jsx(BenefitIcon, { className: "h-5 w-5" }) })] }), benefit.displayValue ? (_jsx("div", { className: "mt-5", children: _jsxs("div", { className: "flex items-center justify-between gap-4 text-xs", children: [_jsx("span", { className: "font-medium text-[var(--sdk-color-text-muted)]", children: copy.benefits.valueLabel || "Value" }), _jsx("span", { className: "font-semibold tabular-nums text-[var(--sdk-color-text-primary)]", children: benefit.displayValue })] }) })) : benefit.usageLimit !== null ? (_jsxs("div", { className: "mt-5", children: [_jsxs("div", { className: "flex items-center justify-between gap-4 text-xs", children: [_jsx("span", { className: "font-medium text-[var(--sdk-color-text-muted)]", children: formatUsage(benefit.usedCount, benefit.usageLimit) }), _jsxs("span", { className: "font-semibold tabular-nums", style: createSdkworkMembershipToneStyle(usageTone, {
                                                    backgroundWeight: 0,
                                                    borderWeight: 0,
                                                }), children: [Math.round(usageRatio * 100), "%"] })] }), _jsx("div", { className: "mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--sdk-color-surface-panel)]", children: _jsx("div", { className: "h-full rounded-full transition-[width] duration-500 ease-out", style: {
                                                width: `${Math.round(usageRatio * 100)}%`,
                                                ...createSdkworkMembershipToneStyle(usageTone, {
                                                    backgroundWeight: 60,
                                                    borderWeight: 0,
                                                }),
                                            } }) })] })) : null, _jsxs("div", { className: "mt-auto flex flex-wrap gap-2 pt-5 text-xs", children: [_jsx("span", { className: "rounded-full bg-[var(--sdk-color-surface-panel)] px-3 py-1 font-medium text-[var(--sdk-color-text-secondary)]", children: benefit.type || copy.benefits.typeFallback }), _jsx("span", { className: "inline-flex items-center gap-1 rounded-full border px-3 py-1 font-medium", style: createSdkworkMembershipToneStyle(statusTone, {
                                            backgroundWeight: 10,
                                            borderWeight: 18,
                                        }), children: benefit.claimed ? (_jsxs(_Fragment, { children: [_jsx(CheckCircle2, { className: "h-3 w-3" }), copy.benefits.claimed] })) : (_jsxs(_Fragment, { children: [_jsx(Clock3, { className: "h-3 w-3" }), copy.benefits.pending] })) })] })] }, benefit.id));
                }) })] }));
}
//# sourceMappingURL=membership-benefits-grid.js.map