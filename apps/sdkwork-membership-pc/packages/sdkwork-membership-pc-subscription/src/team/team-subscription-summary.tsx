import {
  CalendarClock,
  ShieldCheck,
  TicketCheck,
  TriangleAlert,
  UserCheck,
  UserPlus,
  Users,
  UsersRound,
} from "lucide-react";
import { Button } from "@sdkwork/ui-pc-react";

import type { SdkworkTeamSeatComposition } from "./team-roster-composition";
import type { SdkworkTeamSubscriptionOverview } from "./team-subscription-port";
import {
  formatSdkworkTeamCopy,
  useSdkworkTeamTranslate,
} from "./team-surface-context";

const STATUS_COPY: Record<string, { fallback: string; key: string }> = {
  active: { fallback: "生效中", key: "token_plan.team.status_active" },
  cancelled: { fallback: "已取消", key: "token_plan.team.status_cancelled" },
  expired: { fallback: "已过期", key: "token_plan.team.status_expired" },
  grace_period: { fallback: "宽限期", key: "token_plan.team.status_grace" },
  pending_activation: { fallback: "开通中", key: "token_plan.team.status_pending" },
};

export interface SdkworkTeamSubscriptionSummaryProps {
  /**
   * IAM-derived team facts: member counts, the viewer role, and the seat
   * overflow derivation. Membership only supplies the overview.
   */
  composition: SdkworkTeamSeatComposition;
  /** BCP 47 tag used for the billing-period dates; the runtime default if absent. */
  locale?: string;
  /**
   * Opens the plan cards so the owner can buy more seats. Omit it for members
   * without seat-management rights; the CTA is then hidden.
   */
  onBuyMoreSeats?: () => void;
  overview: SdkworkTeamSubscriptionOverview;
}

function formatTeamDate(value: string | undefined, locale: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

/**
 * Active team subscription summary: status, plan, billing period, seat usage,
 * and the unlicensed-member warning.
 */
export function SdkworkTeamSubscriptionSummary({
  composition,
  locale,
  onBuyMoreSeats,
  overview,
}: SdkworkTeamSubscriptionSummaryProps) {
  const copy = useSdkworkTeamTranslate();
  const statusCopy = STATUS_COPY[overview.status ?? ""] ?? {
    fallback: "未订阅",
    key: "token_plan.team.status_none",
  };
  const startsAt = formatTeamDate(overview.startsAt, locale);
  const expiresAt = formatTeamDate(overview.expiresAt, locale);
  const seatPercent = overview.seatsPurchased > 0
    ? Math.min(100, Math.round((overview.seatsUsed / overview.seatsPurchased) * 100))
    : 0;
  const hasUnlicensedMembers = composition.overSeat || composition.unlicensedMembers > 0;

  const tiles: ReadonlyArray<{ icon: typeof Users; label: string; value: number }> = [
    {
      icon: Users,
      label: copy("token_plan.team.seats_purchased", "已购坐席"),
      value: overview.seatsPurchased,
    },
    { icon: UserCheck, label: copy("token_plan.team.seats_used", "已分配"), value: overview.seatsUsed },
    {
      icon: TicketCheck,
      label: copy("token_plan.team.seats_available", "可用坐席"),
      value: overview.seatsAvailable,
    },
    {
      icon: UsersRound,
      label: copy("token_plan.team.members_total", "组织成员"),
      value: composition.membersTotal,
    },
    {
      icon: UserPlus,
      label: copy("token_plan.team.unlicensed_members", "待分配坐席"),
      value: composition.unlicensedMembers,
    },
  ];

  return (
    <section
      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-white/10 dark:bg-zinc-950"
      data-team-subscription-summary
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            {copy("token_plan.team.current_plan", "当前套餐")}
          </p>
          <h2 className="mt-1 truncate text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
            {overview.planName ?? copy("token_plan.team.title", "团队订阅")}
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
            <CalendarClock aria-hidden="true" className="h-4 w-4 shrink-0" />
            {startsAt && expiresAt
              ? `${startsAt} – ${expiresAt}`
              : expiresAt
                ? formatSdkworkTeamCopy(copy("token_plan.team.renews_on", "到期时间 {{date}}"), {
                  date: expiresAt,
                })
                : copy("token_plan.team.period", "计费周期")}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-200">
            <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
            {copy(statusCopy.key, statusCopy.fallback)}
          </span>
          {onBuyMoreSeats ? (
            <Button onClick={onBuyMoreSeats} type="button" variant="secondary">
              {copy("token_plan.team.buy_more_seats", "购买更多坐席")}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {copy("token_plan.team.seats_used", "已分配")}
          </span>
          <span className="tabular-nums text-slate-500 dark:text-slate-400">
            {overview.seatsUsed} / {overview.seatsPurchased}
          </span>
        </div>
        <div
          aria-label={copy("token_plan.team.seats_used", "已分配")}
          aria-valuemax={Math.max(overview.seatsPurchased, overview.seatsUsed)}
          aria-valuemin={0}
          aria-valuenow={overview.seatsUsed}
          className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"
          role="progressbar"
        >
          <div
            className={`h-full rounded-full transition-[width] ${
              composition.overSeat ? "bg-amber-500" : "bg-sky-500"
            }`}
            style={{ width: `${seatPercent}%` }}
          />
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <div
              className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 dark:border-white/10 dark:bg-white/5"
              key={tile.label}
            >
              <dt className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{tile.label}</span>
              </dt>
              <dd className="mt-1.5 text-xl font-semibold tabular-nums text-slate-950 dark:text-white">
                {tile.value}
              </dd>
            </div>
          );
        })}
      </dl>

      {hasUnlicensedMembers ? (
        <div
          className="mt-5 flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
          data-team-over-seat
        >
          <TriangleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {formatSdkworkTeamCopy(
                copy(
                  "token_plan.team.over_seat_warning",
                  "有 {{count}} 位组织成员尚未分配坐席。他们保留组织访问权限，但不享受订阅权益。",
                ),
                { count: String(composition.unlicensedMembers) },
              )}
            </p>
            <p className="mt-1 text-xs opacity-80">
              {copy(
                "token_plan.team.over_seat_hint",
                "可分配空闲坐席、回收成员坐席，或购买更多坐席。",
              )}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
