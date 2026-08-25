import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Banknote, Zap } from "lucide-react";
import { createSdkworkMembershipToneStyle } from "../membership-appearance";
import { useSdkworkMembershipIntl } from "../membership-intl";
/**
 * 订阅期额度充值面板：输入充值数量与金额，向当前有效订阅追加权益额度。
 * 充值走会员订单（action=recharge）→ 支付 → 结算入账。
 */
export function SdkworkMembershipQuotaRechargePanel({ disabled = false, isMember = false, isSubmitting = false, onRecharge, }) {
    const { copy } = useSdkworkMembershipIntl();
    const [quantity, setQuantity] = useState("");
    const [amount, setAmount] = useState("");
    const [error, setError] = useState(null);
    function handleSubmit(event) {
        event.preventDefault();
        const parsedQuantity = Number(quantity);
        const parsedAmount = Number(amount);
        if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0 || !(parsedAmount > 0)) {
            setError(copy.quota.error);
            return;
        }
        setError(null);
        onRecharge({
            grantQuantity: parsedQuantity,
            amountCny: amount.trim(),
        });
    }
    return (_jsx("section", { className: "rounded-[1.5rem] border border-[var(--sdk-color-border-default)] bg-[var(--sdk-color-surface-panel)] shadow-[var(--sdk-shadow-sm)]", "data-sdkwork-membership-quota-recharge": true, children: _jsxs("div", { className: "px-5 py-4 sm:px-6", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "flex h-8 w-8 items-center justify-center rounded-full bg-[var(--sdk-color-brand-soft)] text-[var(--sdk-color-brand)]", children: _jsx(Zap, { className: "h-4 w-4", "aria-hidden": "true" }) }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm font-bold text-[var(--sdk-color-text-strong)]", children: copy.quota.title }), _jsx("p", { className: "mt-0.5 text-xs leading-5 text-[var(--sdk-color-text-muted)]", children: copy.quota.description })] })] }), !isMember ? (_jsx("p", { className: "mt-4 rounded-xl bg-[var(--sdk-color-surface-raised)] px-3 py-2 text-xs text-[var(--sdk-color-text-muted)]", children: copy.quota.onlyForMembers })) : (_jsxs("form", { className: "mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]", onSubmit: handleSubmit, children: [_jsxs("label", { className: "flex flex-col gap-1 text-xs font-medium text-[var(--sdk-color-text-muted)]", children: [copy.quota.quantityLabel, _jsx("input", { className: "h-10 rounded-xl border border-[var(--sdk-color-border-default)] bg-[var(--sdk-color-surface-base)] px-3 text-sm text-[var(--sdk-color-text-strong)] outline-none focus:border-[var(--sdk-color-brand)]", disabled: disabled || isSubmitting, inputMode: "numeric", onChange: (event) => setQuantity(event.target.value), placeholder: copy.quota.quantityPlaceholder, value: quantity })] }), _jsxs("label", { className: "flex flex-col gap-1 text-xs font-medium text-[var(--sdk-color-text-muted)]", children: [copy.quota.amountLabel, _jsx("input", { className: "h-10 rounded-xl border border-[var(--sdk-color-border-default)] bg-[var(--sdk-color-surface-base)] px-3 text-sm text-[var(--sdk-color-text-strong)] outline-none focus:border-[var(--sdk-color-brand)]", disabled: disabled || isSubmitting, inputMode: "decimal", onChange: (event) => setAmount(event.target.value), placeholder: copy.quota.amountPlaceholder, value: amount })] }), _jsxs("button", { className: "inline-flex h-10 items-center justify-center gap-2 self-end rounded-xl bg-[var(--sdk-color-brand)] px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50", disabled: disabled || isSubmitting, type: "submit", children: [_jsx(Banknote, { className: "h-4 w-4", "aria-hidden": "true" }), isSubmitting ? copy.quota.submitting : copy.quota.submit] })] })), error ? (_jsx("p", { className: "mt-3 rounded-xl px-3 py-2 text-xs", style: createSdkworkMembershipToneStyle("danger"), children: error })) : null] }) }));
}
//# sourceMappingURL=membership-quota-recharge.js.map