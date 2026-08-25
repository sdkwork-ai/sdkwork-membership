import { createSdkworkBackdropStyle, createSdkworkGlassStyle, createSdkworkHeroStyle, createSdkworkPanelStyle, createSdkworkToneStyle, } from "@sdkwork/ui-pc-react/theme";
export function createSdkworkMembershipToneStyle(tone, options = {}) {
    return createSdkworkToneStyle(tone, options);
}
export function createSdkworkMembershipPanelStyle(tone, options = {}) {
    return createSdkworkPanelStyle(tone, options);
}
export function createSdkworkMembershipGlassStyle(tone, options = {}) {
    return createSdkworkGlassStyle(tone, options);
}
export function createSdkworkMembershipBackdropStyle() {
    return createSdkworkBackdropStyle();
}
export function createSdkworkMembershipHeroStyle() {
    return createSdkworkHeroStyle();
}
export function createSdkworkMembershipHeroTextStyle(tone = "primary") {
    if (tone === "muted") {
        return {
            color: "color-mix(in srgb, white 72%, var(--sdk-color-brand-accent))",
        };
    }
    if (tone === "subtle") {
        return {
            color: "color-mix(in srgb, white 64%, var(--sdk-color-brand-accent))",
        };
    }
    return {
        color: "color-mix(in srgb, white 92%, var(--sdk-color-brand-accent))",
    };
}
//# sourceMappingURL=membership-appearance.js.map