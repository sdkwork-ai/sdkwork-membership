import { type SdkworkSubscriptionCatalogData, type SdkworkSubscriptionCatalogService, type SdkworkSubscriptionCatalogViewModel } from "./subscription-catalog-service";
import type { SdkworkSubscriptionPurchaseResult } from "./subscription-service";
import type { SdkworkSubscriptionCatalogCheckoutPlan } from "./subscription-catalog-host";
import type { SdkworkMembershipCheckoutPort } from "@sdkwork/membership-pc-membership";
export interface SdkworkSubscriptionCatalogControllerState extends SdkworkSubscriptionCatalogViewModel {
    catalog: SdkworkSubscriptionCatalogData | null;
    isBootstrapped: boolean;
    isLoading: boolean;
    isMutating: boolean;
    lastError?: string;
    selectedCheckoutPlan: SdkworkSubscriptionCatalogCheckoutPlan | null;
}
export interface SdkworkSubscriptionCatalogController {
    bootstrap(): Promise<SdkworkSubscriptionCatalogControllerState>;
    clearCheckoutPlan(): void;
    getState(): SdkworkSubscriptionCatalogControllerState;
    getPurchaseStatus(orderId: string): Promise<SdkworkSubscriptionPurchaseResult>;
    purchaseSelectedPlan(): Promise<SdkworkSubscriptionPurchaseResult>;
    refresh(): Promise<SdkworkSubscriptionCatalogControllerState>;
    retry(): Promise<SdkworkSubscriptionCatalogControllerState>;
    selectBillingCycle(index: number): SdkworkSubscriptionCatalogControllerState;
    selectCheckoutPlan(plan: SdkworkSubscriptionCatalogCheckoutPlan | null): void;
    service: SdkworkSubscriptionCatalogService;
    subscribe(listener: () => void): () => void;
}
export interface CreateSdkworkSubscriptionCatalogControllerOptions {
    checkoutPort?: SdkworkMembershipCheckoutPort;
    initialState?: Partial<SdkworkSubscriptionCatalogControllerState>;
    locale?: string | null;
    service?: Partial<SdkworkSubscriptionCatalogService>;
    translate?: (key: string, defaultValue?: string) => string;
}
export declare function createSdkworkSubscriptionCatalogController(options?: CreateSdkworkSubscriptionCatalogControllerOptions): SdkworkSubscriptionCatalogController;
export declare function useSdkworkSubscriptionCatalogControllerState(controller: SdkworkSubscriptionCatalogController): SdkworkSubscriptionCatalogControllerState;
/**
 * React hook that returns a stable `SdkworkSubscriptionCatalogController`.
 *
 * The `translate` option is captured in a ref so it does NOT participate in
 * the `useMemo` dependency array.  This is critical because callers typically
 * pass an inline arrow function for `translate` (e.g.
 * `(k, d) => t(k, d ?? k)`), which would otherwise create a new function
 * reference on every render, causing `useMemo` to rebuild the controller on
 * every render, which in turn triggers `useSyncExternalStore` to detect a
 * "new" store and re-render – producing an infinite update loop.
 *
 * The ref pattern lets the latest `translate` be used inside the controller
 * without invalidating the memoised controller identity.
 */
export declare function useSdkworkSubscriptionCatalogController(controllerProp?: SdkworkSubscriptionCatalogController, options?: CreateSdkworkSubscriptionCatalogControllerOptions): SdkworkSubscriptionCatalogController;
//# sourceMappingURL=subscription-catalog-controller.d.ts.map