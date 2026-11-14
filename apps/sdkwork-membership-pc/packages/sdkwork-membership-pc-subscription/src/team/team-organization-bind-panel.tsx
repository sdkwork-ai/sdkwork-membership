import { Building2, Link2, ShieldCheck } from "lucide-react";
import { Button, EmptyState, StatusNotice } from "@sdkwork/ui-pc-react";

import { resolveTeamPlanErrorCopy } from "./team-plan-error-copy";
import { canManageTeamSeats, teamOrganizationRoleLabelKey } from "./team-roster-composition";
import type {
  SdkworkTeamErrorReason,
  SdkworkTeamOrganizationChoice,
} from "./team-subscription-port";
import { formatSdkworkTeamCopy, useSdkworkTeamTranslate } from "./team-surface-context";

/** One organization the buyer may bind the unbound team subscription to. */
export interface SdkworkTeamOrganizationBindPanelProps {
  /**
   * The caller's own organizations, already reduced by
   * {@link import("./team-subscription-port").resolveTeamOrganizationChoices}.
   */
  organizations: readonly SdkworkTeamOrganizationChoice[];
  /** Disables every action while a bind request is in flight. */
  isBinding: boolean;
  /** Binds the unbound subscription to the selected organization. */
  onBind: (organizationId: string) => void;
  /** Normalized bind failure, when the last attempt failed. */
  errorReason?: SdkworkTeamErrorReason;
  /** Clears the rendered bind failure. */
  onDismissError?: () => void;
  /** Seats the buyer already paid for, shown as reassurance while binding. */
  seatsPurchased: number;
}

/**
 * "Bind an organization" step for a team subscription bought without one.
 *
 * Business rule: a user may buy team seats first and bind an organization
 * afterwards. This panel is that second half — it lists the caller's own
 * organizations, marks the ones the caller may manage (`owner`/`admin`; the
 * membership API re-authorizes with the IAM `TEAM_SEAT_MANAGE` capability),
 * and binds the paid subscription to the chosen organization. After a
 * successful bind the container refreshes to the bound summary and the seat
 * directory.
 *
 * @param props - candidate organizations, pending state, and bind handler.
 * @returns the bind panel.
 */
export function SdkworkTeamOrganizationBindPanel({
  errorReason,
  isBinding,
  onBind,
  onDismissError,
  organizations,
  seatsPurchased,
}: SdkworkTeamOrganizationBindPanelProps) {
  const copy = useSdkworkTeamTranslate();
  const errorCopy = errorReason ? resolveTeamPlanErrorCopy(errorReason) : null;

  return (
    <section
      className="rounded-3xl border border-amber-300/60 bg-amber-50 p-5 dark:border-amber-400/30 dark:bg-amber-500/10"
      data-team-organization-bind
    >
      <div className="flex items-start gap-3">
        <Link2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-950 dark:text-white">
            {copy("token_plan.team.bind_title", "绑定组织")}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            {formatSdkworkTeamCopy(
              copy(
                "token_plan.team.bind_subtitle",
                "团队订阅已购买成功，共 {{seats}} 个坐席。选择一个组织完成绑定，之后即可分配坐席。",
              ),
              { seats: String(Math.max(1, seatsPurchased)) },
            )}
          </p>
        </div>
      </div>

      {errorCopy ? (
        <div className="mt-4" data-team-organization-bind-error={errorReason}>
          <StatusNotice title={copy("token_plan.team.bind_failed", "组织绑定失败。")} tone="danger">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm">{copy(errorCopy.key, errorCopy.fallback)}</span>
              {onDismissError ? (
                <Button onClick={onDismissError} size="sm" type="button" variant="ghost">
                  {copy("close", "关闭")}
                </Button>
              ) : null}
            </div>
          </StatusNotice>
        </div>
      ) : null}

      {organizations.length === 0 ? (
        <div className="mt-4" data-team-organization-bind-empty>
          <EmptyState
            description={copy(
              "token_plan.team.bind_no_organization",
              "当前账号不属于任何团队组织。请先创建一个组织，或加入一个拥有者/管理员身份的组织后再回来绑定。",
            )}
          />
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {organizations.map((organization) => {
            const eligible = canManageTeamSeats(organization.role);
            const roleKey = teamOrganizationRoleLabelKey(organization.role);
            return (
              <li
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/50 bg-white/70 px-4 py-3 dark:border-amber-400/20 dark:bg-zinc-900/60"
                data-team-organization-bind-eligible={eligible ? "true" : "false"}
                data-team-organization-bind-option={organization.organizationId}
                key={organization.organizationId}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Building2 aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="min-w-0 truncate text-sm font-semibold text-slate-900 dark:text-white">
                    {organization.organizationName?.trim() || organization.organizationId}
                  </span>
                  {organization.role ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">
                      <ShieldCheck aria-hidden="true" className="h-3 w-3" />
                      {roleKey
                        ? copy(roleKey.key, roleKey.fallback)
                        : organization.role}
                    </span>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {eligible ? null : (
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {copy(
                        "token_plan.team.bind_ineligible",
                        "仅组织所有者或管理员可以绑定团队订阅。",
                      )}
                    </span>
                  )}
                  <Button
                    disabled={!eligible || isBinding}
                    loading={isBinding}
                    onClick={() => { onBind(organization.organizationId) }}
                    size="sm"
                    type="button"
                    variant={eligible ? "primary" : "ghost"}
                  >
                    {copy("token_plan.team.bind_action", "绑定到此组织")}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
