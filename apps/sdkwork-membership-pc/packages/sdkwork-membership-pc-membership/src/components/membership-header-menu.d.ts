import type { SdkworkMembershipController } from "../membership-controller.ts";
export interface SdkworkMembershipHeaderMenuProps {
    checkoutBasePath?: string;
    controller?: SdkworkMembershipController;
    onNavigate?: (route: string) => void;
    onOpenCenter?: () => void;
}
export declare function SdkworkMembershipHeaderMenu({ checkoutBasePath, controller: controllerProp, onNavigate, onOpenCenter, }: SdkworkMembershipHeaderMenuProps): import("react").JSX.Element;
//# sourceMappingURL=membership-header-menu.d.ts.map