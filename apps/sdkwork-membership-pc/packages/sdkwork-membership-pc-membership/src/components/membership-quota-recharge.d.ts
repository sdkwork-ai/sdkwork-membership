export interface SdkworkMembershipQuotaRechargeInput {
    grantQuantity: number;
    amountCny: string;
}
export interface SdkworkMembershipQuotaRechargePanelProps {
    disabled?: boolean;
    isMember?: boolean;
    isSubmitting?: boolean;
    onRecharge: (input: SdkworkMembershipQuotaRechargeInput) => void;
}
/**
 * 订阅期额度充值面板：输入充值数量与金额，向当前有效订阅追加权益额度。
 * 充值走会员订单（action=recharge）→ 支付 → 结算入账。
 */
export declare function SdkworkMembershipQuotaRechargePanel({ disabled, isMember, isSubmitting, onRecharge, }: SdkworkMembershipQuotaRechargePanelProps): import("react").JSX.Element;
//# sourceMappingURL=membership-quota-recharge.d.ts.map