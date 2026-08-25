export const SDKWORK_MEMBERSHIP_DEFAULT_LIST_PAGE_SIZE = 20;
/**
 * Creates a standard list query object for SDK membership list endpoints.
 *
 * The generated TypeScript SDK methods (e.g. MembershipsBenefitsApi.list,
 * MembershipsPackagesApi.list) accept camelCase parameter names
 * (`pageSize`, `planId`) that the SDK internally serialises to snake_case
 * query string keys (`page_size`, `plan_id`).  Returning camelCase keys
 * here ensures the SDK correctly forwards pagination and filter
 * parameters to the backend.
 *
 * `category` classifies the catalog request. Token surfaces default to
 * `'token'` so Token Plan queries always transmit the type parameter and
 * community/circle catalog data never leaks into the Token Plan purchase
 * flow; pass `'community'` for circle surfaces.
 */
export function createSdkworkMembershipListQuery(page = 1, pageSize = SDKWORK_MEMBERSHIP_DEFAULT_LIST_PAGE_SIZE, category = "token") {
    return {
        page,
        pageSize,
        category,
    };
}
export function unwrapSdkworkMembershipResponse(value, fallbackMessage = "Request failed.") {
    if (!value || typeof value !== "object") {
        return value;
    }
    if (!("code" in value)) {
        const unwrapped = unwrapSdkworkMembershipResourceData(value);
        if (unwrapped !== value) {
            return unwrapped;
        }
        return value;
    }
    const candidate = value;
    if (typeof candidate.code !== "number") {
        throw new Error("Invalid SDKWork membership response envelope.");
    }
    if (candidate.code === 0) {
        if (!("data" in value)) {
            throw new Error("Invalid SDKWork membership response envelope.");
        }
        return unwrapSdkworkMembershipResourceData(candidate.data);
    }
    const detail = typeof candidate.detail === "string" && candidate.detail.trim()
        ? candidate.detail
        : typeof candidate.title === "string" && candidate.title.trim()
            ? candidate.title
            : fallbackMessage;
    throw new Error(detail);
}
function unwrapSdkworkMembershipResourceData(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return value;
    }
    const record = value;
    // Depending on the generated SDK version, the standard resource envelope
    // may be returned as data.item, item, or already as the item itself.
    if ("item" in record) {
        return record.item;
    }
    if ("data" in record) {
        const data = record.data;
        if (data && typeof data === "object" && !Array.isArray(data) && "item" in data) {
            return data.item;
        }
    }
    return value;
}
export function unwrapSdkworkMembershipPageItems(value, fallbackMessage = "Request failed.") {
    const data = unwrapSdkworkMembershipResponse(value, fallbackMessage);
    if (Array.isArray(data)) {
        return data;
    }
    if (data && typeof data === "object" && Array.isArray(data.items)) {
        return data.items;
    }
    return [];
}
//# sourceMappingURL=list-envelope.js.map