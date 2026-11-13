-- ============================================================================
-- zh-CN locale seed: overrides display text for membership catalog tables.
--
-- This file runs AFTER common/001_catalog.sql and overwrites English default
-- display fields with Simplified Chinese text. It uses UPDATE statements keyed
-- by primary key so re-seeding is idempotent.
--
-- Pricing model: 10元 = 100算力积分 (1元 = 10算力积分)
-- point_amount = price × 10
-- ============================================================================

-- ---------------------------------------------------------------------------
-- membership_plan: plan display names and descriptions
-- ---------------------------------------------------------------------------
UPDATE membership_plan SET name = '免费版', description = '体验核心功能，每日赠送算力积分。', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-free';
UPDATE membership_plan SET name = '基础版', description = '面向个人创作者，解锁基础AI能力。', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-basic';
UPDATE membership_plan SET name = '标准版', description = '面向专业创作者，解锁全部AI模型。', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-standard';
UPDATE membership_plan SET name = '巅峰版', description = '面向团队和重度用户，享受专属通道。', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-premium';
UPDATE membership_plan SET name = '超级版', description = '顶级VIP通道、最大配额与专属特效。', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-super';
-- Community (circle) plan family
UPDATE membership_plan SET name = '圈子基础会员', description = '圈子会员：加入私密圈子，解锁专属内容与会员活动。', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-community-basic';

-- ---------------------------------------------------------------------------
-- membership_plan_version: version display titles
-- ---------------------------------------------------------------------------
UPDATE membership_plan_version SET title = '免费版', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-free-v1';
UPDATE membership_plan_version SET title = '基础版', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-basic-v1';
UPDATE membership_plan_version SET title = '标准版', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-standard-v1';
UPDATE membership_plan_version SET title = '巅峰版', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-premium-v1';
UPDATE membership_plan_version SET title = '超级版', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-super-v1';
-- Community (circle) plan family
UPDATE membership_plan_version SET title = '圈子基础会员', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-community-basic-v1';

-- ---------------------------------------------------------------------------
-- membership_benefit_definition: benefit display names and descriptions
-- ---------------------------------------------------------------------------
UPDATE membership_benefit_definition SET name = '平台免费算力积分', description = '每日登录免费算力积分。', updated_at = CURRENT_TIMESTAMP WHERE id = 'benefit-platform-free-points';
UPDATE membership_benefit_definition SET name = '充值购买算力积分', description = '充值购买的算力积分。', updated_at = CURRENT_TIMESTAMP WHERE id = 'benefit-purchased-points';
UPDATE membership_benefit_definition SET name = '订阅会员算力积分', description = '每月订阅赠送算力积分。', updated_at = CURRENT_TIMESTAMP WHERE id = 'benefit-daily-points';
UPDATE membership_benefit_definition SET name = 'Seedance 2.0 VIP模型', description = 'Seedance 2.0 VIP模型使用权限。', updated_at = CURRENT_TIMESTAMP WHERE id = 'benefit-seedance-vip-model';
UPDATE membership_benefit_definition SET name = 'Seedance 1.5 Pro模型', description = 'Seedance 1.5 Pro模型算力积分折扣。', updated_at = CURRENT_TIMESTAMP WHERE id = 'benefit-seedance-pro-model';
UPDATE membership_benefit_definition SET name = '标准生成通道', description = '标准优先级生成通道。', updated_at = CURRENT_TIMESTAMP WHERE id = 'benefit-standard-queue';
UPDATE membership_benefit_definition SET name = '快速生成通道', description = '高优先级快速生成通道。', updated_at = CURRENT_TIMESTAMP WHERE id = 'benefit-fast-queue';
UPDATE membership_benefit_definition SET name = 'VIP优先通道', description = '专属VIP生成通道。', updated_at = CURRENT_TIMESTAMP WHERE id = 'benefit-vip-queue';
UPDATE membership_benefit_definition SET name = '视频对口型', description = '视频对口型功能权限。', updated_at = CURRENT_TIMESTAMP WHERE id = 'benefit-video-lip-sync';
UPDATE membership_benefit_definition SET name = '视频高清', description = '视频高清导出功能。', updated_at = CURRENT_TIMESTAMP WHERE id = 'benefit-video-hd';
UPDATE membership_benefit_definition SET name = '视频补帧', description = '视频补帧功能。', updated_at = CURRENT_TIMESTAMP WHERE id = 'benefit-video-frame-interp';
UPDATE membership_benefit_definition SET name = '图片4.0限时免费', description = '图片4.0免费分辨率。', updated_at = CURRENT_TIMESTAMP WHERE id = 'benefit-image-4k-free';
UPDATE membership_benefit_definition SET name = '智能超清', description = '智能超清分辨率。', updated_at = CURRENT_TIMESTAMP WHERE id = 'benefit-smart-upscale';
UPDATE membership_benefit_definition SET name = '去除品牌水印', description = '导出无水印。', updated_at = CURRENT_TIMESTAMP WHERE id = 'benefit-no-watermark';
UPDATE membership_benefit_definition SET name = '生成加速', description = '加速生成速度。', updated_at = CURRENT_TIMESTAMP WHERE id = 'benefit-generation-acceleration';
UPDATE membership_benefit_definition SET name = '无忧退款', description = '无忧退款及优先客服支持。', updated_at = CURRENT_TIMESTAMP WHERE id = 'benefit-vip-support';

-- Privilege benefits (runtime quota)
UPDATE membership_benefit_definition SET name = '加速加速', description = '生成任务手动加速配额。', updated_at = CURRENT_TIMESTAMP WHERE id = 'seed-benefit-priority-speed-up';
UPDATE membership_benefit_definition SET name = '优先队列', description = '活跃会员优先队列容量。', updated_at = CURRENT_TIMESTAMP WHERE id = 'benefit-definition-priority_queue';
UPDATE membership_benefit_definition SET name = 'AI配额', description = '专属模型和AI配额。', updated_at = CURRENT_TIMESTAMP WHERE id = 'seed-benefit-ai-quota';

-- Community (circle) benefits
UPDATE membership_benefit_definition SET name = '私密圈子入口', description = '加入私密圈子，会员专属入口。', updated_at = CURRENT_TIMESTAMP WHERE id = 'benefit-community-circle-access';
UPDATE membership_benefit_definition SET name = '圈子专属内容', description = '解锁圈子专属帖子、资源与直播回放。', updated_at = CURRENT_TIMESTAMP WHERE id = 'benefit-community-exclusive-content';
UPDATE membership_benefit_definition SET name = '会员专属活动', description = '会员专属活动与线下聚会优先参与。', updated_at = CURRENT_TIMESTAMP WHERE id = 'benefit-community-member-events';

-- ---------------------------------------------------------------------------
-- membership_plan_benefit: grant_quantity display text (text-type cells only)
-- Numeric cells (e.g. '330', '1', '20') remain unchanged.
-- ---------------------------------------------------------------------------
-- Free plan
UPDATE membership_plan_benefit SET grant_quantity = '每日登录免费算力积分', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-free-v1-benefit-platform-points';

-- Basic plan
UPDATE membership_plan_benefit SET grant_quantity = '每日登录赠送算力积分', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-basic-v1-benefit-platform-points';
UPDATE membership_plan_benefit SET grant_quantity = '9.7折算力积分', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-basic-v1-benefit-seedance-pro';
UPDATE membership_plan_benefit SET grant_quantity = '标准生成通道', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-basic-v1-benefit-standard-queue';

-- Standard plan
UPDATE membership_plan_benefit SET grant_quantity = '每日登录赠送算力积分', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-standard-v1-benefit-platform-points';
UPDATE membership_plan_benefit SET grant_quantity = '9.7折算力积分', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-standard-v1-benefit-seedance-pro';
UPDATE membership_plan_benefit SET grant_quantity = '标准生成通道', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-standard-v1-benefit-standard-queue';

-- Premium plan
UPDATE membership_plan_benefit SET grant_quantity = '每日登录赠送算力积分', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-premium-v1-benefit-platform-points';
UPDATE membership_plan_benefit SET grant_quantity = '9.7折算力积分', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-premium-v1-benefit-seedance-pro';
UPDATE membership_plan_benefit SET grant_quantity = '快速生成通道', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-premium-v1-benefit-fast-queue';

-- Super plan
UPDATE membership_plan_benefit SET grant_quantity = '每日登录赠送算力积分', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-super-v1-benefit-platform-points';
UPDATE membership_plan_benefit SET grant_quantity = '9.7折算力积分', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-super-v1-benefit-seedance-pro';
UPDATE membership_plan_benefit SET grant_quantity = 'VIP专属通道', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-super-v1-benefit-vip-queue';

-- ---------------------------------------------------------------------------
-- membership_package_group: group display names and descriptions
-- ---------------------------------------------------------------------------
UPDATE membership_package_group SET name = '连续包年', description = '9.7折', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-group-annual';
UPDATE membership_package_group SET name = '连续包月', description = '9.9折', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-group-monthly';
UPDATE membership_package_group SET name = '连续包季', description = '9.8折', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-group-quarterly';
UPDATE membership_package_group SET name = '单月购买', description = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = 'package-group-single';
-- Community (circle) plan family
UPDATE membership_package_group SET name = '圈子年度会员', description = '圈子会员年度方案', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-group-community-annual';

-- ---------------------------------------------------------------------------
-- membership_package: package display names and descriptions
-- ---------------------------------------------------------------------------
UPDATE membership_package SET name = '圈子基础会员 - 年度', description = '圈子会员年度方案，私密圈子访问', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-community-basic-annual';
UPDATE membership_package SET name = '基础版 - 连续包年', description = '连续包年订阅，到期自动续费', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-basic-annual';
UPDATE membership_package SET name = '标准版 - 连续包年', description = '连续包年订阅，到期自动续费', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-standard-annual';
UPDATE membership_package SET name = '巅峰版 - 连续包年', description = '连续包年订阅，到期自动续费', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-premium-annual';
UPDATE membership_package SET name = '基础版 - 连续包月', description = '连续包月订阅，到期自动续费', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-basic-monthly';
UPDATE membership_package SET name = '标准版 - 连续包月', description = '连续包月订阅，到期自动续费', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-standard-monthly';
UPDATE membership_package SET name = '巅峰版 - 连续包月', description = '连续包月订阅，到期自动续费', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-premium-monthly';
UPDATE membership_package SET name = '基础版 - 连续包季', description = '连续包季订阅，到期自动续费', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-basic-quarterly';
UPDATE membership_package SET name = '标准版 - 连续包季', description = '连续包季订阅，到期自动续费', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-standard-quarterly';
UPDATE membership_package SET name = '巅峰版 - 连续包季', description = '连续包季订阅，到期自动续费', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-premium-quarterly';
UPDATE membership_package SET name = '基础版 - 单月购买', description = '一次性购买，不自动续费', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-basic-single';
UPDATE membership_package SET name = '标准版 - 单月购买', description = '一次性购买，不自动续费', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-standard-single';
UPDATE membership_package SET name = '巅峰版 - 单月购买', description = '一次性购买，不自动续费', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-premium-single';
UPDATE membership_package SET name = '超级版 - 连续包年', description = '连续包年订阅，到期自动续费', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-super-annual';
UPDATE membership_package SET name = '超级版 - 连续包月', description = '连续包月订阅，到期自动续费', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-super-monthly';
UPDATE membership_package SET name = '超级版 - 连续包季', description = '连续包季订阅，到期自动续费', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-super-quarterly';
UPDATE membership_package SET name = '超级版 - 单月购买', description = '一次性购买，不自动续费', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-super-single';

-- ---------------------------------------------------------------------------
-- Team (organization) plan family: per-seat subscriptions
-- ---------------------------------------------------------------------------
UPDATE membership_plan SET name = '团队基础版', description = '面向小型团队的组织空间，算力额度按坐席共享。', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-team-starter';
UPDATE membership_plan SET name = '团队专业版', description = '更高共享额度、团队级智能体与快速通道，适合成长中的团队。', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-team-growth';
UPDATE membership_plan SET name = '团队旗舰版', description = '最高共享额度与专属通道，面向大型组织。', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-team-scale';

UPDATE membership_plan_version SET title = '团队基础版', description = '面向小型团队的组织空间，算力额度按坐席共享。', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-team-starter-v1';
UPDATE membership_plan_version SET title = '团队专业版', description = '更高共享额度、团队级智能体与快速通道，适合成长中的团队。', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-team-growth-v1';
UPDATE membership_plan_version SET title = '团队旗舰版', description = '最高共享额度与专属通道，面向大型组织。', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-team-scale-v1';

UPDATE membership_package_group SET name = '团队年度版', description = '按坐席按年计费，约省 17%。', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-group-team-annual';
UPDATE membership_package_group SET name = '团队月度版', description = '按坐席按月计费，可随时取消。', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-group-team-monthly';

UPDATE membership_package SET name = '团队基础版 - 按月按坐席', description = '按坐席计费，每月结算。', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-team-starter-monthly';
UPDATE membership_package SET name = '团队基础版 - 按年按坐席', description = '按坐席计费，每年结算。', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-team-starter-annual';
UPDATE membership_package SET name = '团队专业版 - 按月按坐席', description = '按坐席计费，每月结算。', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-team-growth-monthly';
UPDATE membership_package SET name = '团队专业版 - 按年按坐席', description = '按坐席计费，每年结算。', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-team-growth-annual';
UPDATE membership_package SET name = '团队旗舰版 - 按月按坐席', description = '按坐席计费，每月结算。', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-team-scale-monthly';
UPDATE membership_package SET name = '团队旗舰版 - 按年按坐席', description = '按坐席计费，每年结算。', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-team-scale-annual';

UPDATE membership_plan_benefit SET grant_quantity = '共享标准通道', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-team-starter-v1-benefit-queue';
UPDATE membership_plan_benefit SET grant_quantity = '共享快速通道', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-team-growth-v1-benefit-queue';
UPDATE membership_plan_benefit SET grant_quantity = '专属 VIP 通道', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-team-scale-v1-benefit-queue';
