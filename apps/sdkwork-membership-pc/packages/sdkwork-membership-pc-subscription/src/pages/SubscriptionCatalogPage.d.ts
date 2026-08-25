import { type SdkworkSubscriptionCatalogController } from "../subscription-catalog-controller";
import { type SdkworkSubscriptionCatalogPageProps as SdkworkSubscriptionCatalogHostPageProps } from "../subscription-catalog-host";
export interface SdkworkSubscriptionCatalogPageProps extends SdkworkSubscriptionCatalogHostPageProps {
    catalogController?: SdkworkSubscriptionCatalogController;
}
export declare function SdkworkSubscriptionCatalogPage({ catalogController: catalogControllerProp, checkoutPort, components, memberSummary: memberSummaryProp, notifyOutlet: NotifyOutletProp, onLoginRequired, onMembershipTierUpdated, onNotify, }: SdkworkSubscriptionCatalogPageProps): import("react").JSX.Element;
//# sourceMappingURL=SubscriptionCatalogPage.d.ts.map