export const SDKWORK_SUBSCRIPTION_CATALOG_UNAVAILABLE_TIER_KEY = "none";
export function createSdkworkSubscriptionCatalogBillingCycles(translate) {
    return [
        { label: translate("pay_yearly", "连续包年"), discountLabel: "5.8折" },
        { label: translate("pay_monthly", "连续包月"), discountLabel: "6折" },
        { label: translate("pay_quarterly", "连续包季"), discountLabel: "7折" },
        { label: translate("pay_single_month", "单月购买") },
    ];
}
export function createSdkworkSubscriptionCatalogPlanCards(translate) {
    return [
        {
            buttonStyle: "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100",
            buttonText: "¥393 首年6折",
            disabled: false,
            features: [
                { text: "智能体上限", tag: "3个" },
                { text: "每日匹配次数", tag: "无限制" },
                { text: "标准算力通道", tag: translate("tag_free", "Free") },
                { text: "参与常规赛事" },
                { text: translate("worry_free_refund", "Worry-free Refund") },
            ],
            id: "basic",
            membershipTierKey: "pro",
            name: translate("basic_plan", "基础会员"),
            originalPriceLabel: "¥659",
            packageNumericId: 0,
            packagePeriodLabel: "每年",
            pointsAllowanceLabel: "328 算力积分/月",
            pointsConversionLabel: "换算¥10=100算力积分",
            priceLabel: "393",
            subtitle: "首年6折¥393，次年续费金额¥659，包年可随时取消",
        },
        {
            buttonStyle: "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100",
            buttonText: "¥1,099 首年5.8折",
            disabled: false,
            features: [
                { text: "智能体上限", tag: "10个" },
                { text: "每日匹配次数", tag: "无限制" },
                { text: "进阶AI助手", tag: translate("tag_free", "Free") },
                { text: "高级算力通道", tag: translate("tag_free", "Free"), emptyCheck: true },
                { text: "创建专属赛事" },
                { text: translate("worry_free_refund", "Worry-free Refund") },
                { text: "商城专属折扣" },
            ],
            id: "pro",
            membershipTierKey: "peak",
            name: translate("pro_plan", "高级会员"),
            originalPriceLabel: "¥1899",
            packageNumericId: 0,
            packagePeriodLabel: "每年",
            pointsAllowanceLabel: "916 算力积分/月",
            pointsConversionLabel: "换算¥10=100算力积分",
            priceLabel: "1099",
            subtitle: "首年5.8折¥1099，次年续费金额¥1899，包年可随时取消",
        },
        {
            buttonStyle: "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100",
            buttonText: "¥3,099 首年6折",
            disabled: false,
            features: [
                { text: "智能体上限", tag: "无限" },
                { text: "每日匹配次数", tag: "无限制" },
                { text: translate("privilege_match", "Fast Match"), tag: translate("tag_priority", "Priority") },
                { text: "巅峰算力通道", tag: translate("tag_free", "Free") },
                { text: "主办官方赛事" },
                { text: translate("worry_free_refund", "Worry-free Refund") },
                { text: "巅峰专属特效" },
            ],
            id: "peak",
            membershipTierKey: "peak",
            name: translate("peak_plan", "巅峰会员"),
            originalPriceLabel: "¥5199",
            packageNumericId: 0,
            packagePeriodLabel: "每年",
            pointsAllowanceLabel: "2,583 算力积分/月",
            pointsConversionLabel: "换算¥10=100算力积分",
            priceLabel: "3099",
            subtitle: "首年6折¥3099，次年续费金额¥5199，包年可随时取消",
        },
        {
            buttonStyle: "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100",
            buttonText: "¥8,999 首年7折",
            disabled: false,
            features: [
                { text: "智能体上限", tag: "无限" },
                { text: "每日匹配次数", tag: "无限制" },
                { text: translate("privilege_match", "Fast Match"), tag: translate("tag_priority", "Priority") },
                { text: translate("quantum_compute_channel", "Quantum Compute Channel"), tag: translate("tag_free", "Free") },
                { text: translate("host_global_tournaments", "Host Global Tournaments") },
                { text: translate("worry_free_refund", "Worry-free Refund") },
                { text: translate("super_exclusive_effects", "Super Exclusive Effects") },
            ],
            id: "super",
            membershipTierKey: "super",
            name: translate("super_plan", "超级会员"),
            originalPriceLabel: "¥12,999",
            packageNumericId: 0,
            packagePeriodLabel: "每年",
            pointsAllowanceLabel: "7,499 算力积分/月",
            pointsConversionLabel: "换算¥10=100算力积分",
            priceLabel: "8999",
            subtitle: "首年7折¥8999，次年续费金额¥12999，包年可随时取消",
        },
    ];
}
export function createSdkworkSubscriptionCatalogComparisonCategories() {
    return [
        {
            categoryLabel: "算力积分",
            rows: [
                { benefitLabel: "平台免费算力积分", values: ["每日登陆免费算力积分", "每日登录赠送算力积分", "每日登录赠送算力积分", "每日登录赠送算力积分", "每日登录赠送算力积分"] },
                { benefitLabel: "充值购买算力积分", values: [true, true, true, true, true] },
                { benefitLabel: "订阅会员算力积分", values: ["-", "每月328算力积分", "每月916算力积分", "每月2,583算力积分", "每月7,499算力积分"] },
            ],
        },
        {
            categoryLabel: "视频生成",
            rows: [
                { benefitLabel: "seedance2.0 VIP模型", values: ["-", true, true, true, true] },
                { benefitLabel: "seedance1.5 Pro模型", values: ["-", "8折算力积分", "8折算力积分", "8折算力积分", "8折算力积分"] },
                { benefitLabel: "视频生成专享加速", values: ["-", "标准生成通道", "标准生成通道", "快速生成通道", "快速生成通道"] },
                { benefitLabel: "视频对口型", values: ["-", true, true, true, true] },
                { benefitLabel: "视频高清", values: ["-", true, true, true, true] },
                { benefitLabel: "视频补帧", values: ["-", true, true, true, true] },
            ],
        },
        {
            categoryLabel: "图片生成",
            rows: [
                { benefitLabel: "图片 4.0 限时免费", values: ["-", "2K", "2K", "2K/4K", "2K/4K"] },
                { benefitLabel: "智能超清", values: ["-", "4K", "4K", "4K/8K", "4K/8K"] },
            ],
        },
        {
            categoryLabel: "全局能力",
            rows: [
                { benefitLabel: "去除品牌水印", values: ["-", true, true, true, true] },
                { benefitLabel: "生成加速", values: ["-", true, true, true, true] },
                { benefitLabel: "无忧退款", values: ["-", true, true, true, true] },
            ],
        },
    ];
}
//# sourceMappingURL=subscription-catalog-content.js.map