import type { CSSProperties } from "react";
import { type SdkworkThemeVisualTone } from "@sdkwork/ui-pc-react/theme";
export type SdkworkMembershipVisualTone = SdkworkThemeVisualTone;
export declare function createSdkworkMembershipToneStyle(tone: SdkworkMembershipVisualTone, options?: {
    backgroundWeight?: number;
    borderWeight?: number;
}): CSSProperties;
export declare function createSdkworkMembershipPanelStyle(tone: SdkworkMembershipVisualTone, options?: {
    backgroundWeight?: number;
    borderWeight?: number;
    surfaceColor?: string;
    surfaceWeight?: number;
}): CSSProperties;
export declare function createSdkworkMembershipGlassStyle(tone: SdkworkMembershipVisualTone, options?: {
    backgroundWeight?: number;
    borderWeight?: number;
    surfaceColor?: string;
    surfaceWeight?: number;
}): CSSProperties;
export declare function createSdkworkMembershipBackdropStyle(): CSSProperties;
export declare function createSdkworkMembershipHeroStyle(): CSSProperties;
export declare function createSdkworkMembershipHeroTextStyle(tone?: "muted" | "primary" | "subtle"): CSSProperties;
//# sourceMappingURL=membership-appearance.d.ts.map