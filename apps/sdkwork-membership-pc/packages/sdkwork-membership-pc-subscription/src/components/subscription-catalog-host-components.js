import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslation } from "react-i18next";
import { Button } from "@sdkwork/ui-pc-react";
import { SDKWORK_SUBSCRIPTION_I18N_KEYS } from "../i18n";
export function SubscriptionCatalogPlaceholderModal({ isOpen, onClose, titleKey, }) {
    const { t } = useTranslation();
    if (!isOpen) {
        return null;
    }
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4", children: _jsxs("div", { className: "w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900", children: [_jsx("h3", { className: "text-lg font-bold text-zinc-900 dark:text-white", children: t(titleKey) }), _jsx("div", { className: "mt-6 flex justify-end", children: _jsx(Button, { onClick: onClose, type: "button", variant: "secondary", children: t(SDKWORK_SUBSCRIPTION_I18N_KEYS.dialogs.close) }) })] }) }));
}
export function SubscriptionCatalogCheckoutModal({ isOpen, onClose, }) {
    return (_jsx(SubscriptionCatalogPlaceholderModal, { isOpen: isOpen, onClose: onClose, titleKey: SDKWORK_SUBSCRIPTION_I18N_KEYS.checkout.paymentUnavailableTitle }));
}
export function SubscriptionCatalogPointsPurchaseModal({ isOpen, onClose, }) {
    return (_jsx(SubscriptionCatalogPlaceholderModal, { isOpen: isOpen, onClose: onClose, titleKey: SDKWORK_SUBSCRIPTION_I18N_KEYS.dialogs.tokenPurchaseTitle }));
}
export const sdkworkSubscriptionCatalogHostComponents = {
    checkoutModal: SubscriptionCatalogCheckoutModal,
    pointsDetailsModal: (props) => (_jsx(SubscriptionCatalogPlaceholderModal, { ...props, titleKey: SDKWORK_SUBSCRIPTION_I18N_KEYS.dialogs.tokenDetailsTitle })),
    pointsPurchaseModal: SubscriptionCatalogPointsPurchaseModal,
    redeemModal: (props) => (_jsx(SubscriptionCatalogPlaceholderModal, { ...props, titleKey: SDKWORK_SUBSCRIPTION_I18N_KEYS.dialogs.redemptionTitle })),
};
//# sourceMappingURL=subscription-catalog-host-components.js.map