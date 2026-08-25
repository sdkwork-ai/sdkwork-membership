import { type SdkworkMembershipService } from "../membership-service";
export interface SdkworkMembershipFeatureGatesProps {
    service?: SdkworkMembershipService;
}
/**
 * 会员功能门槛：按功能码调用 access/checks 校验当前等级，
 * 展示各功能的所需等级与锁定/解锁状态。
 */
export declare function SdkworkMembershipFeatureGates({ service, }: SdkworkMembershipFeatureGatesProps): import("react").JSX.Element;
//# sourceMappingURL=membership-feature-gates.d.ts.map