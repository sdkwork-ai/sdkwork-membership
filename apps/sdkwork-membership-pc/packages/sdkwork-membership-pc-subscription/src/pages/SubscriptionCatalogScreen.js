import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useState } from "react";
import { StatusNotice } from "@sdkwork/ui-pc-react";
import { SdkworkSubscriptionCatalogPage } from "./SubscriptionCatalogPage";
function resolveNoticeTone(tone) {
    if (tone === "error") {
        return "danger";
    }
    if (tone === "success") {
        return "success";
    }
    return "default";
}
/**
 * A self-contained subscription catalog screen that can be mounted with zero
 * props.  It wires default host components, notification UI, and no-op
 * callbacks internally, so external hosts (e.g. CloudRouter) can embed it
 * with a single `<SdkworkSubscriptionCatalogScreen />`.
 *
 * The component automatically:
 * - Bootstraps the catalog from the configured SDK service provider
 * - Shows loading and error states with retry
 * - Displays plan cards, tier comparison, and billing cycle tabs
 * - Handles checkout via a built-in confirmation modal
 */
export function SdkworkSubscriptionCatalogScreen() {
    const [notice, setNotice] = useState(null);
    const handleNotify = useCallback((message, tone) => {
        setNotice({ message, tone });
    }, []);
    return (_jsxs(_Fragment, { children: [notice ? (_jsx("div", { className: "px-6 pt-4", children: _jsx(StatusNotice, { tone: resolveNoticeTone(notice.tone), children: notice.message }) })) : null, _jsx(SdkworkSubscriptionCatalogPage, { onNotify: handleNotify })] }));
}
//# sourceMappingURL=SubscriptionCatalogScreen.js.map