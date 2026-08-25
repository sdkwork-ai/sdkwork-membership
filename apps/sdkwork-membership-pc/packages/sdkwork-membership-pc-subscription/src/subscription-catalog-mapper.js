import { formatSdkworkMembershipCurrencyCny, formatSdkworkMembershipPoints, toNullableSdkworkMembershipNumber, toSdkworkMembershipNumber, toSdkworkMembershipOptionalString, } from "@sdkwork/membership-service";
import { formatMoney } from "@sdkwork/utils/money";
import { SDKWORK_SUBSCRIPTION_CATALOG_UNAVAILABLE_TIER_KEY } from "./subscription-catalog-content";
const PLAN_RANK_DISPLAY = {
    1: { membershipTierKey: "pro", nameKey: "basic_plan" },
    2: { membershipTierKey: "peak", nameKey: "pro_plan" },
    3: { membershipTierKey: "peak", nameKey: "peak_plan" },
    4: { membershipTierKey: "super", nameKey: "super_plan" },
};
const SUPER_RANK = 4;
function findBenefit(benefits, benefitKey) {
    return benefits.find((benefit) => toSdkworkMembershipOptionalString(benefit.benefitKey) === benefitKey);
}
function hasActiveBenefit(benefits, benefitKey) {
    const benefit = findBenefit(benefits, benefitKey);
    if (!benefit)
        return false;
    const displayValue = toSdkworkMembershipOptionalString(benefit.displayValue);
    if (displayValue)
        return true;
    const usageLimit = toNullableSdkworkMembershipNumber(benefit.usageLimit);
    return Boolean(usageLimit && usageLimit > 0);
}
function findBenefitDisplayValue(benefits, benefitKey) {
    const benefit = findBenefit(benefits, benefitKey);
    if (!benefit)
        return undefined;
    return toSdkworkMembershipOptionalString(benefit.displayValue);
}
/** Returns true when the benefit is present in the data; otherwise applies a
 * rank-based fallback that matches the static comparison table. */
function booleanValueWithFallback(benefits, benefitKey, rank) {
    if (hasActiveBenefit(benefits, benefitKey))
        return true;
    if (rank === SUPER_RANK)
        return true;
    return rank > 0;
}
/** Returns the text display value from benefit data; otherwise applies a
 * rank-based fallback. */
function textValueWithFallback(benefits, benefitKey, rank, fallback) {
    const value = findBenefitDisplayValue(benefits, benefitKey);
    if (value)
        return value;
    return fallback(rank);
}
const COMPARE_BENEFIT_ROWS = [
    // ── 算力积分 ──────────────────────────────────────────────
    {
        benefitKeys: ["platform_free_points"],
        categoryLabel: "算力积分",
        label: "平台免费算力积分",
        valueForRank: (rank, benefits) => textValueWithFallback(benefits, "platform_free_points", rank, (r) => r === 0 ? "每日登陆免费算力积分" : "每日登录赠送算力积分"),
    },
    {
        benefitKeys: ["purchased_points"],
        categoryLabel: "算力积分",
        label: "充值购买算力积分",
        valueForRank: (rank, benefits) => booleanValueWithFallback(benefits, "purchased_points", rank),
    },
    {
        benefitKeys: ["daily_points"],
        categoryLabel: "算力积分",
        label: "订阅会员算力积分",
        valueForRank: (rank, benefits) => {
            if (rank === SUPER_RANK && !hasActiveBenefit(benefits, "daily_points")) {
                return "每月7,499算力积分";
            }
            if (rank <= 0 && !hasActiveBenefit(benefits, "daily_points")) {
                return "-";
            }
            const benefit = findBenefit(benefits, "daily_points");
            const quantity = toNullableSdkworkMembershipNumber(benefit?.usageLimit);
            return quantity ? `每月${formatSdkworkMembershipPoints(quantity, "zh-CN")}算力积分` : "-";
        },
    },
    // ── 视频生成 ──────────────────────────────────────────
    {
        benefitKeys: ["seedance_vip_model"],
        categoryLabel: "视频生成",
        label: "seedance2.0 VIP模型",
        valueForRank: (rank, benefits) => booleanValueWithFallback(benefits, "seedance_vip_model", rank),
    },
    {
        benefitKeys: ["seedance_pro_model"],
        categoryLabel: "视频生成",
        label: "seedance1.5 Pro模型",
        valueForRank: (rank, benefits) => textValueWithFallback(benefits, "seedance_pro_model", rank, (r) => r === 0 ? "-" : "8折算力积分"),
    },
    {
        benefitKeys: ["standard_queue", "fast_queue", "vip_queue"],
        categoryLabel: "视频生成",
        label: "视频生成专享加速",
        valueForRank: (rank, benefits) => {
            for (const key of ["vip_queue", "fast_queue", "standard_queue"]) {
                const value = findBenefitDisplayValue(benefits, key);
                if (value)
                    return value;
            }
            if (rank <= 0)
                return "-";
            if (rank === SUPER_RANK)
                return "快速生成通道";
            return rank <= 2 ? "标准生成通道" : "快速生成通道";
        },
    },
    {
        benefitKeys: ["video_lip_sync"],
        categoryLabel: "视频生成",
        label: "视频对口型",
        valueForRank: (rank, benefits) => booleanValueWithFallback(benefits, "video_lip_sync", rank),
    },
    {
        benefitKeys: ["video_hd"],
        categoryLabel: "视频生成",
        label: "视频高清",
        valueForRank: (rank, benefits) => booleanValueWithFallback(benefits, "video_hd", rank),
    },
    {
        benefitKeys: ["video_frame_interp"],
        categoryLabel: "视频生成",
        label: "视频补帧",
        valueForRank: (rank, benefits) => booleanValueWithFallback(benefits, "video_frame_interp", rank),
    },
    // ── 图片生成 ──────────────────────────────────────────
    {
        benefitKeys: ["image_4k_free"],
        categoryLabel: "图片生成",
        label: "图片 4.0 限时免费",
        valueForRank: (rank, benefits) => textValueWithFallback(benefits, "image_4k_free", rank, (r) => {
            if (r <= 0)
                return "-";
            if (r === SUPER_RANK)
                return "2K/4K";
            return r <= 2 ? "2K" : "2K/4K";
        }),
    },
    {
        benefitKeys: ["smart_upscale"],
        categoryLabel: "图片生成",
        label: "智能超清",
        valueForRank: (rank, benefits) => textValueWithFallback(benefits, "smart_upscale", rank, (r) => {
            if (r <= 0)
                return "-";
            if (r === SUPER_RANK)
                return "4K/8K";
            return r <= 2 ? "4K" : "4K/8K";
        }),
    },
    // ── 全局能力 ──────────────────────────────────────────
    {
        benefitKeys: ["no_watermark"],
        categoryLabel: "全局能力",
        label: "去除品牌水印",
        valueForRank: (rank, benefits) => booleanValueWithFallback(benefits, "no_watermark", rank),
    },
    {
        benefitKeys: ["generation_acceleration"],
        categoryLabel: "全局能力",
        label: "生成加速",
        valueForRank: (rank, benefits) => booleanValueWithFallback(benefits, "generation_acceleration", rank),
    },
    {
        benefitKeys: ["vip_support"],
        categoryLabel: "全局能力",
        label: "无忧退款",
        valueForRank: (rank, benefits) => booleanValueWithFallback(benefits, "vip_support", rank),
    },
];
export function resolvePlanRankFromPackage(pkg, plans) {
    const planName = toSdkworkMembershipOptionalString(pkg.planName ?? pkg.levelName);
    if (planName) {
        const matchedPlan = plans.find((plan) => toSdkworkMembershipOptionalString(plan.name) === planName);
        if (matchedPlan) {
            return toSdkworkMembershipNumber(matchedPlan.rank ?? matchedPlan.id);
        }
        if (planName.includes("基础")) {
            return 1;
        }
        if (planName.includes("标准")) {
            return 2;
        }
        if (planName.includes("高级")) {
            return 3;
        }
        if (planName.includes("超级")) {
            return 4;
        }
    }
    const packageName = toSdkworkMembershipOptionalString(pkg.name) ?? "";
    if (packageName.includes("基础")) {
        return 1;
    }
    if (packageName.includes("标准")) {
        return 2;
    }
    if (packageName.includes("高级")) {
        return 3;
    }
    if (packageName.includes("超级")) {
        return 4;
    }
    return 0;
}
export function mapPackageGroupsToBillingCycles(groups) {
    return [...groups]
        .sort((left, right) => toSdkworkMembershipNumber(left.sortWeight) - toSdkworkMembershipNumber(right.sortWeight)
        || toSdkworkMembershipNumber(left.id) - toSdkworkMembershipNumber(right.id))
        .map((group) => ({
        discountLabel: toSdkworkMembershipOptionalString(group.description),
        label: toSdkworkMembershipOptionalString(group.name) || "Subscription",
    }));
}
function resolvePeriodLabel(durationDays, translate) {
    if (durationDays >= 365) {
        return translate("per_year_short", "每年");
    }
    if (durationDays >= 90) {
        return translate("per_quarter_short", "每季");
    }
    return translate("per_month_short", "每月");
}
function resolveMonthlyPointAllowance(pointAmount, durationDays) {
    if (durationDays >= 365) {
        return Math.max(1, Math.round(pointAmount / 12));
    }
    if (durationDays >= 90) {
        return Math.max(1, Math.round(pointAmount / 3));
    }
    return pointAmount;
}
function resolveFeatureTemplates(rank, pointAmount, durationDays, translate) {
    if (rank === 1) {
        return [
            { text: "智能体上限", tag: "3个" },
            { text: "每日匹配次数", tag: "无限制" },
            { text: "标准算力通道", tag: translate("tag_free", "Free") },
            { text: "参与常规赛事" },
            { text: translate("worry_free_refund", "Worry-free Refund") },
        ];
    }
    if (rank === 2) {
        return [
            { text: "智能体上限", tag: "10个" },
            { text: "每日匹配次数", tag: "无限制" },
            { text: "进阶AI助手", tag: translate("tag_free", "Free") },
            { text: "高级算力通道", tag: translate("tag_free", "Free"), emptyCheck: true },
            { text: "创建专属赛事" },
            { text: translate("worry_free_refund", "Worry-free Refund") },
            { text: "商城专属折扣" },
        ];
    }
    if (rank === SUPER_RANK) {
        return [
            { text: "智能体上限", tag: "无限" },
            { text: "每日匹配次数", tag: "无限制" },
            { text: translate("privilege_match", "Fast Match"), tag: translate("tag_priority", "Priority") },
            { text: translate("quantum_compute_channel", "Quantum Compute Channel"), tag: translate("tag_free", "Free") },
            { text: translate("host_global_tournaments", "Host Global Tournaments") },
            { text: translate("worry_free_refund", "Worry-free Refund") },
            { text: translate("super_exclusive_effects", "Super Exclusive Effects") },
        ];
    }
    return [
        { text: "智能体上限", tag: "无限" },
        { text: "每日匹配次数", tag: "无限制" },
        { text: translate("privilege_match", "Fast Match"), tag: translate("tag_priority", "Priority") },
        { text: "巅峰算力通道", tag: translate("tag_free", "Free") },
        { text: "主办官方赛事" },
        { text: translate("worry_free_refund", "Worry-free Refund") },
        { text: "巅峰专属特效" },
    ];
}
function formatPriceLabel(value) {
    if (value === null) {
        return "--";
    }
    return (formatMoney(value, {
        currency: "CNY",
        locale: "zh-CN",
        mode: "symbol",
        minFractionDigits: 0,
        maxFractionDigits: 2,
    }) ?? formatSdkworkMembershipPoints(value, "zh-CN"));
}
function formatOriginalPriceLabel(value) {
    if (value === null) {
        return "";
    }
    return formatSdkworkMembershipCurrencyCny(value, "zh-CN");
}
function resolveButtonStyle(disabled) {
    return disabled
        ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed"
        : "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-100";
}
export function mapPackagesToPlanCards(packages, plans, memberSummary, translate) {
    const cards = [...packages]
        .sort((left, right) => toSdkworkMembershipNumber(left.sortWeight) - toSdkworkMembershipNumber(right.sortWeight)
        || toSdkworkMembershipNumber(left.id) - toSdkworkMembershipNumber(right.id))
        .map((pkg) => {
        const packageNumericId = toSdkworkMembershipNumber(pkg.id);
        const rank = resolvePlanRankFromPackage(pkg, plans);
        const display = PLAN_RANK_DISPLAY[rank] ?? PLAN_RANK_DISPLAY[1];
        const priceCny = toNullableSdkworkMembershipNumber(pkg.price);
        const originalPriceCny = toNullableSdkworkMembershipNumber(pkg.originalPrice);
        const pointAmount = toSdkworkMembershipNumber(pkg.pointAmount);
        const durationDays = toSdkworkMembershipNumber(pkg.durationDays, 30);
        const disabled = memberSummary?.membershipTierKey === display.membershipTierKey
            || display.membershipTierKey === SDKWORK_SUBSCRIPTION_CATALOG_UNAVAILABLE_TIER_KEY;
        const priceLabel = formatPriceLabel(priceCny);
        const originalPriceLabel = originalPriceCny ? formatOriginalPriceLabel(originalPriceCny) : "";
        const discountTag = Array.isArray(pkg.tags) ? pkg.tags[0] : undefined;
        return {
            buttonStyle: resolveButtonStyle(disabled),
            buttonText: disabled
                ? translate("current_plan", "当前计划")
                : discountTag
                    ? `${priceLabel} ${discountTag}`
                    : priceLabel,
            disabled,
            features: resolveFeatureTemplates(rank, pointAmount, durationDays, translate),
            id: String(packageNumericId),
            membershipTierKey: display.membershipTierKey,
            name: translate(display.nameKey, pkg.name || "Membership"),
            originalPriceLabel,
            packageNumericId,
            packagePeriodLabel: resolvePeriodLabel(durationDays, translate),
            pointsAllowanceLabel: `${formatSdkworkMembershipPoints(resolveMonthlyPointAllowance(pointAmount, durationDays), "zh-CN")} 算力积分/月`,
            pointsConversionLabel: priceCny
                ? `换算¥10=${Math.max(1, Math.round(pointAmount / Math.max(priceCny, 1) * 10))}算力积分`
                : "",
            priceLabel,
            subtitle: pkg.description || "",
        };
    });
    return cards;
}
export function mapPackagesToTierColumns(packages, plans, memberSummary, translate) {
    return [...packages]
        .sort((left, right) => toSdkworkMembershipNumber(left.sortWeight) - toSdkworkMembershipNumber(right.sortWeight)
        || toSdkworkMembershipNumber(left.id) - toSdkworkMembershipNumber(right.id))
        .map((pkg) => {
        const packageNumericId = toSdkworkMembershipNumber(pkg.id);
        const rank = resolvePlanRankFromPackage(pkg, plans);
        const display = PLAN_RANK_DISPLAY[rank] ?? PLAN_RANK_DISPLAY[1];
        const priceCny = toNullableSdkworkMembershipNumber(pkg.price);
        const originalPriceCny = toNullableSdkworkMembershipNumber(pkg.originalPrice);
        const durationDays = toSdkworkMembershipNumber(pkg.durationDays, 30);
        const isCurrentPlan = memberSummary?.membershipTierKey === display.membershipTierKey;
        const priceLabel = formatPriceLabel(priceCny);
        const discountTag = Array.isArray(pkg.tags) ? pkg.tags[0] : undefined;
        return {
            buttonDisabled: isCurrentPlan,
            buttonText: isCurrentPlan
                ? translate("current_plan", "当前计划")
                : discountTag
                    ? `¥${priceLabel} ${discountTag}`
                    : `¥${priceLabel} ${translate("first_year_60", "首年6折")}`,
            isCurrentPlan,
            membershipTierKey: display.membershipTierKey,
            name: translate(rank === 2 ? "standard_plan" : rank === 3 ? "premium_plan" : rank === 4 ? "super_plan" : "basic_plan", pkg.name || "Membership"),
            packageId: String(packageNumericId),
            packageNumericId,
            packagePeriodLabel: resolvePeriodLabel(durationDays, translate),
            priceLabel,
            originalPriceLabel: originalPriceCny ? formatOriginalPriceLabel(originalPriceCny) : undefined,
        };
    });
}
export function buildComparisonCategories(benefitsByRank) {
    const categories = new Map();
    for (const row of COMPARE_BENEFIT_ROWS) {
        const category = categories.get(row.categoryLabel) ?? {
            categoryLabel: row.categoryLabel,
            rows: [],
        };
        category.rows.push({
            benefitLabel: row.label,
            values: [0, 1, 2, 3, 4].map((rank) => row.valueForRank(rank, benefitsByRank[rank] ?? [])),
        });
        categories.set(row.categoryLabel, category);
    }
    return [...categories.values()];
}
export function resolveMemberSummaryFromPlanRank(planRank) {
    if (planRank === null || planRank <= 0) {
        return { membershipTierKey: "free", planRank: planRank ?? 0 };
    }
    const display = PLAN_RANK_DISPLAY[planRank];
    return {
        membershipTierKey: display?.membershipTierKey ?? "pro",
        planRank,
    };
}
//# sourceMappingURL=subscription-catalog-mapper.js.map