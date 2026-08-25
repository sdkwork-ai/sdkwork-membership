import { APP_MEMBERSHIP_METHOD_TREE, type ClientFromMethodTree, type MembershipAppSdkClient } from "@sdkwork/membership-sdk-ports";
import type { SdkworkMembershipMutationStatus } from "@sdkwork/membership-contracts";
import { type BootstrapSdkworkMembershipAppServiceInput } from "./transport.ts";
import { type PageInfo, type SdkWorkPageData } from "./list-envelope.ts";
export { createMembershipAppSdkClientFromTransport, createMembershipAppTransportClient, type BootstrapSdkworkMembershipAppServiceInput, } from "./transport.ts";
export type { PageInfo, SdkWorkPageData };
export * from "./backend.ts";
export { SDKWORK_MEMBERSHIP_DEFAULT_LIST_PAGE_SIZE, createSdkworkMembershipListQuery, unwrapSdkworkMembershipPageItems, unwrapSdkworkMembershipResponse, type SdkworkMembershipProblemDetail, type SdkworkMembershipResponseEnvelope, } from "./list-envelope.ts";
export type SdkworkMembershipMembershipsService = ClientFromMethodTree<(typeof APP_MEMBERSHIP_METHOD_TREE)["memberships"]>;
export type SdkworkMembershipAppService = {
    memberships: SdkworkMembershipMembershipsService;
};
export type SdkworkMembershipAppServiceProvider = () => SdkworkMembershipAppService;
export interface SdkworkMembershipSessionTokens {
    accessToken?: string;
    authToken?: string;
    refreshToken?: string;
}
export type SdkworkMembershipSessionTokenProvider = () => SdkworkMembershipSessionTokens;
export interface CreateSdkworkMembershipAppServiceInput {
    appClient: MembershipAppSdkClient;
}
export type SdkworkMediaKind = "archive" | "audio" | "document" | "image" | "model" | "other" | "video";
export type SdkworkMediaSource = "data_url" | "external_url" | "generated" | "object_storage" | "provider_asset";
export interface SdkworkMediaResource {
    kind: SdkworkMediaKind;
    publicUrl?: string;
    source: SdkworkMediaSource;
    url?: string;
    [key: string]: unknown;
}
export declare function configureSdkworkMembershipAppServiceProvider(provider: SdkworkMembershipAppServiceProvider | null): void;
export declare function configureSdkworkMembershipSessionTokenProvider(provider: SdkworkMembershipSessionTokenProvider | null): void;
export declare function getSdkworkMembershipService(): SdkworkMembershipAppService;
export declare function getSdkworkMembershipSessionTokens(): SdkworkMembershipSessionTokens;
export declare function hasSdkworkMembershipSession(): boolean;
export declare function requireSdkworkMembershipSession(message?: string): void;
export declare function createSdkworkMembershipAppService(input: CreateSdkworkMembershipAppServiceInput): SdkworkMembershipAppService;
export declare function bootstrapSdkworkMembershipAppService(input: BootstrapSdkworkMembershipAppServiceInput): SdkworkMembershipAppService;
export declare function toSdkworkMembershipOptionalString(value: unknown): string | undefined;
export declare function toNullableSdkworkMembershipNumber(value: unknown): number | null;
export declare function toSdkworkMembershipNumber(value: unknown, fallback?: number): number;
export declare function toSdkworkMembershipMutationStatus(status: unknown): SdkworkMembershipMutationStatus;
export declare function formatSdkworkMembershipCurrencyCny(value: number | null | undefined, language?: string): string;
export declare function formatSdkworkMembershipPoints(value: number, language?: string): string;
export declare function readSdkworkMediaResource(value: unknown): SdkworkMediaResource | undefined;
//# sourceMappingURL=index.d.ts.map