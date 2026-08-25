import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Suspense, useEffect, useRef, useState, } from "react";
import { Crown } from "lucide-react";
import { createSdkworkMembershipToneStyle, } from "../membership-appearance.js";
import { useSdkworkMembershipController, useSdkworkMembershipControllerState, } from "../membership-controller.js";
import { SdkworkMembershipIntlProvider, useSdkworkMembershipIntl, } from "../membership-intl.js";
import { SdkworkMembershipHeaderMenu } from "./membership-header-menu.js";
function SdkworkMembershipHeaderEntryContent({ checkoutBasePath, controller: controllerProp, menuClassName, onNavigate, onOpenCenter, }) {
    const controller = useSdkworkMembershipController(controllerProp);
    const state = useSdkworkMembershipControllerState(controller);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const entryRef = useRef(null);
    const { copy } = useSdkworkMembershipIntl();
    const label = state.dashboard.summary.isAuthenticated && state.dashboard.summary.currentLevelName
        ? state.dashboard.summary.currentLevelName
        : copy.headerEntry.fallbackLevel;
    useEffect(() => {
        if (!state.isBootstrapped && !state.isLoading && !state.lastError) {
            void controller.bootstrap().catch(() => undefined);
        }
    }, [controller, state.isBootstrapped, state.isLoading, state.lastError]);
    useEffect(() => {
        if (!isMenuOpen) {
            return undefined;
        }
        const handlePointerDown = (event) => {
            if (entryRef.current?.contains(event.target)) {
                return;
            }
            setIsMenuOpen(false);
        };
        const handleKeyDown = (event) => {
            if (event.key === "Escape") {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener("pointerdown", handlePointerDown, true);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("pointerdown", handlePointerDown, true);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isMenuOpen]);
    return (_jsxs("div", { className: "relative flex items-center", ref: entryRef, children: [_jsxs("button", { "aria-expanded": isMenuOpen, "aria-haspopup": "dialog", "aria-label": copy.headerEntry.ariaLabel, className: "inline-flex h-9 items-center gap-2 rounded-[1rem] border px-3 text-sm font-medium", onClick: () => setIsMenuOpen((current) => !current), style: createSdkworkMembershipToneStyle("accent", {
                    backgroundWeight: 12,
                    borderWeight: 24,
                }), type: "button", children: [_jsx(Crown, { className: "h-4 w-4" }), label] }), isMenuOpen ? (_jsx("div", { className: menuClassName ?? "absolute right-0 top-[calc(100%+0.75rem)] z-50", role: "dialog", "aria-label": copy.headerEntry.ariaLabel, children: _jsx(Suspense, { fallback: null, children: _jsx(SdkworkMembershipHeaderMenu, { checkoutBasePath: checkoutBasePath, controller: controller, onNavigate: (route) => {
                            setIsMenuOpen(false);
                            onNavigate?.(route);
                        }, onOpenCenter: onOpenCenter
                            ? () => {
                                setIsMenuOpen(false);
                                onOpenCenter();
                            }
                            : undefined }) }) })) : null] }));
}
export function SdkworkMembershipHeaderEntry({ locale, messages, ...props }) {
    const content = _jsx(SdkworkMembershipHeaderEntryContent, { ...props });
    if (locale || messages) {
        return (_jsx(SdkworkMembershipIntlProvider, { locale: locale, messages: messages, children: content }));
    }
    return content;
}
/** Token Plan header entry alias for membership plan selection in app shells. */
export const SdkworkTokenPlanHeaderEntry = SdkworkMembershipHeaderEntry;
//# sourceMappingURL=membership-header-entry.js.map