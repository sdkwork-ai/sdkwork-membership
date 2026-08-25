import { sdkworkSubscriptionCheckoutEnUsResource } from "./en-US/commerce/subscription/checkout";
import { SDKWORK_SUBSCRIPTION_I18N_KEYS } from "../subscription-i18n-keys";
import { sdkworkSubscriptionCheckoutZhCnResource } from "./zh-CN/commerce/subscription/checkout";
function flattenResource(resource, prefix = "", output = {}) {
    for (const [key, value] of Object.entries(resource)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (typeof value === "string") {
            output[path] = value;
        }
        else {
            flattenResource(value, path, output);
        }
    }
    return output;
}
export const sdkworkSubscriptionCheckoutResources = {
    "en-US": sdkworkSubscriptionCheckoutEnUsResource,
    "zh-CN": sdkworkSubscriptionCheckoutZhCnResource,
};
export const sdkworkSubscriptionCheckoutMessages = {
    "en-US": flattenResource(sdkworkSubscriptionCheckoutEnUsResource),
    "zh-CN": flattenResource(sdkworkSubscriptionCheckoutZhCnResource),
};
export const sdkworkSubscriptionCheckoutI18nBundle = {
    en: sdkworkSubscriptionCheckoutMessages["en-US"],
    zh: sdkworkSubscriptionCheckoutMessages["zh-CN"],
};
export { SDKWORK_SUBSCRIPTION_I18N_KEYS };
//# sourceMappingURL=index.js.map