import type { SdkworkMembershipMessagesOverrides } from "../membership-copy.ts";
import type { SdkworkMembershipController } from "../membership-controller.ts";
export interface SdkworkMembershipHeaderEntryProps {
    checkoutBasePath?: string;
    controller?: SdkworkMembershipController;
    locale?: string | null;
    menuClassName?: string;
    messages?: SdkworkMembershipMessagesOverrides;
    onNavigate?: (route: string) => void;
    onOpenCenter?: () => void;
}
export declare function SdkworkMembershipHeaderEntry({ locale, messages, ...props }: SdkworkMembershipHeaderEntryProps): import("react").JSX.Element;
/** Token Plan header entry alias for membership plan selection in app shells. */
export declare const SdkworkTokenPlanHeaderEntry: typeof SdkworkMembershipHeaderEntry;
//# sourceMappingURL=membership-header-entry.d.ts.map