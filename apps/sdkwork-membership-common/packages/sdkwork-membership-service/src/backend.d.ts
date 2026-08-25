import type { AdminMembershipEntitlementItem, AdminMembershipMemberItem, AdminMembershipMemberStatusUpdate, AdminMembershipPackageGroupItem, AdminMembershipPackageGroupMutation, AdminMembershipPackageItem, AdminMembershipPackageMutation, AdminMembershipPlanItem, AdminMembershipPlanMutation, SdkworkBackendClient as SdkworkMembershipBackendClient } from "@sdkwork/membership-backend-sdk";
export type { AdminMembershipEntitlementItem, AdminMembershipMemberItem, AdminMembershipMemberStatusUpdate, AdminMembershipPackageGroupItem, AdminMembershipPackageGroupMutation, AdminMembershipPackageItem, AdminMembershipPackageMutation, AdminMembershipPlanItem, AdminMembershipPlanMutation, } from "@sdkwork/membership-backend-sdk";
export declare const SDKWORK_MEMBERSHIP_BACKEND_DEFAULT_PAGE_SIZE = 20;
export declare const SDKWORK_MEMBERSHIP_BACKEND_MAX_PAGE_SIZE = 200;
export interface MembershipBackendPageInfo {
    mode: "cursor" | "offset";
    page?: number;
    pageSize: number;
    totalItems?: number;
    totalPages?: number;
    nextCursor?: string | null;
    hasMore?: boolean;
}
export interface MembershipBackendPage<T> {
    items: T[];
    pageInfo: MembershipBackendPageInfo;
}
export interface MembershipBackendListQuery {
    page?: number;
    pageSize?: number;
    status?: string;
    /** Catalog classification filter (`token` Token Plan | `community` 圈子). */
    category?: "token" | "community";
}
export interface MembershipMemberListQuery extends MembershipBackendListQuery {
    userId?: string;
    planId?: string;
}
export interface MembershipPackageListQuery extends MembershipBackendListQuery {
    packageGroupId?: string;
    planId?: string;
}
export interface MembershipEntitlementListQuery extends MembershipBackendListQuery {
    membershipId?: string;
    planId?: string;
}
export interface SdkworkMembershipBackendService {
    listPlans(query?: MembershipBackendListQuery): Promise<MembershipBackendPage<AdminMembershipPlanItem>>;
    createPlan(input: AdminMembershipPlanMutation): Promise<AdminMembershipPlanItem>;
    updatePlan(id: string, input: AdminMembershipPlanMutation): Promise<AdminMembershipPlanItem>;
    deletePlan(id: string): Promise<void>;
    listPackageGroups(query?: MembershipBackendListQuery): Promise<MembershipBackendPage<AdminMembershipPackageGroupItem>>;
    createPackageGroup(input: AdminMembershipPackageGroupMutation): Promise<AdminMembershipPackageGroupItem>;
    updatePackageGroup(id: string, input: AdminMembershipPackageGroupMutation): Promise<AdminMembershipPackageGroupItem>;
    deletePackageGroup(id: string): Promise<void>;
    listPackages(query?: MembershipPackageListQuery): Promise<MembershipBackendPage<AdminMembershipPackageItem>>;
    createPackage(input: AdminMembershipPackageMutation): Promise<AdminMembershipPackageItem>;
    updatePackage(id: string, input: AdminMembershipPackageMutation): Promise<AdminMembershipPackageItem>;
    deletePackage(id: string): Promise<void>;
    listMembers(query?: MembershipMemberListQuery): Promise<MembershipBackendPage<AdminMembershipMemberItem>>;
    getMember(id: string): Promise<AdminMembershipMemberItem>;
    updateMemberStatus(id: string, input: AdminMembershipMemberStatusUpdate): Promise<AdminMembershipMemberItem>;
    listEntitlements(query?: MembershipEntitlementListQuery): Promise<MembershipBackendPage<AdminMembershipEntitlementItem>>;
}
export declare function createSdkworkMembershipBackendService(client: SdkworkMembershipBackendClient): SdkworkMembershipBackendService;
//# sourceMappingURL=backend.d.ts.map