import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useMemo, } from "react";
import { createSdkworkMembershipMessages, formatSdkworkMembershipDurationLabel, formatSdkworkMembershipIncludedPointsLabel, formatSdkworkMembershipPriceWasLabel, formatSdkworkMembershipStatusLabel, formatSdkworkMembershipUsageLabel, formatSdkworkMembershipTemplate, normalizeSdkworkMembershipLocale, } from "./membership-copy";
function createSdkworkMembershipIntlValue(locale, overrides) {
    const resolvedLocale = normalizeSdkworkMembershipLocale(locale);
    const copy = createSdkworkMembershipMessages(resolvedLocale, overrides);
    return {
        copy,
        formatDuration(value) {
            return formatSdkworkMembershipDurationLabel(value, resolvedLocale, overrides);
        },
        formatIncludedPoints(value) {
            return formatSdkworkMembershipIncludedPointsLabel(value, resolvedLocale);
        },
        formatPointsToNext(value, level) {
            return formatSdkworkMembershipTemplate(createSdkworkMembershipMessages(resolvedLocale, overrides).format.pointsToNext, { level, value: String(value) });
        },
        formatPriceWas(value) {
            return formatSdkworkMembershipPriceWasLabel(value, resolvedLocale, overrides);
        },
        formatSave(percent) {
            return formatSdkworkMembershipTemplate(createSdkworkMembershipMessages(resolvedLocale, overrides).common.save, { percent: String(percent) });
        },
        formatStatus(value) {
            return formatSdkworkMembershipStatusLabel(value, resolvedLocale, overrides);
        },
        formatUsage(used, limit) {
            return formatSdkworkMembershipUsageLabel(used, limit, resolvedLocale, overrides);
        },
        locale: resolvedLocale,
    };
}
const DEFAULT_SDKWORK_MEMBERSHIP_INTL = createSdkworkMembershipIntlValue();
const SdkworkMembershipIntlContext = createContext(DEFAULT_SDKWORK_MEMBERSHIP_INTL);
export function SdkworkMembershipIntlProvider({ children, locale, messages, }) {
    const value = useMemo(() => createSdkworkMembershipIntlValue(locale, messages), [locale, messages]);
    return (_jsx(SdkworkMembershipIntlContext.Provider, { value: value, children: children }));
}
export function useSdkworkMembershipIntl() {
    return useContext(SdkworkMembershipIntlContext);
}
//# sourceMappingURL=membership-intl.js.map