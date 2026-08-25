import { type PageInfo, type SdkWorkPageData } from "@sdkwork/utils";
export declare const SDKWORK_MEMBERSHIP_DEFAULT_LIST_PAGE_SIZE = 20;
export interface SdkworkMembershipResponseEnvelope<T> {
    code: 0;
    data: T;
    traceId: string;
}
export interface SdkworkMembershipProblemDetail {
    type?: string;
    title?: string;
    status?: number;
    detail?: string;
    instance?: string;
    operationId?: string;
    code: number;
    traceId: string;
    errors?: Array<{
        field: string;
        code: string;
        message?: string;
    }>;
}
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
export declare function createSdkworkMembershipListQuery(page?: number, pageSize?: number, category?: "token" | "community"): {
    page: number;
    pageSize: number;
    category: "token" | "community";
};
export declare function unwrapSdkworkMembershipResponse<T>(value: unknown, fallbackMessage?: string): T;
export declare function unwrapSdkworkMembershipPageItems<T>(value: unknown, fallbackMessage?: string): T[];
export type { PageInfo, SdkWorkPageData };
//# sourceMappingURL=list-envelope.d.ts.map