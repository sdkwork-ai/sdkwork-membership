import { createClient as createGeneratedAppClient, SdkworkAppClient, } from '../generated/server-openapi/src/index';
export { SdkworkAppClient, SdkworkAppClient as SdkworkMembershipAppClient, createGeneratedAppClient };
export * from '../generated/server-openapi/src/types/index';
export * from '../generated/server-openapi/src/api/index';
export * from '../generated/server-openapi/src/http/index';
export * from '../generated/server-openapi/src/auth/index';
export function createClient(config) {
    return createGeneratedAppClient(config);
}
//# sourceMappingURL=index.js.map