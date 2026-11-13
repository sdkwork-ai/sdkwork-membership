-- ============================================================================
-- en-US locale seed: sets display text for membership catalog tables.
--
-- This file runs AFTER common/001_catalog.sql and explicitly sets English
-- display text. It uses UPDATE statements keyed by primary key so re-seeding
-- is idempotent.
--
-- Pricing model: ¥10 = 100 compute credits (1 CNY = 10 credits)
-- point_amount = price × 10
-- ============================================================================

-- ---------------------------------------------------------------------------
-- membership_plan: plan display names and descriptions
-- ---------------------------------------------------------------------------
UPDATE membership_plan SET name = 'Free', description = 'Experience core features with daily bonus compute credits.', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-free';
UPDATE membership_plan SET name = 'Basic', description = 'For individual creators, unlock basic AI capabilities.', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-basic';
UPDATE membership_plan SET name = 'Standard', description = 'For professional creators, unlock all AI models.', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-standard';
UPDATE membership_plan SET name = 'Premium', description = 'For teams and power users, enjoy dedicated channels.', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-premium';
UPDATE membership_plan SET name = 'Super', description = 'Ultimate tier with VIP queue, maximum quotas, and exclusive effects.', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-super';
-- Community (circle) plan family
UPDATE membership_plan SET name = 'Community Basic', description = 'Circle membership: join private circles, unlock exclusive content and member-only events.', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-community-basic';

-- ---------------------------------------------------------------------------
-- membership_plan_version: version display titles
-- ---------------------------------------------------------------------------
UPDATE membership_plan_version SET title = 'Free', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-free-v1';
UPDATE membership_plan_version SET title = 'Basic', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-basic-v1';
UPDATE membership_plan_version SET title = 'Standard', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-standard-v1';
UPDATE membership_plan_version SET title = 'Premium', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-premium-v1';
UPDATE membership_plan_version SET title = 'Super', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-super-v1';
-- Community (circle) plan family
UPDATE membership_plan_version SET title = 'Community Basic', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-community-basic-v1';

-- ---------------------------------------------------------------------------
-- membership_benefit_definition: benefit display names and descriptions
-- ---------------------------------------------------------------------------
UPDATE membership_benefit_definition SET name = 'Platform free credits', description = 'Daily login free compute credits.', updated_at = CURRENT_TIMESTAMP WHERE id = 'benefit-platform-free-points';
UPDATE membership_benefit_definition SET name = 'Purchased credits', description = 'Compute credits purchased via recharge.', updated_at = CURRENT_TIMESTAMP WHERE id = 'benefit-purchased-points';
UPDATE membership_benefit_definition SET name = 'Subscription monthly credits', description = 'Monthly subscription bonus compute credits.', updated_at = CURRENT_TIMESTAMP WHERE id = 'benefit-daily-points';
UPDATE membership_benefit_definition SET name = 'Seedance 2.0 VIP model', description = 'Access to Seedance 2.0 VIP model.', updated_at = CURRENT_TIMESTAMP WHERE id = 'benefit-seedance-vip-model';
UPDATE membership_benefit_definition SET name = 'Seedance 1.5 Pro model', description = 'Seedance 1.5 Pro model 3% off credits.', updated_at = CURRENT_TIMESTAMP WHERE id = 'benefit-seedance-pro-model';
UPDATE membership_benefit_definition SET name = 'Standard generation lane', description = 'Standard priority generation queue.', updated_at = CURRENT_TIMESTAMP WHERE id = 'benefit-standard-queue';
UPDATE membership_benefit_definition SET name = 'Fast generation lane', description = 'High priority fast generation queue.', updated_at = CURRENT_TIMESTAMP WHERE id = 'benefit-fast-queue';
UPDATE membership_benefit_definition SET name = 'VIP priority lane', description = 'Dedicated VIP queue.', updated_at = CURRENT_TIMESTAMP WHERE id = 'benefit-vip-queue';
UPDATE membership_benefit_definition SET name = 'Video lip sync', description = 'Video lip-sync feature access.', updated_at = CURRENT_TIMESTAMP WHERE id = 'benefit-video-lip-sync';
UPDATE membership_benefit_definition SET name = 'Video HD', description = 'Video HD export feature.', updated_at = CURRENT_TIMESTAMP WHERE id = 'benefit-video-hd';
UPDATE membership_benefit_definition SET name = 'Video frame interpolation', description = 'Video frame interpolation feature.', updated_at = CURRENT_TIMESTAMP WHERE id = 'benefit-video-frame-interp';
UPDATE membership_benefit_definition SET name = 'Image 4.0 limited free', description = 'Image 4.0 free tier resolution.', updated_at = CURRENT_TIMESTAMP WHERE id = 'benefit-image-4k-free';
UPDATE membership_benefit_definition SET name = 'Smart upscale', description = 'Smart upscaling resolution.', updated_at = CURRENT_TIMESTAMP WHERE id = 'benefit-smart-upscale';
UPDATE membership_benefit_definition SET name = 'Watermark-free export', description = 'Export without watermark.', updated_at = CURRENT_TIMESTAMP WHERE id = 'benefit-no-watermark';
UPDATE membership_benefit_definition SET name = 'Generation acceleration', description = 'Accelerated generation speed.', updated_at = CURRENT_TIMESTAMP WHERE id = 'benefit-generation-acceleration';
UPDATE membership_benefit_definition SET name = 'Worry-free refund', description = 'Worry-free refund and priority support.', updated_at = CURRENT_TIMESTAMP WHERE id = 'benefit-vip-support';

-- Privilege benefits (runtime quota)
UPDATE membership_benefit_definition SET name = 'Priority speed-up', description = 'Manual acceleration quota for generation jobs.', updated_at = CURRENT_TIMESTAMP WHERE id = 'seed-benefit-priority-speed-up';
UPDATE membership_benefit_definition SET name = 'Priority queue', description = 'Priority queue capacity for active members.', updated_at = CURRENT_TIMESTAMP WHERE id = 'benefit-definition-priority_queue';
UPDATE membership_benefit_definition SET name = 'AI quota', description = 'Exclusive model and AI quota allowance.', updated_at = CURRENT_TIMESTAMP WHERE id = 'seed-benefit-ai-quota';

-- Community (circle) benefits
UPDATE membership_benefit_definition SET name = 'Private circle access', description = 'Join private circles with member-only entry.', updated_at = CURRENT_TIMESTAMP WHERE id = 'benefit-community-circle-access';
UPDATE membership_benefit_definition SET name = 'Exclusive circle content', description = 'Unlock circle-exclusive posts, resources, and live replays.', updated_at = CURRENT_TIMESTAMP WHERE id = 'benefit-community-exclusive-content';
UPDATE membership_benefit_definition SET name = 'Member-only events', description = 'Priority access to member-only events and meetups.', updated_at = CURRENT_TIMESTAMP WHERE id = 'benefit-community-member-events';

-- ---------------------------------------------------------------------------
-- membership_plan_benefit: grant_quantity display text (text-type cells only)
-- Numeric cells (e.g. '330', '1', '20') remain unchanged.
-- ---------------------------------------------------------------------------
-- Free plan
UPDATE membership_plan_benefit SET grant_quantity = 'Daily login free credits', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-free-v1-benefit-platform-points';

-- Basic plan
UPDATE membership_plan_benefit SET grant_quantity = 'Daily login bonus credits', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-basic-v1-benefit-platform-points';
UPDATE membership_plan_benefit SET grant_quantity = '3% off credits', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-basic-v1-benefit-seedance-pro';
UPDATE membership_plan_benefit SET grant_quantity = 'Standard generation lane', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-basic-v1-benefit-standard-queue';

-- Standard plan
UPDATE membership_plan_benefit SET grant_quantity = 'Daily login bonus credits', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-standard-v1-benefit-platform-points';
UPDATE membership_plan_benefit SET grant_quantity = '3% off credits', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-standard-v1-benefit-seedance-pro';
UPDATE membership_plan_benefit SET grant_quantity = 'Standard generation lane', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-standard-v1-benefit-standard-queue';

-- Premium plan
UPDATE membership_plan_benefit SET grant_quantity = 'Daily login bonus credits', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-premium-v1-benefit-platform-points';
UPDATE membership_plan_benefit SET grant_quantity = '3% off credits', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-premium-v1-benefit-seedance-pro';
UPDATE membership_plan_benefit SET grant_quantity = 'Fast generation lane', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-premium-v1-benefit-fast-queue';

-- Super plan
UPDATE membership_plan_benefit SET grant_quantity = 'Daily login bonus credits', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-super-v1-benefit-platform-points';
UPDATE membership_plan_benefit SET grant_quantity = '3% off credits', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-super-v1-benefit-seedance-pro';
UPDATE membership_plan_benefit SET grant_quantity = 'VIP priority lane', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-super-v1-benefit-vip-queue';

-- ---------------------------------------------------------------------------
-- membership_package_group: group display names and descriptions
-- ---------------------------------------------------------------------------
UPDATE membership_package_group SET name = 'Annual subscription', description = '3% off', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-group-annual';
UPDATE membership_package_group SET name = 'Monthly subscription', description = '1% off', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-group-monthly';
UPDATE membership_package_group SET name = 'Quarterly subscription', description = '2% off', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-group-quarterly';
UPDATE membership_package_group SET name = 'Single month purchase', description = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = 'package-group-single';
-- Community (circle) plan family
UPDATE membership_package_group SET name = 'Circle annual membership', description = 'Circle member annual plan', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-group-community-annual';

-- ---------------------------------------------------------------------------
-- membership_package: package display names and descriptions
-- ---------------------------------------------------------------------------
UPDATE membership_package SET name = 'Community Basic - Annual', description = 'Circle membership annual plan, private community access', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-community-basic-annual';
UPDATE membership_package SET name = 'Basic - Annual', description = 'Annual subscription, auto-renew on expiry', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-basic-annual';
UPDATE membership_package SET name = 'Standard - Annual', description = 'Annual subscription, auto-renew on expiry', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-standard-annual';
UPDATE membership_package SET name = 'Premium - Annual', description = 'Annual subscription, auto-renew on expiry', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-premium-annual';
UPDATE membership_package SET name = 'Basic - Monthly', description = 'Monthly subscription, auto-renew on expiry', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-basic-monthly';
UPDATE membership_package SET name = 'Standard - Monthly', description = 'Monthly subscription, auto-renew on expiry', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-standard-monthly';
UPDATE membership_package SET name = 'Premium - Monthly', description = 'Monthly subscription, auto-renew on expiry', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-premium-monthly';
UPDATE membership_package SET name = 'Basic - Quarterly', description = 'Quarterly subscription, auto-renew on expiry', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-basic-quarterly';
UPDATE membership_package SET name = 'Standard - Quarterly', description = 'Quarterly subscription, auto-renew on expiry', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-standard-quarterly';
UPDATE membership_package SET name = 'Premium - Quarterly', description = 'Quarterly subscription, auto-renew on expiry', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-premium-quarterly';
UPDATE membership_package SET name = 'Basic - Single Month', description = 'One-time purchase, no auto-renew', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-basic-single';
UPDATE membership_package SET name = 'Standard - Single Month', description = 'One-time purchase, no auto-renew', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-standard-single';
UPDATE membership_package SET name = 'Premium - Single Month', description = 'One-time purchase, no auto-renew', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-premium-single';
UPDATE membership_package SET name = 'Super - Annual', description = 'Annual subscription, auto-renew on expiry', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-super-annual';
UPDATE membership_package SET name = 'Super - Monthly', description = 'Monthly subscription, auto-renew on expiry', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-super-monthly';
UPDATE membership_package SET name = 'Super - Quarterly', description = 'Quarterly subscription, auto-renew on expiry', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-super-quarterly';
UPDATE membership_package SET name = 'Super - Single Month', description = 'One-time purchase, no auto-renew', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-super-single';

-- ---------------------------------------------------------------------------
-- Team (organization) plan family: per-seat subscriptions
-- ---------------------------------------------------------------------------
UPDATE membership_plan SET name = 'Team Starter', description = 'Organization workspace for small teams with pooled compute credits.', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-team-starter';
UPDATE membership_plan SET name = 'Team Growth', description = 'Higher pooled quota, shared agents, and priority lanes for growing teams.', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-team-growth';
UPDATE membership_plan SET name = 'Team Scale', description = 'Maximum pooled quota and dedicated capacity for large organizations.', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-team-scale';

UPDATE membership_plan_version SET title = 'Team Starter', description = 'Organization workspace for small teams with pooled compute credits.', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-team-starter-v1';
UPDATE membership_plan_version SET title = 'Team Growth', description = 'Higher pooled quota, shared agents, and priority lanes for growing teams.', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-team-growth-v1';
UPDATE membership_plan_version SET title = 'Team Scale', description = 'Maximum pooled quota and dedicated capacity for large organizations.', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-team-scale-v1';

UPDATE membership_package_group SET name = 'Team Annual', description = 'Billed yearly per seat, save about 17%.', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-group-team-annual';
UPDATE membership_package_group SET name = 'Team Monthly', description = 'Billed monthly per seat, cancel anytime.', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-group-team-monthly';

UPDATE membership_package SET name = 'Team Starter - Monthly per seat', description = 'Per seat, billed monthly.', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-team-starter-monthly';
UPDATE membership_package SET name = 'Team Starter - Annual per seat', description = 'Per seat, billed yearly.', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-team-starter-annual';
UPDATE membership_package SET name = 'Team Growth - Monthly per seat', description = 'Per seat, billed monthly.', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-team-growth-monthly';
UPDATE membership_package SET name = 'Team Growth - Annual per seat', description = 'Per seat, billed yearly.', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-team-growth-annual';
UPDATE membership_package SET name = 'Team Scale - Monthly per seat', description = 'Per seat, billed monthly.', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-team-scale-monthly';
UPDATE membership_package SET name = 'Team Scale - Annual per seat', description = 'Per seat, billed yearly.', updated_at = CURRENT_TIMESTAMP WHERE id = 'package-team-scale-annual';

UPDATE membership_plan_benefit SET grant_quantity = 'Shared standard lane', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-team-starter-v1-benefit-queue';
UPDATE membership_plan_benefit SET grant_quantity = 'Shared fast lane', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-team-growth-v1-benefit-queue';
UPDATE membership_plan_benefit SET grant_quantity = 'Dedicated VIP lane', updated_at = CURRENT_TIMESTAMP WHERE id = 'plan-team-scale-v1-benefit-queue';
