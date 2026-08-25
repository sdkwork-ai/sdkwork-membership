import { type SdkworkMembershipDashboardData, type SdkworkMembershipMutationInput, type SdkworkMembershipPurchaseResult, type SdkworkMembershipService } from "./membership-service";
export type SdkworkMembershipView = "benefits" | "levels" | "plans";
export interface SdkworkMembershipControllerState {
    activeView: SdkworkMembershipView;
    dashboard: SdkworkMembershipDashboardData;
    isBootstrapped: boolean;
    isLoading: boolean;
    isMutating: boolean;
    lastError?: string;
    selectedPlanId: number | null;
}
export interface SdkworkMembershipController {
    bootstrap(): Promise<SdkworkMembershipControllerState>;
    getState(): SdkworkMembershipControllerState;
    purchaseSelectedPlan(input?: Omit<SdkworkMembershipMutationInput, "packageId"> & {
        packageId?: number;
    }): Promise<SdkworkMembershipPurchaseResult>;
    refresh(): Promise<SdkworkMembershipControllerState>;
    renewSelectedPlan(input?: Omit<SdkworkMembershipMutationInput, "packageId"> & {
        packageId?: number;
    }): Promise<SdkworkMembershipPurchaseResult>;
    selectPlan(packageId: number): void;
    service: SdkworkMembershipService;
    setView(view: SdkworkMembershipView): void;
    subscribe(listener: () => void): () => void;
    upgradeSelectedPlan(input?: Omit<SdkworkMembershipMutationInput, "packageId"> & {
        packageId?: number;
    }): Promise<SdkworkMembershipPurchaseResult>;
}
export interface CreateSdkworkMembershipControllerOptions {
    initialState?: Partial<SdkworkMembershipControllerState>;
    service?: Partial<SdkworkMembershipService>;
}
export declare function createSdkworkMembershipController(options?: CreateSdkworkMembershipControllerOptions): SdkworkMembershipController;
export declare function useSdkworkMembershipController(controller?: SdkworkMembershipController): SdkworkMembershipController;
export declare function useSdkworkMembershipControllerState(controller: SdkworkMembershipController): SdkworkMembershipControllerState;
//# sourceMappingURL=membership-controller.d.ts.map