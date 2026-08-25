const MOBILE_CASHIER_H5 = {
    id: "mobile_cashier_h5",
    productType: "h5",
    resolvePayload: ({ cashierUrl, providerQrCode }) => cashierUrl ?? providerQrCode,
};
const WECHAT_NATIVE = {
    id: "wechat_native",
    paymentMethod: "wechat_pay",
    productType: "native",
    resolvePayload: ({ providerQrCode, cashierUrl }) => providerQrCode ?? cashierUrl,
};
const ALIPAY_NATIVE = {
    id: "alipay_native",
    paymentMethod: "alipay",
    productType: "native",
    resolvePayload: ({ providerQrCode, cashierUrl }) => providerQrCode ?? cashierUrl,
};
export const SDKWORK_MEMBERSHIP_QR_PAYMENT_STRATEGIES = {
    mobile_cashier_h5: MOBILE_CASHIER_H5,
    wechat_native: WECHAT_NATIVE,
    alipay_native: ALIPAY_NATIVE,
};
export function resolveSdkworkMembershipQrPaymentStrategy(strategy) {
    if (typeof strategy === "object") {
        return strategy;
    }
    return SDKWORK_MEMBERSHIP_QR_PAYMENT_STRATEGIES[strategy ?? "mobile_cashier_h5"];
}
//# sourceMappingURL=payment-qr-strategy.js.map