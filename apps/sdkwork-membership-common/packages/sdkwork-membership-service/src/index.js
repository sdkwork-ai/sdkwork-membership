import { APP_MEMBERSHIP_METHOD_TREE, } from "@sdkwork/membership-sdk-ports";
import { formatMoney } from "@sdkwork/utils/money";
import { isSdkworkIamSessionAuthenticated, } from "@sdkwork/iam-runtime";
import { createMembershipAppSdkClientFromTransport, createMembershipAppTransportClient, } from "./transport.js";
export { createMembershipAppSdkClientFromTransport, createMembershipAppTransportClient, } from "./transport.js";
export * from "./backend.js";
export { SDKWORK_MEMBERSHIP_DEFAULT_LIST_PAGE_SIZE, createSdkworkMembershipListQuery, unwrapSdkworkMembershipPageItems, unwrapSdkworkMembershipResponse, } from "./list-envelope.js";
// ─── Global provider registry ──────────────────────────────────────────────
//
// Providers are stored on `globalThis` instead of module-level variables to
// survive the "dual-package hazard" where Vite, pnpm, or bundler
// deduplication may load this module twice.  When that happens, a
// module-level `let` would be reset to `null` in the duplicate copy, causing
// the cloudrouter's `configureSdkworkMembershipAppServiceProvider()` call to
// write to one instance while `getSdkworkMembershipService()` reads from
// another — resulting in "provider is not configured" errors even though
// the host already called configure.
//
// Storing on `globalThis` guarantees a single shared slot regardless of how
// many times the module is instantiated.
const MEMBERSHIP_REGISTRY_INIT_KEY = Symbol.for("sdkwork.membership.registryInitialized");
const MEMBERSHIP_PROVIDER_KEY = Symbol.for("sdkwork.membership.appServiceProvider");
const MEMBERSHIP_TOKEN_PROVIDER_KEY = Symbol.for("sdkwork.membership.sessionTokenProvider");
function getGlobalRegistry() {
    const global = globalThis;
    if (!global[MEMBERSHIP_REGISTRY_INIT_KEY]) {
        const registry = {
            [MEMBERSHIP_REGISTRY_INIT_KEY]: true,
            [MEMBERSHIP_PROVIDER_KEY]: null,
            [MEMBERSHIP_TOKEN_PROVIDER_KEY]: () => ({}),
        };
        Object.assign(global, registry);
    }
    return global;
}
export function configureSdkworkMembershipAppServiceProvider(provider) {
    getGlobalRegistry()[MEMBERSHIP_PROVIDER_KEY] = provider;
}
export function configureSdkworkMembershipSessionTokenProvider(provider) {
    getGlobalRegistry()[MEMBERSHIP_TOKEN_PROVIDER_KEY] = provider ?? (() => ({}));
}
export function getSdkworkMembershipService() {
    const provider = getGlobalRegistry()[MEMBERSHIP_PROVIDER_KEY];
    if (!provider) {
        throw new Error("SDKWork membership service provider is not configured. Call configureSdkworkMembershipAppServiceProvider() from membership PC bootstrap.");
    }
    return provider();
}
export function getSdkworkMembershipSessionTokens() {
    const tokens = getGlobalRegistry()[MEMBERSHIP_TOKEN_PROVIDER_KEY]();
    return {
        accessToken: normalizeSessionToken(tokens.accessToken),
        authToken: normalizeSessionToken(tokens.authToken),
        refreshToken: normalizeSessionToken(tokens.refreshToken),
    };
}
export function hasSdkworkMembershipSession() {
    return isSdkworkIamSessionAuthenticated(getSdkworkMembershipSessionTokens());
}
export function requireSdkworkMembershipSession(message = "Authentication required") {
    if (!hasSdkworkMembershipSession()) {
        throw new Error(message);
    }
}
export function createSdkworkMembershipAppService(input) {
    return {
        memberships: buildServiceTree(APP_MEMBERSHIP_METHOD_TREE.memberships, input.appClient.commerce.memberships, ["commerce", "memberships"]),
    };
}
export function bootstrapSdkworkMembershipAppService(input) {
    const transport = createMembershipAppTransportClient(input);
    const service = createSdkworkMembershipAppService({
        appClient: createMembershipAppSdkClientFromTransport(transport),
    });
    configureSdkworkMembershipAppServiceProvider(() => service);
    configureSdkworkMembershipSessionTokenProvider(() => {
        if (input.tokenManager) {
            return input.tokenManager.getTokens();
        }
        return {
            accessToken: input.accessToken,
            authToken: input.authToken,
        };
    });
    return service;
}
export function toSdkworkMembershipOptionalString(value) {
    const normalized = typeof value === "string" ? value.trim() : String(value ?? "").trim();
    return normalized || undefined;
}
export function toNullableSdkworkMembershipNumber(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string" && value.trim()) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}
export function toSdkworkMembershipNumber(value, fallback = 0) {
    return toNullableSdkworkMembershipNumber(value) ?? fallback;
}
export function toSdkworkMembershipMutationStatus(status) {
    const normalized = String(status ?? "").trim().toUpperCase();
    if (normalized === "SUCCESS" || normalized === "COMPLETED" || normalized === "PAID") {
        return "completed";
    }
    if (normalized === "FAILED"
        || normalized === "REJECTED"
        || normalized === "CANCELLED"
        || normalized === "CANCELED"
        || normalized === "CLOSED"
        || normalized === "EXPIRED") {
        return "failed";
    }
    return "pending";
}
export function formatSdkworkMembershipCurrencyCny(value, language = "en-US") {
    return formatMoney(value, { currency: "CNY", locale: language, mode: "symbol" }) ?? "--";
}
export function formatSdkworkMembershipPoints(value, language = "en-US") {
    return new Intl.NumberFormat(language).format(value);
}
export function readSdkworkMediaResource(value) {
    if (!value || typeof value !== "object") {
        return undefined;
    }
    const resource = value;
    if (!resource.kind || !resource.source) {
        return undefined;
    }
    return resource;
}
function buildServiceTree(template, client, missingPathPrefix, servicePath = []) {
    const service = {};
    for (const [key, marker] of Object.entries(template)) {
        const nextServicePath = [...servicePath, key];
        if (marker === true) {
            const missingPath = [...missingPathPrefix, ...nextServicePath].join(".");
            service[key] = (...args) => callMembership(readMethod(client, nextServicePath), missingPath, ...args);
        }
        else {
            service[key] = buildServiceTree(marker, client, missingPathPrefix, nextServicePath);
        }
    }
    return service;
}
function readMethod(root, path) {
    let node = root;
    for (const segment of path) {
        if (!node || typeof node !== "object") {
            return undefined;
        }
        const parent = node;
        node = parent[segment];
        if (typeof node === "function") {
            return node.bind(parent);
        }
    }
    return typeof node === "function" ? node : undefined;
}
async function callMembership(method, name, ...args) {
    if (!method) {
        throw new Error(`Missing SDKWork membership SDK resource: ${name}`);
    }
    return method(...args);
}
function normalizeSessionToken(value) {
    const normalized = typeof value === "string" ? value.trim() : "";
    return normalized || undefined;
}
//# sourceMappingURL=index.js.map