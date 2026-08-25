export type SdkworkMembershipQrPaymentStrategyId = "mobile_cashier_h5" | "wechat_native" | "alipay_native";
export type SdkworkMembershipQrPaymentProductType = "h5" | "native";
export interface SdkworkMembershipQrPaymentStrategy {
    id: SdkworkMembershipQrPaymentStrategyId;
    paymentMethod?: "wechat_pay" | "alipay";
    productType: SdkworkMembershipQrPaymentProductType;
    resolvePayload(input: {
        cashierUrl?: string;
        providerQrCode?: string;
    }): string | undefined;
}
export declare const SDKWORK_MEMBERSHIP_QR_PAYMENT_STRATEGIES: Readonly<Record<SdkworkMembershipQrPaymentStrategyId, SdkworkMembershipQrPaymentStrategy>>;
export declare function resolveSdkworkMembershipQrPaymentStrategy(strategy?: SdkworkMembershipQrPaymentStrategyId | SdkworkMembershipQrPaymentStrategy): SdkworkMembershipQrPaymentStrategy;
//# sourceMappingURL=payment-qr-strategy.d.ts.map