import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Lock, LockOpen, ShieldCheck } from "lucide-react";
import { createSdkworkMembershipToneStyle, } from "../membership-appearance";
import { useSdkworkMembershipIntl } from "../membership-intl";
import { SDKWORK_MEMBERSHIP_FEATURE_CODES, } from "../membership-service";
/**
 * 会员功能门槛：按功能码调用 access/checks 校验当前等级，
 * 展示各功能的所需等级与锁定/解锁状态。
 */
export function SdkworkMembershipFeatureGates({ service, }) {
    const { copy } = useSdkworkMembershipIntl();
    const [gates, setGates] = useState(null);
    const featureLabels = {
        ai_chat: copy.gates.labels.aiChat,
        image_generation: copy.gates.labels.imageGeneration,
        priority_speed_up: copy.gates.labels.prioritySpeedUp,
        priority_queue: copy.gates.labels.priorityQueue,
        exclusive_model: copy.gates.labels.exclusiveModel,
    };
    useEffect(() => {
        let cancelled = false;
        const features = SDKWORK_MEMBERSHIP_FEATURE_CODES;
        void (service?.checkFeatureAccess([...features]) ?? Promise.resolve([]))
            .then((results) => {
            if (!cancelled) {
                setGates(results);
            }
        })
            .catch(() => {
            if (!cancelled) {
                setGates([]);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [service]);
    const items = gates ?? [];
    return (_jsx("section", { className: "rounded-[1.5rem] border border-[var(--sdk-color-border-default)] bg-[var(--sdk-color-surface-panel)] shadow-[var(--sdk-shadow-sm)]", "data-sdkwork-membership-feature-gates": true, children: _jsxs("div", { className: "px-5 py-4 sm:px-6", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "flex h-8 w-8 items-center justify-center rounded-full bg-[var(--sdk-color-brand-soft)] text-[var(--sdk-color-brand)]", children: _jsx(ShieldCheck, { className: "h-4 w-4", "aria-hidden": "true" }) }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm font-bold text-[var(--sdk-color-text-strong)]", children: copy.gates.title }), _jsx("p", { className: "mt-0.5 text-xs leading-5 text-[var(--sdk-color-text-muted)]", children: copy.gates.description })] })] }), !gates ? (_jsx("p", { className: "mt-4 text-xs text-[var(--sdk-color-text-muted)]", children: copy.page.loading })) : (_jsx("ul", { className: "mt-4 grid gap-2 sm:grid-cols-2", children: items.map((gate) => {
                        const label = featureLabels[gate.featureCode] ?? gate.featureCode;
                        const unlocked = gate.allowed;
                        const Icon = unlocked ? LockOpen : Lock;
                        return (_jsxs("li", { className: "flex items-center justify-between gap-3 rounded-xl border border-[var(--sdk-color-border-default)] bg-[var(--sdk-color-surface-raised)] px-3 py-2.5", children: [_jsxs("span", { className: "flex min-w-0 items-center gap-2 text-sm text-[var(--sdk-color-text-strong)]", children: [_jsx(Icon, { className: `h-4 w-4 shrink-0 ${unlocked ? "text-[var(--sdk-color-brand)]" : "text-[var(--sdk-color-text-muted)]"}`, "aria-hidden": "true" }), _jsx("span", { className: "truncate", children: label })] }), _jsxs("span", { className: "flex shrink-0 items-center gap-2", children: [_jsxs("span", { className: "text-xs text-[var(--sdk-color-text-muted)]", children: [copy.gates.requiredLevel, " ", gate.requiredLevel] }), _jsx("span", { className: "rounded-full px-2 py-0.5 text-xs font-semibold", style: unlocked
                                                ? createSdkworkMembershipToneStyle("success")
                                                : createSdkworkMembershipToneStyle("warning"), children: unlocked ? copy.gates.unlocked : copy.gates.locked })] })] }, gate.featureCode));
                    }) }))] }) }));
}
//# sourceMappingURL=membership-feature-gates.js.map