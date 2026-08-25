import type { AuthTokenManager } from "@sdkwork/sdk-common";
import { type SdkworkAppClient as MembershipAppTransportClient } from "@sdkwork/membership-app-sdk";
import type { MembershipAppSdkClient } from "@sdkwork/membership-sdk-ports";
export type { MembershipAppTransportClient };
export declare function resolveMembershipAppApiOrigin(baseUrl: string): string;
export declare function createMembershipAppSdkClientFromTransport(transport: MembershipAppTransportClient): MembershipAppSdkClient;
export interface BootstrapSdkworkMembershipAppServiceInput {
    baseUrl: string;
    authToken?: string;
    accessToken?: string;
    tenantId?: string;
    organizationId?: string;
    platform?: string;
    tokenManager?: AuthTokenManager;
}
export declare function createMembershipAppTransportClient(input: BootstrapSdkworkMembershipAppServiceInput): MembershipAppTransportClient;
//# sourceMappingURL=transport.d.ts.map