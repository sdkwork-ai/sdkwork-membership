import type { SdkworkMembershipMessagesOverrides } from "../membership-copy";
import type { SdkworkMembershipController } from "../membership-controller";
export interface SdkworkMembershipPageProps {
    checkoutBasePath?: string;
    controller?: SdkworkMembershipController;
    locale?: string | null;
    messages?: SdkworkMembershipMessagesOverrides;
    onNavigate?: (route: string) => void;
    purchaseFlow?: "checkout" | "direct";
}
export declare function SdkworkMembershipPage({ locale, messages, onNavigate, purchaseFlow, ...props }: SdkworkMembershipPageProps): import("react").JSX.Element;
//# sourceMappingURL=MembershipPage.d.ts.map