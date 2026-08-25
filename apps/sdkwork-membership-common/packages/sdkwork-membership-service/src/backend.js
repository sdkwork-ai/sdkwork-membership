export const SDKWORK_MEMBERSHIP_BACKEND_DEFAULT_PAGE_SIZE = 20;
export const SDKWORK_MEMBERSHIP_BACKEND_MAX_PAGE_SIZE = 200;
export function createSdkworkMembershipBackendService(client) {
    return {
        listPlans: (query) => loadPage(client.memberships.plans.list(toListParams(query)), query),
        createPlan: (input) => client.memberships.plans.create(input),
        updatePlan: (id, input) => client.memberships.plans.update(id, input),
        deletePlan: (id) => client.memberships.plans.delete(id),
        listPackageGroups: (query) => loadPage(client.memberships.packageGroups.list(toListParams(query)), query),
        createPackageGroup: (input) => client.memberships.packageGroups.create(input),
        updatePackageGroup: (id, input) => client.memberships.packageGroups.update(id, input),
        deletePackageGroup: (id) => client.memberships.packageGroups.delete(id),
        listPackages: (query) => loadPage(client.memberships.packages.list(toPackageListParams(query)), query),
        createPackage: (input) => client.memberships.packages.create(input),
        updatePackage: (id, input) => client.memberships.packages.update(id, input),
        deletePackage: (id) => client.memberships.packages.delete(id),
        listMembers: (query) => loadPage(client.memberships.members.list(toMemberListParams(query)), query),
        getMember: (id) => client.memberships.members.retrieve(id),
        updateMemberStatus: (id, input) => client.memberships.members.status.update(id, input),
        listEntitlements: (query) => loadPage(client.memberships.entitlements.list(toEntitlementListParams(query)), query),
    };
}
function toListParams(query = {}) {
    const category = query.category === "community" || query.category === "token" ? query.category : undefined;
    return {
        page: normalizePage(query.page),
        pageSize: normalizePageSize(query.pageSize),
        status: normalizeOptionalText(query.status),
        category,
    };
}
function toMemberListParams(query = {}) {
    return {
        ...toListParams(query),
        planId: normalizeOptionalText(query.planId),
        userId: normalizeOptionalText(query.userId),
    };
}
function toPackageListParams(query = {}) {
    return {
        ...toListParams(query),
        packageGroupId: normalizeOptionalText(query.packageGroupId),
        planId: normalizeOptionalText(query.planId),
    };
}
function toEntitlementListParams(query = {}) {
    return {
        ...toListParams(query),
        membershipId: normalizeOptionalText(query.membershipId),
        planId: normalizeOptionalText(query.planId),
    };
}
async function loadPage(request, query = {}) {
    return unwrapMembershipBackendPage(await request, normalizePage(query.page), normalizePageSize(query.pageSize));
}
function unwrapMembershipBackendPage(value, fallbackPage, fallbackPageSize) {
    const root = requireRecord(value, "membership backend list response");
    if ("code" in root) {
        if (root.code !== 0) {
            throw new Error(readProblemDetail(root));
        }
        return unwrapPageData(root.data, fallbackPage, fallbackPageSize);
    }
    return unwrapPageData(root, fallbackPage, fallbackPageSize);
}
function unwrapPageData(value, fallbackPage, fallbackPageSize) {
    const data = requireRecord(value, "membership backend page data");
    if (!Array.isArray(data.items)) {
        throw new Error("Invalid membership backend page: items must be an array.");
    }
    const rawPageInfo = requireRecord(data.pageInfo, "membership backend pageInfo");
    const mode = rawPageInfo.mode;
    if (mode !== "offset" && mode !== "cursor") {
        throw new Error("Invalid membership backend page: pageInfo.mode is required.");
    }
    return {
        items: data.items,
        pageInfo: {
            mode,
            page: readOptionalPositiveInteger(rawPageInfo.page) ?? (mode === "offset" ? fallbackPage : undefined),
            pageSize: readOptionalPositiveInteger(rawPageInfo.pageSize) ?? fallbackPageSize,
            totalItems: readOptionalNonNegativeNumber(rawPageInfo.totalItems),
            totalPages: readOptionalNonNegativeInteger(rawPageInfo.totalPages),
            nextCursor: readOptionalNullableText(rawPageInfo.nextCursor),
            hasMore: typeof rawPageInfo.hasMore === "boolean" ? rawPageInfo.hasMore : undefined,
        },
    };
}
function normalizePage(value) {
    return Number.isInteger(value) && Number(value) > 0 ? Number(value) : 1;
}
function normalizePageSize(value) {
    if (!Number.isInteger(value) || Number(value) <= 0) {
        return SDKWORK_MEMBERSHIP_BACKEND_DEFAULT_PAGE_SIZE;
    }
    return Math.min(Number(value), SDKWORK_MEMBERSHIP_BACKEND_MAX_PAGE_SIZE);
}
function normalizeOptionalText(value) {
    const normalized = value?.trim();
    return normalized || undefined;
}
function requireRecord(value, label) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`Invalid ${label}.`);
    }
    return value;
}
function readProblemDetail(value) {
    for (const key of ["detail", "title"]) {
        if (typeof value[key] === "string" && value[key].trim()) {
            return value[key].trim();
        }
    }
    return "Membership backend request failed.";
}
function readOptionalPositiveInteger(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
function readOptionalNonNegativeInteger(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}
function readOptionalNonNegativeNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}
function readOptionalNullableText(value) {
    if (value === null) {
        return null;
    }
    return normalizeOptionalText(typeof value === "string" ? value : undefined);
}
//# sourceMappingURL=backend.js.map