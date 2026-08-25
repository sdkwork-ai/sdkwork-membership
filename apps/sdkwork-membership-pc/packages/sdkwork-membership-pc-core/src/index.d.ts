export type SdkworkMembershipPcRouteSurface = "app" | "backend-admin";
export interface SdkworkMembershipPcRouteContribution {
    readonly auth: "public" | "required";
    readonly capability: string;
    readonly domain: "membership";
    readonly id: string;
    readonly packageName: string;
    readonly path: string;
    readonly permissionHint?: string;
    readonly screen: string;
    readonly surface: SdkworkMembershipPcRouteSurface;
    readonly title: string;
    readonly titleKey: string;
}
export declare const sdkworkMembershipPcRuntimeIdentity: {
    readonly appKey: "sdkwork-membership-pc";
    readonly architecture: "pc-react";
    readonly domain: "membership";
    readonly capability: "membership";
    readonly runtimeFamily: "web";
};
export declare function createSdkworkMembershipPcRouteRegistry(...routeGroups: readonly (readonly SdkworkMembershipPcRouteContribution[])[]): readonly SdkworkMembershipPcRouteContribution[];
//# sourceMappingURL=index.d.ts.map