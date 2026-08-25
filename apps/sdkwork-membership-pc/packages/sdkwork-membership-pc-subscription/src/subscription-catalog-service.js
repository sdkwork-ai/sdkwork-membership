import { createSdkworkMembershipListQuery, getSdkworkMembershipService, hasSdkworkMembershipSession, requireSdkworkMembershipSession, toNullableSdkworkMembershipNumber, toSdkworkMembershipNumber, unwrapSdkworkMembershipPageItems, unwrapSdkworkMembershipResponse, } from "@sdkwork/membership-service";
import { createSdkworkSubscriptionService, } from "./subscription-service";
import { buildComparisonCategories, mapPackageGroupsToBillingCycles, mapPackagesToPlanCards, mapPackagesToTierColumns, resolveMemberSummaryFromPlanRank, resolvePlanRankFromPackage, } from "./subscription-catalog-mapper";
import { createSdkworkSubscriptionCatalogBillingCycles, createSdkworkSubscriptionCatalogComparisonCategories, createSdkworkSubscriptionCatalogPlanCards, } from "./subscription-catalog-content";
const CATALOG_LIST_QUERY = createSdkworkMembershipListQuery(1, 200, "token");
async function fetchBenefitsByRank(membershipAppService) {
    // Benefits are catalog data — they should be publicly visible.  However,
    // if the backend still returns 401 (e.g. during migration), we catch the
    // error and return empty arrays so the catalog page renders plans and
    // packages without requiring login.
    const entries = await Promise.all([0, 1, 2, 3].map(async (rank) => {
        try {
            const payload = await membershipAppService.memberships.benefits.list({
                ...CATALOG_LIST_QUERY,
                planId: String(rank),
            });
            const benefits = unwrapSdkworkMembershipPageItems(payload);
            return [rank, benefits];
        }
        catch {
            return [rank, []];
        }
    }));
    return Object.fromEntries(entries);
}
async function fetchMemberSummary(membershipAppService) {
    if (!hasSdkworkMembershipSession()) {
        return null;
    }
    try {
        const statusPayload = await membershipAppService.memberships.current.status.retrieve();
        const status = unwrapSdkworkMembershipResponse(statusPayload);
        const planRank = toNullableSdkworkMembershipNumber(status?.planRank);
        return resolveMemberSummaryFromPlanRank(planRank);
    }
    catch {
        return null;
    }
}
function resolveTranslate(translate) {
    return translate ?? ((_, defaultValue) => defaultValue ?? "");
}
export function createSdkworkSubscriptionCatalogService(options = {}) {
    const resolveMembershipAppService = () => options.membershipAppService ?? getSdkworkMembershipService();
    const subscriptionService = options.subscriptionService
        ?? createSdkworkSubscriptionService({
            checkoutPort: options.checkoutPort,
            membershipAppService: options.membershipAppService,
            locale: options.locale,
        });
    const translate = resolveTranslate(options.translate);
    return {
        async getCatalog() {
            const membershipAppService = resolveMembershipAppService();
            const isLoggedIn = hasSdkworkMembershipSession();
            // Catalog data (package groups, plans, benefits) is public — visible
            // to anonymous visitors browsing the token-plan page.
            // The member summary requires authentication and is skipped for
            // anonymous visitors.
            const fetches = [
                membershipAppService.memberships.packageGroups.list(CATALOG_LIST_QUERY)
                    .catch(() => ({ code: 0, data: { items: [], pageInfo: { mode: "offset", page: 1, pageSize: 200, total: 0 } }, traceId: "" })),
                membershipAppService.memberships.plans.list(CATALOG_LIST_QUERY)
                    .catch(() => ({ code: 0, data: { items: [], pageInfo: { mode: "offset", page: 1, pageSize: 200, total: 0 } }, traceId: "" })),
                isLoggedIn ? fetchMemberSummary(membershipAppService) : Promise.resolve(null),
                fetchBenefitsByRank(membershipAppService),
            ];
            const [packageGroupsPayload, plansPayload, memberSummary, benefitsByRank] = await Promise.all(fetches);
            const packageGroups = unwrapSdkworkMembershipPageItems(packageGroupsPayload);
            const plans = unwrapSdkworkMembershipPageItems(plansPayload);
            const billingCycles = packageGroups.length > 0
                ? mapPackageGroupsToBillingCycles(packageGroups)
                : createSdkworkSubscriptionCatalogBillingCycles(translate);
            const comparisonCategories = buildComparisonCategories(benefitsByRank);
            return {
                benefitsByRank,
                billingCycles,
                comparisonCategories,
                memberSummary,
                packageGroupIds: packageGroups.map((group) => toSdkworkMembershipNumber(group.id)),
                packageGroups,
                plans,
            };
        },
        getViewModel(catalog, billingCycleIndex) {
            const safeIndex = Math.max(0, Math.min(billingCycleIndex, Math.max(catalog.packageGroups.length - 1, 0)));
            const selectedGroup = catalog.packageGroups[safeIndex];
            const packages = Array.isArray(selectedGroup?.packages) ? selectedGroup.packages : [];
            const memberSummary = catalog.memberSummary;
            return {
                billingCycleIndex: safeIndex,
                billingCycles: catalog.billingCycles,
                comparisonCategories: catalog.comparisonCategories,
                memberSummary,
                // Render the real packages for the selected billing cycle. When a
                // cycle has no packages, render an empty plan area instead of
                // repeating the same static fallback cards for every tab — otherwise
                // switching tabs appears to do nothing.
                planCards: packages.length > 0
                    ? mapPackagesToPlanCards(packages, catalog.plans, memberSummary, translate)
                    : [],
                selectedPackageGroupId: selectedGroup ? toSdkworkMembershipNumber(selectedGroup.id) : null,
                tierColumns: packages.length > 0
                    ? mapPackagesToTierColumns(packages, catalog.plans, memberSummary, translate)
                    : [],
            };
        },
        getFallbackViewModel(billingCycleIndex = 0) {
            const planCards = createSdkworkSubscriptionCatalogPlanCards(translate);
            const tierColumns = planCards
                .filter((plan) => !plan.disabled && plan.id !== "super")
                .slice(0, 3)
                .map((plan) => ({
                buttonDisabled: false,
                buttonText: plan.buttonText,
                membershipTierKey: plan.membershipTierKey,
                name: plan.name,
                packageId: plan.id,
                packageNumericId: Number(plan.id) || 0,
                packagePeriodLabel: plan.packagePeriodLabel,
                priceLabel: plan.priceLabel,
                originalPriceLabel: plan.originalPriceLabel || undefined,
            }));
            return {
                billingCycleIndex,
                billingCycles: createSdkworkSubscriptionCatalogBillingCycles(translate),
                comparisonCategories: createSdkworkSubscriptionCatalogComparisonCategories(),
                memberSummary: null,
                planCards,
                selectedPackageGroupId: null,
                tierColumns,
            };
        },
        async getPurchaseStatus(orderId) {
            return subscriptionService.getPurchaseStatus(orderId);
        },
        async purchasePackage(input) {
            requireSdkworkMembershipSession("Authentication required");
            if (input.packageId <= 0) {
                throw new Error("A valid membership package is required.");
            }
            const membershipAppService = resolveMembershipAppService();
            let action = "purchase";
            if (hasSdkworkMembershipSession()) {
                try {
                    const [statusPayload, packagesPayload, plansPayload] = await Promise.all([
                        membershipAppService.memberships.current.status.retrieve(),
                        membershipAppService.memberships.packages.list(CATALOG_LIST_QUERY),
                        membershipAppService.memberships.plans.list(CATALOG_LIST_QUERY),
                    ]);
                    const status = unwrapSdkworkMembershipResponse(statusPayload);
                    if (status?.active) {
                        const packages = unwrapSdkworkMembershipPageItems(packagesPayload);
                        const plans = unwrapSdkworkMembershipPageItems(plansPayload);
                        const selected = packages.find((pkg) => toSdkworkMembershipNumber(pkg.id) === input.packageId);
                        const currentRank = toNullableSdkworkMembershipNumber(status.planRank) ?? 0;
                        const targetRank = selected ? resolvePlanRankFromPackage(selected, plans) : currentRank;
                        action = targetRank > currentRank ? "upgrade" : "renew";
                    }
                }
                catch {
                    action = "purchase";
                }
            }
            if (action === "upgrade") {
                return subscriptionService.upgradeSubscription(input);
            }
            if (action === "renew") {
                return subscriptionService.renewSubscription(input);
            }
            return subscriptionService.purchaseSubscription(input);
        },
    };
}
//# sourceMappingURL=subscription-catalog-service.js.map