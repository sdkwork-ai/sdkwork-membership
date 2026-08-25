export declare const APP_MEMBERSHIP_METHOD_TREE: {
    readonly memberships: {
        readonly benefits: {
            readonly list: true;
        };
        readonly current: {
            readonly retrieve: true;
            readonly status: {
                readonly retrieve: true;
            };
        };
        readonly plans: {
            readonly list: true;
        };
        readonly packageGroups: {
            readonly list: true;
            readonly retrieve: true;
            readonly packages: {
                readonly list: true;
            };
        };
        readonly packages: {
            readonly list: true;
            readonly retrieve: true;
        };
        readonly purchases: {
            readonly create: true;
            readonly renew: true;
            readonly upgrade: true;
        };
        readonly points: {
            readonly balance: {
                readonly retrieve: true;
            };
            readonly history: {
                readonly list: true;
            };
            readonly dailyRewards: {
                readonly create: true;
                readonly status: {
                    readonly retrieve: true;
                };
            };
        };
        readonly privileges: {
            readonly usage: {
                readonly retrieve: true;
            };
            readonly speedUps: {
                readonly create: true;
            };
        };
        readonly accessChecks: {
            readonly create: true;
        };
    };
};
export type MembershipRequestParams = Record<string, unknown>;
export type MembershipSdkResponse<T> = Promise<T | {
    code: 0;
    data: T;
    traceId: string;
} | {
    code: number;
    traceId: string;
    detail?: string;
    title?: string;
}>;
export type MembershipSdkMethod = (...args: any[]) => MembershipSdkResponse<any>;
type MethodTree = {
    readonly [key: string]: true | MethodTree;
};
export type ClientFromMethodTree<TTree extends MethodTree> = {
    readonly [TKey in keyof TTree]: TTree[TKey] extends true ? MembershipSdkMethod : TTree[TKey] extends MethodTree ? ClientFromMethodTree<TTree[TKey]> : never;
};
export type MembershipAppSdkClient = {
    commerce: ClientFromMethodTree<typeof APP_MEMBERSHIP_METHOD_TREE>;
};
export {};
//# sourceMappingURL=index.d.ts.map