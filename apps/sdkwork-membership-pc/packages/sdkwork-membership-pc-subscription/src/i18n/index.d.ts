import { SDKWORK_SUBSCRIPTION_I18N_KEYS } from "../subscription-i18n-keys";
export declare const sdkworkSubscriptionCheckoutResources: {
    readonly "en-US": {
        readonly commerce: {
            readonly subscription: {
                readonly checkout: {
                    readonly activation: {
                        readonly description: "Payment activates the selected membership automatically.";
                        readonly title: "Instant activation";
                    };
                    readonly close: "Close";
                    readonly completed: "Payment completed";
                    readonly creatingPayment: "Creating payment QR code...";
                    readonly expired: {
                        readonly description: "This order has expired. Create a new order to continue.";
                        readonly title: "Order expired";
                    };
                    readonly expiresIn: "Order expires in";
                    readonly payByQr: "Scan to pay";
                    readonly paymentUnavailable: {
                        readonly description: "The payment QR code is unavailable. Please try again.";
                        readonly title: "Payment QR code unavailable";
                    };
                    readonly price: "Price";
                    readonly retry: "Retry";
                    readonly scanPrompt: "Scan with a mobile payment app to complete payment";
                    readonly secure: {
                        readonly description: "Payment data is used for this order only.";
                        readonly title: "Secure checkout";
                    };
                    readonly selectedPlan: "Selected plan";
                    readonly title: "Purchase plan";
                };
                readonly dialogs: {
                    readonly close: "Close";
                    readonly redemptionTitle: "Membership redemption";
                    readonly tokenDetailsTitle: "Token details";
                    readonly tokenPurchaseTitle: "Buy tokens";
                };
            };
        };
    };
    readonly "zh-CN": {
        readonly commerce: {
            readonly subscription: {
                readonly checkout: {
                    readonly activation: {
                        readonly description: "支付完成后将自动开通所选会员套餐。";
                        readonly title: "即时生效";
                    };
                    readonly close: "关闭";
                    readonly completed: "支付完成";
                    readonly creatingPayment: "正在生成支付二维码...";
                    readonly expired: {
                        readonly description: "当前订单已过期，请重新创建订单后继续支付。";
                        readonly title: "订单已过期";
                    };
                    readonly expiresIn: "订单剩余支付时间";
                    readonly payByQr: "扫码支付";
                    readonly paymentUnavailable: {
                        readonly description: "暂未获取到支付二维码，请重试。";
                        readonly title: "支付二维码不可用";
                    };
                    readonly price: "价格";
                    readonly retry: "重试";
                    readonly scanPrompt: "请使用手机支付应用扫码完成支付";
                    readonly secure: {
                        readonly description: "支付信息仅用于本次订单结算。";
                        readonly title: "安全结算";
                    };
                    readonly selectedPlan: "已选套餐";
                    readonly title: "购买套餐";
                };
                readonly dialogs: {
                    readonly close: "关闭";
                    readonly redemptionTitle: "会员兑换";
                    readonly tokenDetailsTitle: "Token 明细";
                    readonly tokenPurchaseTitle: "购买 Token";
                };
            };
        };
    };
};
export declare const sdkworkSubscriptionCheckoutMessages: {
    readonly "en-US": Record<string, string>;
    readonly "zh-CN": Record<string, string>;
};
export declare const sdkworkSubscriptionCheckoutI18nBundle: {
    readonly en: Record<string, string>;
    readonly zh: Record<string, string>;
};
export { SDKWORK_SUBSCRIPTION_I18N_KEYS };
//# sourceMappingURL=index.d.ts.map