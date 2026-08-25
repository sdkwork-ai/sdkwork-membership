import { createClient, } from "@sdkwork/membership-app-sdk";
const APP_API_SUFFIX = "/app/v3/api";
export function resolveMembershipAppApiOrigin(baseUrl) {
    const trimmed = baseUrl.trim().replace(/\/+$/u, "");
    if (trimmed.endsWith(APP_API_SUFFIX)) {
        return trimmed.slice(0, -APP_API_SUFFIX.length);
    }
    return trimmed;
}
export function createMembershipAppSdkClientFromTransport(transport) {
    return {
        commerce: {
            memberships: transport.memberships,
        },
    };
}
export function createMembershipAppTransportClient(input) {
    const config = {
        baseUrl: resolveMembershipAppApiOrigin(input.baseUrl),
        authToken: input.authToken,
        accessToken: input.accessToken,
        tenantId: input.tenantId,
        organizationId: input.organizationId,
        platform: input.platform,
        tokenManager: input.tokenManager,
    };
    return createClient(config);
}
//# sourceMappingURL=transport.js.map