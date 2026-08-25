import { createClient as createGeneratedBackendClient, SdkworkBackendClient, } from '../generated/server-openapi/src/index';
export { SdkworkBackendClient, SdkworkBackendClient as SdkworkMembershipBackendClient, createGeneratedBackendClient };
export * from '../generated/server-openapi/src/types/index';
export * from '../generated/server-openapi/src/api/index';
export * from '../generated/server-openapi/src/http/index';
export * from '../generated/server-openapi/src/auth/index';
export function createClient(config) {
    return createGeneratedBackendClient(config);
}
//# sourceMappingURL=index.js.map