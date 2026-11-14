/**
 * Maps a typed team surface failure reason onto localized copy.
 *
 * Every reason the membership app API sends has a dedicated message under
 * `token_plan.team.*`; unknown failures fall back to the generic load error so
 * the surface never renders a raw wire code. Defaults are Chinese because the
 * desktop host renders the shared catalog with Chinese defaults; a host that
 * translates the keys (Cloud Router publishes en + zh bundles) overrides them.
 */

import type { SdkworkTeamErrorReason } from "./team-subscription-port";

/** One localized message: i18n key plus its default copy. */
export interface SdkworkTeamErrorCopy {
  fallback: string;
  key: string;
}

/**
 * Resolves the copy for one failure reason.
 *
 * @param reason - the normalized failure reason.
 * @returns the i18n key and default copy for that reason.
 */
export function resolveTeamPlanErrorCopy(
  reason: SdkworkTeamErrorReason,
): SdkworkTeamErrorCopy {
  switch (reason) {
    case "seat_already_assigned":
      return {
        fallback: "该成员已持有坐席。",
        key: "token_plan.team.error_already_assigned",
      };
    case "not_organization_member":
      return {
        fallback: "该用户不是组织的有效成员。",
        key: "token_plan.team.error_not_member",
      };
    case "seat_management_forbidden":
      return {
        fallback: "仅组织所有者或管理员可以管理坐席。",
        key: "token_plan.team.error_forbidden",
      };
    case "team_subscription_inactive":
      return {
        fallback: "团队订阅当前未生效。",
        key: "token_plan.team.error_subscription_inactive",
      };
    case "last_seat_owner_required":
      return {
        fallback: "组织所有者需保留最后一个生效坐席，请先为其他成员分配坐席后再回收。",
        key: "token_plan.team.last_owner_required",
      };
    case "seat_assignment_not_found":
      return {
        fallback: "该成员未持有坐席。",
        key: "token_plan.team.error_assignment_not_found",
      };
    case "seat_capacity_exceeded":
      return {
        fallback: "{{seats}} 个坐席已全部分配，请先购买更多坐席再分配。",
        key: "token_plan.team.seat_capacity_exceeded",
      };
    case "unauthenticated":
      return {
        fallback: "团队订阅加载失败。",
        key: "token_plan.team.load_failed",
      };
    case "organization_scope_required":
      return {
        fallback: "未选择团队组织。",
        key: "token_plan.team.no_org",
      };
    case "team_subscription_unbound":
      return {
        fallback: "团队订阅尚未绑定组织，请先完成组织绑定再管理坐席。",
        key: "token_plan.team.error_subscription_unbound",
      };
    case "team_subscription_already_unbound":
      return {
        fallback: "当前账号已有一笔未绑定组织的团队订阅，请先绑定组织后再购买。",
        key: "token_plan.team.error_subscription_already_unbound",
      };
    case "team_subscription_not_found":
      return {
        fallback: "未找到可绑定的团队订阅，请先完成团队订阅购买。",
        key: "token_plan.team.error_subscription_not_found",
      };
    case "team_organization_already_subscribed":
      return {
        fallback: "该组织已拥有生效中的团队订阅，无法重复绑定。",
        key: "token_plan.team.error_organization_already_subscribed",
      };
    case "organization_sign_in_required":
      return {
        fallback: "该平台需要在登录时选择组织，请重新登录并选择团队组织。",
        key: "token_plan.team.organization_sign_in_required",
      };
    default:
      return {
        fallback: "团队订阅加载失败，请稍后重试。",
        key: "token_plan.team.load_failed",
      };
  }
}
