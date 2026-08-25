import type { SdkworkSubscriptionCatalogCheckoutModalProps, SdkworkSubscriptionCatalogModalProps } from "../subscription-catalog-host";
export declare function SubscriptionCatalogPlaceholderModal({ isOpen, onClose, titleKey, }: SdkworkSubscriptionCatalogModalProps & {
    titleKey: string;
}): import("react").JSX.Element | null;
export declare function SubscriptionCatalogCheckoutModal({ isOpen, onClose, }: SdkworkSubscriptionCatalogCheckoutModalProps): import("react").JSX.Element;
export declare function SubscriptionCatalogPointsPurchaseModal({ isOpen, onClose, }: SdkworkSubscriptionCatalogModalProps): import("react").JSX.Element;
export declare const sdkworkSubscriptionCatalogHostComponents: {
    checkoutModal: typeof SubscriptionCatalogCheckoutModal;
    pointsDetailsModal: (props: SdkworkSubscriptionCatalogModalProps) => import("react").JSX.Element;
    pointsPurchaseModal: typeof SubscriptionCatalogPointsPurchaseModal;
    redeemModal: (props: SdkworkSubscriptionCatalogModalProps) => import("react").JSX.Element;
};
//# sourceMappingURL=subscription-catalog-host-components.d.ts.map