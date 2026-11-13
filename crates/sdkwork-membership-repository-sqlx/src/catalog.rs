use crate::{
    AppMembershipBenefitItem, AppMembershipDailyRewardResponse,
    AppMembershipDailyRewardStatusResponse, AppMembershipInfoResponse,
    AppMembershipPackageGroupItem, AppMembershipPackageItem, AppMembershipPlanItem,
    AppMembershipPointsBalanceResponse, AppMembershipPointsHistoryItem,
    AppMembershipPrivilegeUsageResponse, AppMembershipStatusResponse,
};

pub fn builtin_info() -> AppMembershipInfoResponse {
    AppMembershipInfoResponse {
        plan_rank: 0,
        plan_name: "Free".to_string(),
        membership_status: "inactive".to_string(),
        started_at: None,
        expires_at: None,
        remaining_days: None,
        total_days: None,
        total_spent: Some("0".to_string()),
        points: Some(50),
        growth_value: Some(0),
        upgrade_growth_value: Some(725),
        benefits: builtin_benefits(None),
    }
}

pub fn builtin_status() -> AppMembershipStatusResponse {
    AppMembershipStatusResponse {
        active: false,
        plan_rank: 0,
        expires_at: None,
        point_balance: Some(50),
    }
}

pub fn builtin_plans() -> Vec<AppMembershipPlanItem> {
    vec![
        AppMembershipPlanItem {
            id: 0,
            category: "token".to_string(),
            name: "Free".to_string(),
            rank: 0,
            required_points: Some(0),
            description: Some("体验核心功能，每日赠送算力积分".to_string()),
            icon: None,
            badge: Some("免费".to_string()),
        },
        AppMembershipPlanItem {
            id: 1,
            category: "token".to_string(),
            name: "基础会员".to_string(),
            rank: 1,
            required_points: Some(330),
            description: Some("适合个人创作者，解锁基础AI能力".to_string()),
            icon: None,
            badge: Some("热门".to_string()),
        },
        AppMembershipPlanItem {
            id: 2,
            category: "token".to_string(),
            name: "标准会员".to_string(),
            rank: 2,
            required_points: Some(950),
            description: Some("适合专业创作者，解锁全部AI模型".to_string()),
            icon: None,
            badge: Some("推荐".to_string()),
        },
        AppMembershipPlanItem {
            id: 3,
            category: "token".to_string(),
            name: "高级会员".to_string(),
            rank: 3,
            required_points: Some(2600),
            description: Some("适合团队和重度用户，享受专属通道".to_string()),
            icon: None,
            badge: Some("旗舰".to_string()),
        },
        AppMembershipPlanItem {
            id: 4,
            category: "token".to_string(),
            name: "超级会员".to_string(),
            rank: 4,
            required_points: Some(7500),
            description: Some("顶级VIP通道、最大配额与专属特效".to_string()),
            icon: None,
            badge: Some("至尊".to_string()),
        },
    ]
}

pub fn builtin_benefits(_plan_id: Option<i64>) -> Vec<AppMembershipBenefitItem> {
    vec![
        AppMembershipBenefitItem {
            id: 1,
            name: "每日赠送算力积分".to_string(),
            benefit_key: Some("daily_points".to_string()),
            r#type: Some("points".to_string()),
            description: Some("每日登录可领取算力积分".to_string()),
            icon: None,
            claimed: false,
            usage_limit: Some(50),
            display_value: None,
            used_count: Some(0),
        },
        AppMembershipBenefitItem {
            id: 2,
            name: "标准生成通道".to_string(),
            benefit_key: Some("standard_queue".to_string()),
            r#type: Some("queue".to_string()),
            description: Some("标准优先级生成队列".to_string()),
            icon: None,
            claimed: true,
            usage_limit: None,
            display_value: None,
            used_count: None,
        },
        AppMembershipBenefitItem {
            id: 3,
            name: "快速生成通道".to_string(),
            benefit_key: Some("fast_queue".to_string()),
            r#type: Some("queue".to_string()),
            description: Some("高优先级快速生成队列".to_string()),
            icon: None,
            claimed: false,
            usage_limit: None,
            display_value: None,
            used_count: None,
        },
        AppMembershipBenefitItem {
            id: 4,
            name: "VIP专属通道".to_string(),
            benefit_key: Some("vip_queue".to_string()),
            r#type: Some("queue".to_string()),
            description: Some("最高优先级专属队列，无需等待".to_string()),
            icon: None,
            claimed: false,
            usage_limit: None,
            display_value: None,
            used_count: None,
        },
        AppMembershipBenefitItem {
            id: 5,
            name: "无水印导出".to_string(),
            benefit_key: Some("no_watermark".to_string()),
            r#type: Some("feature".to_string()),
            description: Some("导出作品无平台水印".to_string()),
            icon: None,
            claimed: false,
            usage_limit: None,
            display_value: None,
            used_count: None,
        },
        AppMembershipBenefitItem {
            id: 6,
            name: "专属客服".to_string(),
            benefit_key: Some("vip_support".to_string()),
            r#type: Some("service".to_string()),
            description: Some("专属客服通道优先响应".to_string()),
            icon: None,
            claimed: false,
            usage_limit: None,
            display_value: None,
            used_count: None,
        },
    ]
}

/// Built-in billing recurrence for the demo catalog rows (which carry only a
/// duration in days).
fn catalog_recurrence_cycle(duration_days: i64) -> &'static str {
    match duration_days {
        0..=31 => "month",
        32..=92 => "quarter",
        _ => "year",
    }
}

fn catalog_plan_rank(plan_name: &str) -> i64 {
    match plan_name {
        "基础会员" => 1,
        "标准会员" => 2,
        "高级会员" => 3,
        "超级会员" => 4,
        _ => 0,
    }
}

#[allow(clippy::too_many_arguments)]
fn builtin_package_item(
    id: i64,
    name: &str,
    description: &str,
    price: &str,
    original_price: Option<&str>,
    point_amount: i64,
    duration_days: i64,
    plan_name: &str,
    sort_weight: i64,
    recommended: bool,
    tags: &[&str],
) -> AppMembershipPackageItem {
    let plan_rank = catalog_plan_rank(plan_name);
    AppMembershipPackageItem {
        id,
        category: "token".to_owned(),
        audience: "personal".to_owned(),
        name: name.to_owned(),
        description: Some(description.to_owned()),
        price: price.to_owned(),
        original_price: original_price.map(str::to_owned),
        price_unit: "package".to_owned(),
        point_amount,
        duration_days,
        plan_name: Some(plan_name.to_owned()),
        // The demo catalog has no storage plan id; the rank is its identity.
        plan_id: plan_rank.to_string(),
        plan_rank,
        recurrence_cycle: Some(catalog_recurrence_cycle(duration_days).to_owned()),
        seat_min: 1,
        seat_max: 500,
        seat_points_amount: 0,
        sort_weight,
        recommended,
        tags: tags.iter().map(|tag| (*tag).to_owned()).collect(),
    }
}

fn builtin_group(
    id: i64,
    name: &str,
    description: Option<&str>,
    sort_weight: i64,
    duration_days: i64,
    packages: Vec<AppMembershipPackageItem>,
) -> AppMembershipPackageGroupItem {
    AppMembershipPackageGroupItem {
        id,
        category: "token".to_owned(),
        audience: "personal".to_owned(),
        name: name.to_owned(),
        description: description.map(str::to_owned),
        billing_cycle: Some(catalog_recurrence_cycle(duration_days).to_owned()),
        duration_days,
        sort_weight,
        packages,
    }
}

pub fn builtin_package_groups() -> Vec<AppMembershipPackageGroupItem> {
    vec![
        builtin_group(
            1,
            "连续包年",
            Some("5.8折"),
            1,
            365,
            vec![
                builtin_package_item(
                    101,
                    "基础会员·年卡",
                    "连续包年，到期自动续费",
                    "393",
                    Some("659"),
                    3930,
                    365,
                    "基础会员",
                    1,
                    false,
                    &["首年6折", "11算力积分/天"],
                ),
                builtin_package_item(
                    102,
                    "标准会员·年卡",
                    "连续包年，到期自动续费",
                    "1099",
                    Some("1899"),
                    10990,
                    365,
                    "标准会员",
                    2,
                    true,
                    &["首年5.8折", "30算力积分/天"],
                ),
                builtin_package_item(
                    103,
                    "高级会员·年卡",
                    "连续包年，到期自动续费",
                    "3099",
                    Some("5199"),
                    30990,
                    365,
                    "高级会员",
                    3,
                    false,
                    &["首年6折", "85算力积分/天"],
                ),
                builtin_package_item(
                    104,
                    "超级会员·年卡",
                    "连续包年，到期自动续费",
                    "8999",
                    Some("12999"),
                    89990,
                    365,
                    "超级会员",
                    4,
                    false,
                    &["首年7折", "247算力积分/天"],
                ),
            ],
        ),
        builtin_group(
            2,
            "连续包月",
            Some("6折"),
            2,
            30,
            vec![
                builtin_package_item(
                    201,
                    "基础会员·月卡",
                    "连续包月，到期自动续费",
                    "33",
                    Some("55"),
                    330,
                    30,
                    "基础会员",
                    1,
                    false,
                    &["6折", "11算力积分/天"],
                ),
                builtin_package_item(
                    202,
                    "标准会员·月卡",
                    "连续包月，到期自动续费",
                    "95",
                    Some("158"),
                    950,
                    30,
                    "标准会员",
                    2,
                    true,
                    &["6折", "30算力积分/天"],
                ),
                builtin_package_item(
                    203,
                    "高级会员·月卡",
                    "连续包月，到期自动续费",
                    "260",
                    Some("433"),
                    2600,
                    30,
                    "高级会员",
                    3,
                    false,
                    &["6折", "85算力积分/天"],
                ),
                builtin_package_item(
                    204,
                    "超级会员·月卡",
                    "连续包月，到期自动续费",
                    "750",
                    Some("1083"),
                    7500,
                    30,
                    "超级会员",
                    4,
                    false,
                    &["7折", "247算力积分/天"],
                ),
            ],
        ),
        builtin_group(
            3,
            "连续包季",
            Some("7折"),
            3,
            90,
            vec![
                builtin_package_item(
                    301,
                    "基础会员·季卡",
                    "连续包季，到期自动续费",
                    "116",
                    Some("165"),
                    1160,
                    90,
                    "基础会员",
                    1,
                    false,
                    &["7折", "11算力积分/天"],
                ),
                builtin_package_item(
                    302,
                    "标准会员·季卡",
                    "连续包季，到期自动续费",
                    "332",
                    Some("474"),
                    3320,
                    90,
                    "标准会员",
                    2,
                    false,
                    &["7折", "30算力积分/天"],
                ),
                builtin_package_item(
                    303,
                    "高级会员·季卡",
                    "连续包季，到期自动续费",
                    "909",
                    Some("1299"),
                    9090,
                    90,
                    "高级会员",
                    3,
                    false,
                    &["7折", "85算力积分/天"],
                ),
                builtin_package_item(
                    304,
                    "超级会员·季卡",
                    "连续包季，到期自动续费",
                    "2625",
                    Some("3249"),
                    26250,
                    90,
                    "超级会员",
                    4,
                    false,
                    &["8折", "247算力积分/天"],
                ),
            ],
        ),
        builtin_group(
            4,
            "单月购买",
            None,
            4,
            30,
            vec![
                builtin_package_item(
                    401,
                    "基础会员·单月",
                    "单次购买，不自动续费",
                    "55",
                    None,
                    550,
                    30,
                    "基础会员",
                    1,
                    false,
                    &["11算力积分/天"],
                ),
                builtin_package_item(
                    402,
                    "标准会员·单月",
                    "单次购买，不自动续费",
                    "158",
                    None,
                    1580,
                    30,
                    "标准会员",
                    2,
                    false,
                    &["30算力积分/天"],
                ),
                builtin_package_item(
                    403,
                    "高级会员·单月",
                    "单次购买，不自动续费",
                    "433",
                    None,
                    4330,
                    30,
                    "高级会员",
                    3,
                    false,
                    &["85算力积分/天"],
                ),
                builtin_package_item(
                    404,
                    "超级会员·单月",
                    "单次购买，不自动续费",
                    "1083",
                    None,
                    10830,
                    30,
                    "超级会员",
                    4,
                    false,
                    &["247算力积分/天"],
                ),
            ],
        ),
    ]
}

pub fn builtin_packages(
    package_group_id: Option<i64>,
    plan_id: Option<i64>,
) -> Vec<AppMembershipPackageItem> {
    let groups = builtin_package_groups();
    let mut packages: Vec<AppMembershipPackageItem> = Vec::new();

    for group in groups {
        if let Some(gid) = package_group_id {
            if group.id != gid {
                continue;
            }
        }
        for package in group.packages {
            if let Some(pid) = plan_id {
                let plan_rank = match package.plan_name.as_deref() {
                    Some("基础会员") => 1,
                    Some("标准会员") => 2,
                    Some("高级会员") => 3,
                    Some("超级会员") => 4,
                    _ => 0,
                };
                if plan_rank != pid {
                    continue;
                }
            }
            packages.push(package);
        }
    }
    packages
}

pub fn builtin_package(package_id: i64) -> Option<AppMembershipPackageItem> {
    builtin_packages(None, None)
        .into_iter()
        .find(|p| p.id == package_id)
}

pub fn builtin_package_group(package_group_id: i64) -> Option<AppMembershipPackageGroupItem> {
    builtin_package_groups()
        .into_iter()
        .find(|g| g.id == package_group_id)
}

pub fn builtin_points_balance() -> AppMembershipPointsBalanceResponse {
    AppMembershipPointsBalanceResponse {
        points: 50,
        available_points: 50,
        frozen_points: 0,
    }
}

pub fn builtin_points_history() -> Vec<AppMembershipPointsHistoryItem> {
    vec![AppMembershipPointsHistoryItem {
        id: "points-1".to_string(),
        change_type: "daily_reward".to_string(),
        change_amount: 50,
        before_balance: Some(0),
        after_balance: 50,
        source_type: "system".to_string(),
        remark: Some("每日登录奖励".to_string()),
        created_at: Some("2025-01-01T08:00:00Z".to_string()),
    }]
}

pub fn builtin_daily_reward_status() -> AppMembershipDailyRewardStatusResponse {
    AppMembershipDailyRewardStatusResponse {
        can_claim: true,
        claimed_today: false,
        consecutive_days: 1,
        total_days: 1,
    }
}

pub fn builtin_daily_reward_claim() -> AppMembershipDailyRewardResponse {
    AppMembershipDailyRewardResponse {
        reward_points: 50,
        claimed_at: Some("2025-01-01T08:00:00Z".to_string()),
        consecutive_days: 1,
    }
}

pub fn builtin_privilege_usage() -> AppMembershipPrivilegeUsageResponse {
    AppMembershipPrivilegeUsageResponse {
        speed_up_used: 0,
        speed_up_limit: 3,
        priority_queue_used: 0,
        priority_queue_limit: 100,
        exclusive_model_used: 0,
        exclusive_model_limit: 0,
    }
}
