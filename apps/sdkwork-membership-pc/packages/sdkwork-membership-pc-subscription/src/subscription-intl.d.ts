import { type PropsWithChildren } from "react";
import type { SdkworkMembershipSummary } from "@sdkwork/membership-pc-membership";
import type { SdkworkSubscriptionAction, SdkworkSubscriptionPaymentMethodOption } from "./subscription";
import type { SdkworkSubscriptionCoupon } from "./subscription-service";
import { type SdkworkSubscriptionLocale, type SdkworkSubscriptionMessages, type SdkworkSubscriptionMessagesOverrides } from "./subscription-copy";
export interface SdkworkSubscriptionIntlValue {
    copy: SdkworkSubscriptionMessages;
    formatCouponAvailability: (coupon: Pick<SdkworkSubscriptionCoupon, "remainingDays" | "status">) => string;
    formatCouponCount: (couponCount: number) => string;
    formatCouponMinimumSpend: (minimumSpendCny: number | null | undefined) => string;
    formatCouponOffer: (coupon: Pick<SdkworkSubscriptionCoupon, "amountCny" | "discountAmountCny" | "discountRate">) => string;
    formatCurrencyCny: (value: number | null | undefined) => string;
    formatCurrentBalance: (points: number) => string;
    formatCurrentLevelMeta: (summary: Pick<SdkworkMembershipSummary, "remainingDays">) => string;
    formatDurationDays: (durationDays: number | null | undefined) => string;
    formatPaymentMethodDescription: (method: Pick<SdkworkSubscriptionPaymentMethodOption, "description" | "recommendedProductType">) => string | undefined;
    formatPaymentMethodLabel: (method: Pick<SdkworkSubscriptionPaymentMethodOption, "code" | "label">) => string;
    formatPaymentMethodSelection: (selected: boolean) => string;
    formatPaymentProductTypeLabel: (method: Pick<SdkworkSubscriptionPaymentMethodOption, "productTypes" | "recommendedProductType">) => string;
    formatPoints: (value: number) => string;
    formatStatus: (status: string | null | undefined) => string;
    locale: SdkworkSubscriptionLocale;
    resolveActionButtonLabel: (action: SdkworkSubscriptionAction) => string;
    resolveActionLabel: (action: SdkworkSubscriptionAction) => string;
    resolveActionTitle: (action: SdkworkSubscriptionAction) => string;
}
export interface SdkworkSubscriptionIntlProviderProps extends PropsWithChildren {
    locale?: string | null;
    messages?: SdkworkSubscriptionMessagesOverrides;
}
export declare function SdkworkSubscriptionIntlProvider({ children, locale, messages, }: SdkworkSubscriptionIntlProviderProps): import("react").JSX.Element;
export declare function useSdkworkSubscriptionIntl(): SdkworkSubscriptionIntlValue;
//# sourceMappingURL=subscription-intl.d.ts.map