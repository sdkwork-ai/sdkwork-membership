export const APP_MEMBERSHIP_METHOD_TREE = {
    memberships: {
        benefits: { list: true },
        current: {
            retrieve: true,
            status: { retrieve: true },
        },
        plans: { list: true },
        packageGroups: {
            list: true,
            retrieve: true,
            packages: { list: true },
        },
        packages: {
            list: true,
            retrieve: true,
        },
        purchases: {
            create: true,
            renew: true,
            upgrade: true,
        },
        points: {
            balance: { retrieve: true },
            history: { list: true },
            dailyRewards: {
                create: true,
                status: { retrieve: true },
            },
        },
        privileges: {
            usage: { retrieve: true },
            speedUps: { create: true },
        },
        accessChecks: { create: true },
    },
};
//# sourceMappingURL=index.js.map