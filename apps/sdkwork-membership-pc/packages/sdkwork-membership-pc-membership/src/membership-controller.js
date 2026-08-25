import { useMemo, useSyncExternalStore, } from "react";
import { createSdkworkMembershipService, } from "./membership-service";
function resolveSelectedPlanId(dashboard, selectedPlanId) {
    if (selectedPlanId && dashboard.plans.some((plan) => plan.packageId === selectedPlanId)) {
        return selectedPlanId;
    }
    return dashboard.plans.find((plan) => plan.recommended)?.packageId ?? dashboard.plans[0]?.packageId ?? null;
}
function resolvePlanId(state, input = {}) {
    const packageId = input.packageId ?? state.selectedPlanId;
    if (!packageId) {
        throw new Error("Select a membership package before continuing.");
    }
    return packageId;
}
export function createSdkworkMembershipController(options = {}) {
    const service = options.service
        ? {
            ...createSdkworkMembershipService(),
            ...options.service,
        }
        : createSdkworkMembershipService();
    const listeners = new Set();
    let state = {
        activeView: "plans",
        dashboard: service.getEmptyDashboard(),
        isBootstrapped: false,
        isLoading: false,
        isMutating: false,
        selectedPlanId: null,
        ...options.initialState,
    };
    state.selectedPlanId = resolveSelectedPlanId(state.dashboard, state.selectedPlanId);
    function emit() {
        listeners.forEach((listener) => listener());
    }
    function setState(next) {
        const partial = typeof next === "function" ? next(state) : next;
        state = {
            ...state,
            ...partial,
        };
        state.selectedPlanId = resolveSelectedPlanId(state.dashboard, state.selectedPlanId);
        emit();
    }
    async function loadDashboard() {
        return service.getDashboard();
    }
    async function runMutation(callback, input) {
        const packageId = resolvePlanId(state, input);
        setState({
            isMutating: true,
            lastError: undefined,
            selectedPlanId: packageId,
        });
        try {
            const result = await callback(packageId);
            const dashboard = await loadDashboard();
            setState({
                dashboard,
                isBootstrapped: true,
                isMutating: false,
            });
            return result;
        }
        catch (error) {
            setState({
                isMutating: false,
                lastError: error instanceof Error ? error.message : "Membership request failed.",
            });
            throw error;
        }
    }
    return {
        async bootstrap() {
            setState({
                isLoading: true,
                lastError: undefined,
            });
            try {
                const dashboard = await loadDashboard();
                setState({
                    dashboard,
                    isBootstrapped: true,
                    isLoading: false,
                });
                return state;
            }
            catch (error) {
                setState({
                    isLoading: false,
                    lastError: error instanceof Error ? error.message : "Failed to load membership center.",
                });
                throw error;
            }
        },
        getState() {
            return state;
        },
        async purchaseSelectedPlan(input) {
            return runMutation((packageId) => service.purchaseMembership({ ...input, packageId }), input);
        },
        async refresh() {
            const dashboard = await loadDashboard();
            setState({
                dashboard,
                isBootstrapped: true,
                isLoading: false,
            });
            return state;
        },
        async renewSelectedPlan(input) {
            return runMutation((packageId) => service.renewMembership({ ...input, packageId }), input);
        },
        selectPlan(packageId) {
            setState({
                selectedPlanId: packageId,
            });
        },
        service,
        setView(view) {
            setState({
                activeView: view,
            });
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        async upgradeSelectedPlan(input) {
            return runMutation((packageId) => service.upgradeMembership({ ...input, packageId }), input);
        },
    };
}
export function useSdkworkMembershipController(controller) {
    return useMemo(() => controller ?? createSdkworkMembershipController(), [controller]);
}
export function useSdkworkMembershipControllerState(controller) {
    return useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
}
//# sourceMappingURL=membership-controller.js.map