-- Membership team (organization) subscription catalog seed for tenant 100001.
--
-- Team plans are per-seat: membership_package.price_unit = 'seat' means
-- price_amount is the unit price of one seat for one billing period, and the
-- checkout total is unit price x selected seats. seat_min/seat_max bound the
-- purchasable seat quantity, seat_points_amount is the membership points each
-- assigned seat receives per billing period.
--
-- Locale-specific display text is applied afterwards by
-- seeds/locales/<locale>/001_catalog_locale.sql.
--
-- ON CONFLICT (id) DO UPDATE SET is used (not DO NOTHING) so re-seeding after
-- seed corrections overwrites existing rows.

INSERT INTO membership_plan (
  id, tenant_id, organization_id, category, audience, plan_no, plan_code, name, rank, description, sort_weight, status, created_at, updated_at
) VALUES
  ('plan-team-starter', '100001', '0', 'token', 'team', 'team-starter', 'team_starter', 'Team Starter', 11, 'Organization workspace with pooled compute credits for small teams.', 11, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plan-team-growth', '100001', '0', 'token', 'team', 'team-growth', 'team_growth', 'Team Growth', 12, 'Higher pooled quota, shared agents and priority lanes for growing teams.', 12, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plan-team-scale', '100001', '0', 'token', 'team', 'team-scale', 'team_scale', 'Team Scale', 13, 'Maximum quota and dedicated capacity for large organizations.', 13, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET
  category = EXCLUDED.category,
  audience = EXCLUDED.audience,
  name = EXCLUDED.name,
  rank = EXCLUDED.rank,
  description = EXCLUDED.description,
  sort_weight = EXCLUDED.sort_weight,
  status = EXCLUDED.status,
  updated_at = EXCLUDED.updated_at;

INSERT INTO membership_plan_version (
  id, tenant_id, organization_id, plan_id, version_no, title, description, lifecycle_status, effective_from, published_at, created_at, updated_at
) VALUES
  ('plan-team-starter-v1', '100001', '0', 'plan-team-starter', 'v1', 'Team Starter', 'Organization workspace with pooled compute credits for small teams.', 'published', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plan-team-growth-v1', '100001', '0', 'plan-team-growth', 'v1', 'Team Growth', 'Higher pooled quota, shared agents and priority lanes for growing teams.', 'published', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plan-team-scale-v1', '100001', '0', 'plan-team-scale', 'v1', 'Team Scale', 'Maximum quota and dedicated capacity for large organizations.', 'published', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  lifecycle_status = EXCLUDED.lifecycle_status,
  updated_at = EXCLUDED.updated_at;

INSERT INTO membership_package_group (
  id, tenant_id, organization_id, category, audience, external_id, group_no, name, description, billing_cycle, duration_days, display_channel, sort_weight, status, created_at, updated_at
) VALUES
  ('package-group-team-annual', '100001', '0', 'token', 'team', 601, 'team-annual', 'Team annual', 'Pay yearly, save about 17%.', 'year', 365, 'all', 1, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('package-group-team-monthly', '100001', '0', 'token', 'team', 602, 'team-monthly', 'Team monthly', 'Monthly billing, cancel anytime.', 'month', 30, 'all', 2, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET
  category = EXCLUDED.category,
  audience = EXCLUDED.audience,
  external_id = EXCLUDED.external_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  billing_cycle = EXCLUDED.billing_cycle,
  duration_days = EXCLUDED.duration_days,
  display_channel = EXCLUDED.display_channel,
  sort_weight = EXCLUDED.sort_weight,
  status = EXCLUDED.status,
  updated_at = EXCLUDED.updated_at;

INSERT INTO membership_package (
  id, tenant_id, organization_id, category, audience, external_id, package_no, package_group_id, plan_id, plan_version_id, sku_id,
  name, description, price_amount, original_price_amount, currency_code, price_unit, seat_min, seat_max, seat_points_amount,
  point_amount, duration_days, recurrence_cycle, sort_weight, recommended, status, tags, created_at, updated_at
) VALUES
  ('package-team-starter-monthly', '100001', '0', 'token', 'team', 611, 'team-starter-monthly', 'package-group-team-monthly', 'plan-team-starter', 'plan-team-starter-v1', 'sku-team-starter-monthly',
   'Team Starter - monthly', 'Per seat, billed monthly.', '99', '129', 'CNY', 'seat', 3, 200, 5000,
   0, 30, 'month', 11, 0, 'active', '["team","seat","monthly"]'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('package-team-starter-annual', '100001', '0', 'token', 'team', 612, 'team-starter-annual', 'package-group-team-annual', 'plan-team-starter', 'plan-team-starter-v1', 'sku-team-starter-annual',
   'Team Starter - annual', 'Per seat, billed yearly.', '999', '1548', 'CNY', 'seat', 3, 200, 5000,
   0, 365, 'year', 11, 0, 'active', '["team","seat","annual"]'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('package-team-growth-monthly', '100001', '0', 'token', 'team', 613, 'team-growth-monthly', 'package-group-team-monthly', 'plan-team-growth', 'plan-team-growth-v1', 'sku-team-growth-monthly',
   'Team Growth - monthly', 'Per seat, billed monthly.', '199', '259', 'CNY', 'seat', 3, 500, 12000,
   0, 30, 'month', 12, 1, 'active', '["team","seat","monthly","recommended"]'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('package-team-growth-annual', '100001', '0', 'token', 'team', 614, 'team-growth-annual', 'package-group-team-annual', 'plan-team-growth', 'plan-team-growth-v1', 'sku-team-growth-annual',
   'Team Growth - annual', 'Per seat, billed yearly.', '1999', '3108', 'CNY', 'seat', 3, 500, 12000,
   0, 365, 'year', 12, 1, 'active', '["team","seat","annual","recommended"]'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('package-team-scale-monthly', '100001', '0', 'token', 'team', 615, 'team-scale-monthly', 'package-group-team-monthly', 'plan-team-scale', 'plan-team-scale-v1', 'sku-team-scale-monthly',
   'Team Scale - monthly', 'Per seat, billed monthly.', '399', '499', 'CNY', 'seat', 5, 1000, 30000,
   0, 30, 'month', 13, 0, 'active', '["team","seat","monthly"]'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('package-team-scale-annual', '100001', '0', 'token', 'team', 616, 'team-scale-annual', 'package-group-team-annual', 'plan-team-scale', 'plan-team-scale-v1', 'sku-team-scale-annual',
   'Team Scale - annual', 'Per seat, billed yearly.', '3999', '5988', 'CNY', 'seat', 5, 1000, 30000,
   0, 365, 'year', 13, 0, 'active', '["team","seat","annual"]'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET
  category = EXCLUDED.category,
  audience = EXCLUDED.audience,
  external_id = EXCLUDED.external_id,
  package_no = EXCLUDED.package_no,
  package_group_id = EXCLUDED.package_group_id,
  plan_id = EXCLUDED.plan_id,
  plan_version_id = EXCLUDED.plan_version_id,
  sku_id = EXCLUDED.sku_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_amount = EXCLUDED.price_amount,
  original_price_amount = EXCLUDED.original_price_amount,
  currency_code = EXCLUDED.currency_code,
  price_unit = EXCLUDED.price_unit,
  seat_min = EXCLUDED.seat_min,
  seat_max = EXCLUDED.seat_max,
  seat_points_amount = EXCLUDED.seat_points_amount,
  duration_days = EXCLUDED.duration_days,
  recurrence_cycle = EXCLUDED.recurrence_cycle,
  sort_weight = EXCLUDED.sort_weight,
  recommended = EXCLUDED.recommended,
  status = EXCLUDED.status,
  tags = EXCLUDED.tags,
  updated_at = EXCLUDED.updated_at;

-- Team plan benefits reuse the shared benefit definitions so admin and client
-- comparison surfaces can render organization plans without new definitions.
INSERT INTO membership_plan_benefit (
  id, tenant_id, organization_id, plan_id, plan_version_id, benefit_id, benefit_code, grant_quantity, grant_period, usage_policy, sort_weight, status, created_at, updated_at
) VALUES
  ('plan-team-starter-v1-benefit-queue', '100001', '0', 'plan-team-starter', 'plan-team-starter-v1', 'benefit-standard-queue', 'standard_queue', 'Shared standard lane', 'membership_period', 'included', 1, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plan-team-starter-v1-benefit-watermark', '100001', '0', 'plan-team-starter', 'plan-team-starter-v1', 'benefit-no-watermark', 'no_watermark', '1', 'membership_period', 'included', 2, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plan-team-growth-v1-benefit-queue', '100001', '0', 'plan-team-growth', 'plan-team-growth-v1', 'benefit-fast-queue', 'fast_queue', 'Shared fast lane', 'membership_period', 'included', 1, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plan-team-growth-v1-benefit-video-hd', '100001', '0', 'plan-team-growth', 'plan-team-growth-v1', 'benefit-video-hd', 'video_hd', '1', 'membership_period', 'included', 2, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plan-team-growth-v1-benefit-watermark', '100001', '0', 'plan-team-growth', 'plan-team-growth-v1', 'benefit-no-watermark', 'no_watermark', '1', 'membership_period', 'included', 3, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plan-team-scale-v1-benefit-queue', '100001', '0', 'plan-team-scale', 'plan-team-scale-v1', 'benefit-vip-queue', 'vip_queue', 'Dedicated VIP lane', 'membership_period', 'included', 1, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plan-team-scale-v1-benefit-video-hd', '100001', '0', 'plan-team-scale', 'plan-team-scale-v1', 'benefit-video-hd', 'video_hd', '1', 'membership_period', 'included', 2, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plan-team-scale-v1-benefit-support', '100001', '0', 'plan-team-scale', 'plan-team-scale-v1', 'benefit-vip-support', 'vip_support', '1', 'membership_period', 'included', 3, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO UPDATE SET
  grant_quantity = EXCLUDED.grant_quantity,
  grant_period = EXCLUDED.grant_period,
  usage_policy = EXCLUDED.usage_policy,
  sort_weight = EXCLUDED.sort_weight,
  status = EXCLUDED.status,
  updated_at = EXCLUDED.updated_at;
