import { Building2, Check, RefreshCw } from "lucide-react";

import type {
  SdkworkTeamMembershipKind,
  SdkworkTeamOrganizationChoice,
} from "./team-subscription-port";
import { useSdkworkTeamTranslate } from "./team-surface-context";

export interface SdkworkTeamOrganizationSelectorProps {
  /** Switchable organizations, current one marked. */
  organizations: readonly SdkworkTeamOrganizationChoice[];
  /** Whether a switch request is in flight. */
  isSwitching: boolean;
  /** Selects one organization; the container switches the session and refetches. */
  onSelect: (organizationId: string) => void;
}

const ROLE_COPY: Record<SdkworkTeamMembershipKind, { fallback: string; key: string }> = {
  admin: { fallback: "管理员", key: "token_plan.team.role_admin" },
  member: { fallback: "成员", key: "token_plan.team.role_member" },
  owner: { fallback: "所有者", key: "token_plan.team.role_owner" },
};

/**
 * In-page organization selector for the team subscription surface.
 *
 * Team endpoints resolve the organization from the authenticated principal, so
 * an account that is currently scoped to the platform organization cannot see
 * or buy seats until the session switches to one of its team organizations.
 * The selector lists exactly the organizations the account holds an active
 * membership in, marks the active one, and asks the host port to switch.
 */
export function SdkworkTeamOrganizationSelector({
  organizations,
  isSwitching,
  onSelect,
}: SdkworkTeamOrganizationSelectorProps) {
  const copy = useSdkworkTeamTranslate();
  const hasSwitchTarget = organizations.some((organization) => !organization.isCurrent);

  return (
    <section
      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-white/10 dark:bg-zinc-950"
      data-team-organization-selector
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
            {copy("token_plan.team.organization_selector_title", "团队组织")}
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            {copy(
              "token_plan.team.organization_selector_hint",
              "团队订阅按组织计费，请选择要管理的团队组织。",
            )}
          </p>
        </div>
        {isSwitching ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            <RefreshCw aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
            {copy("token_plan.team.organization_switching", "正在切换组织…")}
          </span>
        ) : null}
      </div>

      <ul className="mt-4 space-y-2" role="list">
        {organizations.map((organization) => {
          const roleCopy = organization.role ? ROLE_COPY[organization.role] : null;
          const isCurrent = organization.isCurrent;
          const disabled = isSwitching || isCurrent;
          return (
            <li key={organization.organizationId}>
              <button
                aria-pressed={isCurrent}
                className={`flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed ${
                  isCurrent
                    ? "border-sky-500 bg-sky-500/[0.06]"
                    : "border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-60 dark:border-white/10 dark:bg-zinc-950 dark:hover:bg-white/5"
                }`}
                data-team-organization-current={isCurrent ? "true" : undefined}
                data-team-organization-option={organization.organizationId}
                disabled={disabled}
                onClick={() => { onSelect(organization.organizationId) }}
                type="button"
              >
                <span
                  className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                    isCurrent
                      ? "bg-sky-500 text-white"
                      : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300"
                  }`}
                >
                  <Building2 aria-hidden="true" className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-950 dark:text-white">
                    {organization.organizationName?.trim() || organization.organizationId}
                  </span>
                  {roleCopy ? (
                    <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                      {copy(roleCopy.key, roleCopy.fallback)}
                    </span>
                  ) : null}
                </span>
                {isCurrent ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-sky-500/10 px-2 py-1 text-[0.7rem] font-semibold text-sky-600 dark:text-sky-400">
                    <Check aria-hidden="true" className="h-3 w-3" />
                    {copy("token_plan.team.organization_current", "当前组织")}
                  </span>
                ) : (
                  <span className="shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">
                    {copy("token_plan.team.organization_switch", "切换")}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {!hasSwitchTarget ? (
        <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
          {copy(
            "token_plan.team.organization_only_membership",
            "当前账号只属于这一个团队组织。",
          )}
        </p>
      ) : null}
    </section>
  );
}
