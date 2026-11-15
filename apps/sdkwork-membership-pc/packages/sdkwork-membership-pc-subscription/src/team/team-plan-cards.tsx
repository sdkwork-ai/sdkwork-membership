import { useEffect, useState } from "react";
import { Check, Minus, Plus, Sparkles, Ticket, UsersRound } from "lucide-react";
import { Button, EmptyState, LoadingBlock, StatusNotice } from "@sdkwork/ui-pc-react";

import { resolveTeamPlanErrorCopy } from "./team-plan-error-copy";
import {
  buildTeamCycleOptions,
  clampTeamSeatCount,
  computeTeamSeatTotal,
  formatTeamCnyAmount,
  groupTeamPlanPackages,
  parseTeamSeatInput,
  resolveAdditionalSeatBounds,
  resolveDefaultAdditionalSeatCount,
  resolveDefaultTeamSeatCount,
  resolveTeamSeatBounds,
  selectTeamPlanPackage,
  type SdkworkTeamBillingCycle,
  type SdkworkTeamCycleOption,
  type SdkworkTeamSeatBounds,
} from "./team-plan-pricing";
import {
  normalizeSdkworkTeamError,
  type SdkworkTeamPackage,
  type SdkworkTeamPackageGroup,
  type SdkworkTeamSubscriptionError,
} from "./team-subscription-port";
import {
  formatSdkworkTeamCopy,
  useSdkworkTeamSurfaceRuntime,
  useSdkworkTeamTranslate,
} from "./team-surface-context";

/** One seat purchase the plan cards ask the container to start. */
export interface SdkworkTeamBuyRequest {
  /** `subscribe` starts the first team subscription; `expand` buys more seats. */
  mode: "expand" | "subscribe";
  packageId: string;
  packageName: string;
  seats: number;
  /** `unitPrice × seats`, in CNY. */
  total: number;
  /** Billing period copy appended to the checkout summary. */
  periodLabel: string;
  /** Struck-through original amount for the checkout summary, when discounted. */
  originalPriceLabel?: string;
}

export interface SdkworkTeamPlanCardsProps {
  /**
   * Current purchased seats. Only the `subscribe` stepper uses it as a floor;
   * `expand` counts seats to ADD, so it never pre-fills the current total.
   */
  initialSeats: number;
  /**
   * `subscribe` starts the first team subscription (`purchase` with the total
   * seat count). `expand` buys additional seats for the active subscription
   * (`add_seats` with the ADDITIONAL seat count).
   */
  mode: "expand" | "subscribe";
  /** Starts the order-owned checkout; rejects with a normalized failure. */
  onBuy: (request: SdkworkTeamBuyRequest) => Promise<void>;
  /** Collapses the expand section without buying. */
  onCancel?: () => void;
}

/** Fallback tab label per billing cycle when the catalog serves no groups. */
const CYCLE_COPY: Record<SdkworkTeamBillingCycle, { fallback: string; key: string }> = {
  month: { fallback: "连续包月", key: "token_plan.team.billing_monthly" },
  once: { fallback: "单月购买", key: "token_plan.team.billing_single" },
  quarter: { fallback: "连续包季", key: "token_plan.team.billing_quarterly" },
  year: { fallback: "连续包年", key: "token_plan.team.billing_annual" },
};

/** Period suffix rendered after the per-seat unit price. */
const CYCLE_PERIOD_COPY: Record<SdkworkTeamBillingCycle, { fallback: string; key: string }> = {
  month: { fallback: "/ 月", key: "token_plan.team.per_period_month" },
  once: { fallback: "/ 单月", key: "token_plan.team.per_period_once" },
  quarter: { fallback: "/ 季", key: "token_plan.team.per_period_quarter" },
  year: { fallback: "/ 年", key: "token_plan.team.per_period_year" },
};

/** Explains the billing behavior of the active cycle under the tabs. */
const CYCLE_HINT_COPY: Partial<Record<SdkworkTeamBillingCycle, { fallback: string; key: string }>> = {
  once: {
    fallback: "单月购买一次性付费，不自动续费。",
    key: "token_plan.team.billing_single_hint",
  },
  quarter: {
    fallback: "按季付费，每 90 天自动续费。",
    key: "token_plan.team.billing_quarterly_hint",
  },
  year: { fallback: "按年付费立省约 17%。", key: "token_plan.team.billing_annual_hint" },
};

/**
 * Team plan cards: one column per catalog plan, priced per seat.
 *
 * The membership catalog publishes four billing options per plan as package
 * groups (continuous annual / monthly / quarterly and a single-month purchase);
 * each group becomes one cycle tab, in the order the catalog returned them, and
 * the active tab's package group selects the package each plan card prices. A
 * host that cannot read groups still gets four tabs derived from the package
 * `recurrenceCycle`.
 *
 * The card owns the seat stepper, the computed total, and the checkout hand-off;
 * the container owns the payment dialog.
 */
export function SdkworkTeamPlanCards({
  initialSeats,
  mode,
  onBuy,
  onCancel,
}: SdkworkTeamPlanCardsProps) {
  const { port } = useSdkworkTeamSurfaceRuntime();
  const copy = useSdkworkTeamTranslate();
  const [packages, setPackages] = useState<readonly SdkworkTeamPackage[]>([]);
  const [packageGroups, setPackageGroups] = useState<readonly SdkworkTeamPackageGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<SdkworkTeamSubscriptionError | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [activeCycleKey, setActiveCycleKey] = useState<string | null>(null);
  const [seatDrafts, setSeatDrafts] = useState<Record<string, string>>({});
  const [purchasingPackageId, setPurchasingPackageId] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<SdkworkTeamSubscriptionError | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError(null);

    // Packages are the saleable rows; groups only name the billing options. A
    // membership deployment that does not serve groups yet must not fail the
    // whole surface, so the group read degrades to the recurrence fallback.
    void Promise.all([
      port.listPackages(),
      port.listPackageGroups().catch((): readonly SdkworkTeamPackageGroup[] => []),
    ])
      .then(([items, groups]) => {
        if (active) {
          setPackages(items);
          setPackageGroups(groups);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(normalizeSdkworkTeamError(error));
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [port, reloadToken]);

  const plans = groupTeamPlanPackages(packages);
  const cycleOptions = buildTeamCycleOptions(
    packages,
    packageGroups,
    (cycle) => copy(CYCLE_COPY[cycle].key, CYCLE_COPY[cycle].fallback),
  );
  const activeOption = cycleOptions.find((option) => option.key === activeCycleKey)
    ?? cycleOptions[0]
    ?? null;

  function resolveCyclePeriodLabel(option: SdkworkTeamCycleOption | null): string {
    const cycle = option?.billingCycle;
    if (cycle && CYCLE_PERIOD_COPY[cycle]) {
      return copy(CYCLE_PERIOD_COPY[cycle].key, CYCLE_PERIOD_COPY[cycle].fallback);
    }
    return copy("token_plan.team.per_period_month", "/ 月");
  }

  function setSeatDraft(groupKey: string, value: string): void {
    setSeatDrafts((current) => ({ ...current, [groupKey]: value }));
  }

  function stepSeat(groupKey: string, nextSeats: number, bounds: SdkworkTeamSeatBounds): void {
    setSeatDraft(groupKey, String(clampTeamSeatCount(nextSeats, bounds)));
  }

  function handleBuy(request: SdkworkTeamBuyRequest, packageId: string): void {
    if (purchasingPackageId) {
      return;
    }
    setCheckoutError(null);
    setPurchasingPackageId(packageId);

    void onBuy(request)
      .catch((error: unknown) => {
        setCheckoutError(normalizeSdkworkTeamError(error));
      })
      .finally(() => {
        setPurchasingPackageId(null);
      });
  }

  const checkoutErrorCopy = checkoutError ? resolveTeamPlanErrorCopy(checkoutError.reason) : null;

  return (
    <section className="space-y-6" data-team-plan-cards>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
            {mode === "expand"
              ? copy("token_plan.team.buy_more_seats", "购买更多坐席")
              : copy("token_plan.team.title", "团队订阅")}
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            {copy("token_plan.team.subtitle", "一个组织、一张账单，坐席分配给团队成员。")}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
          {onCancel ? (
            <Button onClick={onCancel} size="sm" type="button" variant="ghost">
              {copy("cancel", "取消")}
            </Button>
          ) : null}
          <div
            aria-label={copy("token_plan.team.period", "计费周期")}
            className="inline-flex flex-wrap gap-0.5 rounded-md border border-slate-200 bg-slate-100 p-0.5 dark:border-white/10 dark:bg-white/5"
            data-team-cycle-tabs
            role="group"
          >
            {cycleOptions.map((option) => {
              const isActive = option.key === activeOption?.key;
              return (
                <button
                  aria-pressed={isActive}
                  className={`inline-flex min-h-9 items-center gap-1 rounded-[0.3rem] px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-40 ${
                    isActive
                      ? "bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-white"
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                  data-team-cycle-tab={option.key}
                  key={option.key}
                  onClick={() => { setActiveCycleKey(option.key) }}
                  type="button"
                >
                  <span className="whitespace-nowrap" data-team-cycle-tab-label>
                    {option.label}
                  </span>
                  {option.description ? (
                    <span className="whitespace-nowrap text-[0.75rem] font-bold opacity-70">
                      {" "}
                      {option.description}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {activeOption?.billingCycle && CYCLE_HINT_COPY[activeOption.billingCycle] ? (
        <p
          className="text-xs font-medium text-emerald-600 dark:text-emerald-400"
          data-team-cycle-hint={activeOption.billingCycle}
        >
          {copy(
            CYCLE_HINT_COPY[activeOption.billingCycle]!.key,
            CYCLE_HINT_COPY[activeOption.billingCycle]!.fallback,
          )}
        </p>
      ) : null}

      {checkoutError && checkoutErrorCopy ? (
        <StatusNotice
          title={copy("token_plan.team.checkout_failed", "团队订阅支付未能发起。")}
          tone="danger"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm">
              {formatSdkworkTeamCopy(copy(checkoutErrorCopy.key, checkoutErrorCopy.fallback), {
                seats: String(initialSeats),
              })}
            </span>
            <Button
              onClick={() => { setCheckoutError(null) }}
              size="sm"
              type="button"
              variant="ghost"
            >
              {copy("close", "关闭")}
            </Button>
          </div>
        </StatusNotice>
      ) : null}

      {isLoading ? (
        <LoadingBlock label={copy("token_plan.team.loading", "正在加载团队订阅…")} />
      ) : null}

      {!isLoading && loadError ? (
        <StatusNotice title={copy("token_plan.team.load_failed", "团队订阅加载失败。")} tone="danger">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              onClick={() => { setReloadToken((token) => token + 1) }}
              size="sm"
              type="button"
              variant="ghost"
            >
              {copy("token_plan.team.retry", "重试")}
            </Button>
          </div>
        </StatusNotice>
      ) : null}

      {!isLoading && !loadError && plans.length === 0 ? (
        <EmptyState description={copy("token_plan.team.empty_packages", "暂无团队订阅套餐。")} />
      ) : null}

      {!isLoading && !loadError && plans.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {plans.map((group) => {
            const activePackage = selectTeamPlanPackage(group, activeOption);
            if (!activePackage) {
              return null;
            }
            const isExpanding = mode === "expand";
            const planBounds = resolveTeamSeatBounds(activePackage);
            // Expanding an existing subscription sells ADDITIONAL seats: the
            // stepper floor is one seat and the default is five (or the plan
            // minimum), never the current seat total.
            const bounds = isExpanding
              ? resolveAdditionalSeatBounds(planBounds)
              : planBounds;
            const draft = seatDrafts[group.planId]
              ?? String(
                isExpanding
                  ? resolveDefaultAdditionalSeatCount(planBounds)
                  : resolveDefaultTeamSeatCount(planBounds, initialSeats),
              );
            const parsedSeats = parseTeamSeatInput(draft, bounds);
            const seats = clampTeamSeatCount(parsedSeats, bounds);
            const total = computeTeamSeatTotal(activePackage.price, seats);
            const isPurchasing = purchasingPackageId === activePackage.id;
            const unitPrice = formatTeamCnyAmount(Number(activePackage.price));
            const originalPrice = activePackage.originalPrice
              ? formatTeamCnyAmount(Number(activePackage.originalPrice))
              : null;
            const periodLabel = resolveCyclePeriodLabel(activeOption);

            return (
              <article
                className={`flex min-w-0 flex-col rounded-3xl border bg-white p-5 shadow-sm transition-colors dark:bg-zinc-950 ${
                  group.recommended
                    ? "border-sky-500/60 ring-1 ring-sky-500/20"
                    : "border-slate-200 dark:border-white/10"
                }`}
                data-team-plan-card={group.planId}
                key={group.planId}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 truncate text-base font-semibold text-slate-950 dark:text-white">
                    {group.planName}
                  </h3>
                  {group.recommended ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-sky-500/10 px-2 py-1 text-[0.7rem] font-semibold text-sky-600 dark:text-sky-400">
                      <Sparkles aria-hidden="true" className="h-3 w-3" />
                      {copy("token_plan.team.recommended", "推荐")}
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-3xl font-semibold tabular-nums text-slate-950 dark:text-white">
                    {unitPrice}
                  </span>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {copy("token_plan.team.per_seat", "/ 坐席")}
                    {periodLabel}
                  </span>
                  {originalPrice ? (
                    <span className="text-sm tabular-nums text-slate-400 line-through dark:text-slate-500">
                      {originalPrice}
                    </span>
                  ) : null}
                </div>

                {Number(activePackage.seatPointsAmount) > 0 ? (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <Ticket aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                    {formatSdkworkTeamCopy(
                      copy("token_plan.team.points_included", "每坐席 {{points}} 会员积分"),
                      { points: Number(activePackage.seatPointsAmount).toLocaleString("en-US") },
                    )}
                  </p>
                ) : null}

                <div className="mt-5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      className="text-sm font-medium text-slate-700 dark:text-slate-300"
                      htmlFor={`team-seat-input-${group.planId}`}
                    >
                      {isExpanding
                        ? copy("token_plan.team.seat_label_add", "增加的坐席数")
                        : copy("token_plan.team.seat_label", "坐席数")}
                    </label>
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                      <UsersRound aria-hidden="true" className="h-3.5 w-3.5" />
                      {copy("token_plan.team.seat_unit", "个坐席")}
                    </span>
                  </div>

                  <div className="flex items-stretch gap-2">
                    <button
                      aria-label={`${copy("token_plan.team.seat_label", "坐席数")} −`}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                      disabled={seats <= bounds.min || isPurchasing}
                      onClick={() => { stepSeat(group.planId, seats - 1, bounds) }}
                      type="button"
                    >
                      <Minus aria-hidden="true" className="h-4 w-4" />
                    </button>
                    <input
                      aria-describedby={`team-seat-hint-${group.planId}`}
                      className="h-9 w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 text-center text-sm font-semibold tabular-nums text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-white/10 dark:bg-zinc-900 dark:text-white"
                      id={`team-seat-input-${group.planId}`}
                      inputMode="numeric"
                      onBlur={() => { setSeatDraft(group.planId, String(seats)) }}
                      onChange={(event) => {
                        setSeatDraft(
                          group.planId,
                          event.target.value.replaceAll(/[^0-9]/g, "").slice(0, 5),
                        );
                      }}
                      pattern="[0-9]*"
                      type="text"
                      value={draft}
                    />
                    <button
                      aria-label={`${copy("token_plan.team.seat_label", "坐席数")} +`}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                      disabled={seats >= bounds.max || isPurchasing}
                      onClick={() => { stepSeat(group.planId, seats + 1, bounds) }}
                      type="button"
                    >
                      <Plus aria-hidden="true" className="h-4 w-4" />
                    </button>
                  </div>

                  <p
                    className="min-h-4 text-xs text-amber-600 dark:text-amber-400"
                    id={`team-seat-hint-${group.planId}`}
                    role="status"
                  >
                    {parsedSeats < bounds.min
                      ? formatSdkworkTeamCopy(
                        copy("token_plan.team.seat_min_hint", "该套餐至少购买 {{min}} 个坐席。"),
                        { min: String(bounds.min) },
                      )
                      : null}
                    {parsedSeats > bounds.max
                      ? formatSdkworkTeamCopy(
                        copy("token_plan.team.seat_max_hint", "最多 {{max}} 个坐席。"),
                        { max: String(bounds.max) },
                      )
                      : null}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-dashed border-slate-200 pt-4 dark:border-white/10">
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {copy("token_plan.team.total", "合计")}
                  </span>
                  <span className="text-lg font-semibold tabular-nums text-slate-950 dark:text-white">
                    {formatTeamCnyAmount(total)}
                  </span>
                </div>

                {isExpanding ? (
                  <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {copy(
                      "token_plan.team.add_seats_hint",
                      "新增坐席立即生效，按当前订阅周期内的坐席单价计费；订阅周期保持不变。",
                    )}
                  </p>
                ) : null}

                <Button
                  className="mt-4 w-full disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={isPurchasing}
                  loading={isPurchasing}
                  onClick={() => {
                    handleBuy({
                      mode,
                      packageId: activePackage.id,
                      packageName: activePackage.name,
                      periodLabel: `${formatSdkworkTeamCopy(
                        copy("token_plan.team.checkout_seats", "{{seats}} 个坐席"),
                        { seats: String(seats) },
                      )} · ${periodLabel}`,
                      seats,
                      total,
                      ...(activePackage.originalPrice
                        ? {
                          originalPriceLabel: formatTeamCnyAmount(
                            Number(activePackage.originalPrice) * seats,
                          ),
                        }
                        : {}),
                    }, activePackage.id);
                  }}
                  type="button"
                >
                  <Check aria-hidden="true" className="h-4 w-4" />
                  {isExpanding
                    ? formatSdkworkTeamCopy(
                      copy("token_plan.team.add_seats", "增加 {{seats}} 个坐席"),
                      { seats: String(seats) },
                    )
                    : formatSdkworkTeamCopy(
                      copy("token_plan.team.buy_seats", "订阅 {{seats}} 个坐席"),
                      { seats: String(seats) },
                    )}
                </Button>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
