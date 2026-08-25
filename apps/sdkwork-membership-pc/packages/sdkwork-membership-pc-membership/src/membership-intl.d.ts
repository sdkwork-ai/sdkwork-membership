import { type PropsWithChildren } from "react";
import { type SdkworkMembershipMessages, type SdkworkMembershipMessagesOverrides } from "./membership-copy";
export interface SdkworkMembershipIntlValue {
    copy: SdkworkMembershipMessages;
    formatDuration: (value: number | null) => string;
    formatIncludedPoints: (value: number) => string;
    formatPointsToNext: (value: number, level: string) => string;
    formatPriceWas: (value: string) => string;
    formatSave: (percent: number) => string;
    formatStatus: (value: "active" | "free" | "guest") => string;
    formatUsage: (used: number | null, limit: number | null) => string;
    locale: string;
}
export interface SdkworkMembershipIntlProviderProps extends PropsWithChildren {
    locale?: string | null;
    messages?: SdkworkMembershipMessagesOverrides;
}
export declare function SdkworkMembershipIntlProvider({ children, locale, messages, }: SdkworkMembershipIntlProviderProps): import("react").JSX.Element;
export declare function useSdkworkMembershipIntl(): SdkworkMembershipIntlValue;
//# sourceMappingURL=membership-intl.d.ts.map