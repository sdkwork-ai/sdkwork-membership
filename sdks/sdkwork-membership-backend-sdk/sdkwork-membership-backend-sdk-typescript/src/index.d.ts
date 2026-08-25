import { createClient as createGeneratedBackendClient, SdkworkBackendClient } from '../generated/server-openapi/src/index';
import type { SdkworkBackendConfig } from '../generated/server-openapi/src/types/common';
export { SdkworkBackendClient, SdkworkBackendClient as SdkworkMembershipBackendClient, createGeneratedBackendClient };
export type { SdkworkBackendConfig };
export * from '../generated/server-openapi/src/types/index';
export * from '../generated/server-openapi/src/api/index';
export * from '../generated/server-openapi/src/http/index';
export * from '../generated/server-openapi/src/auth/index';
export declare function createClient(config: SdkworkBackendConfig): SdkworkBackendClient;
//# sourceMappingURL=index.d.ts.map