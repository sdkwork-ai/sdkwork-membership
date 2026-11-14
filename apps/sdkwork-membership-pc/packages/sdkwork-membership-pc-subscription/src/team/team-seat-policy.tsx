import { useState } from "react";
import { Check, Layers, ShieldCheck } from "lucide-react";
import { Button, StatusNotice } from "@sdkwork/ui-pc-react";

import { resolveTeamPlanErrorCopy } from "./team-plan-error-copy";
import {
  normalizeSdkworkTeamError,
  type SdkworkTeamSeatPolicy,
  type SdkworkTeamSubscriptionError,
  type SdkworkTeamSubscriptionOverview,
} from "./team-subscription-port";
import {
  formatSdkworkTeamCopy,
  useSdkworkTeamSurfaceRuntime,
  useSdkworkTeamTranslate,
  type SdkworkTeamNotify,
} from "./team-surface-context";

export interface SdkworkTeamSeatPolicyPanelProps {
  onNotify: SdkworkTeamNotify;
  /** Receives the overview returned by the policy endpoint. */
  onUpdated: (overview: SdkworkTeamSubscriptionOverview) => void;
  overview: SdkworkTeamSubscriptionOverview;
}

const POLICY_OPTIONS: ReadonlyArray<{
  descriptionFallback: string;
  descriptionKey: string;
  icon: typeof Layers;
  labelFallback: string;
  labelKey: string;
  value: SdkworkTeamSeatPolicy;
}> = [
  {
    descriptionFallback: "超出已购坐席时阻止分配，并提示升级购买。",
    descriptionKey: "token_plan.team.policy_strict_hint",
    icon: ShieldCheck,
    labelFallback: "严格容量",
    labelKey: "token_plan.team.policy_strict",
    value: "strict",
  },
  {
    descriptionFallback: "允许分配超过已购坐席，后续统一对账补收。",
    descriptionKey: "token_plan.team.policy_flex_hint",
    icon: Layers,
    labelFallback: "允许超员",
    labelKey: "token_plan.team.policy_flex",
    value: "flex_overflow",
  },
];

/**
 * Organization seat policy form.
 *
 * The form keeps a local draft and re-renders from the overview the endpoint
 * returns; nothing is shown as saved before the server accepts it.
 */
export function SdkworkTeamSeatPolicyPanel({
  onNotify,
  onUpdated,
  overview,
}: SdkworkTeamSeatPolicyPanelProps) {
  const { port } = useSdkworkTeamSurfaceRuntime();
  const copy = useSdkworkTeamTranslate();
  const [autoAssignSeat, setAutoAssignSeat] = useState(overview.autoAssignSeat);
  const [seatPolicy, setSeatPolicy] = useState<SdkworkTeamSeatPolicy>(overview.seatPolicy);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<SdkworkTeamSubscriptionError | null>(null);

  const isDirty = autoAssignSeat !== overview.autoAssignSeat || seatPolicy !== overview.seatPolicy;
  const errorCopy = saveError ? resolveTeamPlanErrorCopy(saveError.reason) : null;

  function handleSave(): void {
    if (isSaving || !isDirty) {
      return;
    }
    setSaveError(null);
    setIsSaving(true);

    void port.updateSeatPolicy({ autoAssignSeat, seatPolicy })
      .then((nextOverview) => {
        // Re-render from the returned overview instead of an optimistic patch.
        setAutoAssignSeat(nextOverview.autoAssignSeat);
        setSeatPolicy(nextOverview.seatPolicy);
        onUpdated(nextOverview);
        onNotify(copy("token_plan.team.policy_saved", "坐席策略已更新。"), "success");
      })
      .catch((error: unknown) => {
        setSaveError(normalizeSdkworkTeamError(error));
      })
      .finally(() => {
        setIsSaving(false);
      });
  }

  return (
    <section
      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-white/10 dark:bg-zinc-950"
      data-team-seat-policy
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
            {copy("token_plan.team.policy_title", "坐席策略")}
          </h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            {copy(
              "token_plan.team.seat_management_desc",
              "每位成员最多持有一个坐席，回收后坐席可分配给其他成员。",
            )}
          </p>
        </div>
      </div>

      {saveError && errorCopy ? (
        <div className="mt-4">
          <StatusNotice
            title={formatSdkworkTeamCopy(copy(errorCopy.key, errorCopy.fallback), {
              seats: String(overview.seatsPurchased),
            })}
            tone="danger"
          />
        </div>
      ) : null}

      <div className="mt-5 flex items-start justify-between gap-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-900 dark:text-white">
            {copy("token_plan.team.auto_assign", "自动为新成员分配坐席")}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {copy(
              "token_plan.team.auto_assign_hint",
              "当有空闲坐席时，新加入的成员将自动获得坐席。",
            )}
          </p>
        </div>
        <button
          aria-checked={autoAssignSeat}
          aria-label={copy("token_plan.team.auto_assign", "自动为新成员分配坐席")}
          className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 dark:focus-visible:ring-offset-black ${
            autoAssignSeat
              ? "border-sky-500 bg-sky-500"
              : "border-slate-300 bg-slate-200 dark:border-white/20 dark:bg-white/10"
          }`}
          disabled={isSaving}
          onClick={() => { setAutoAssignSeat((current) => !current) }}
          role="switch"
          type="button"
        >
          <span
            aria-hidden="true"
            className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
              autoAssignSeat ? "translate-x-[1.375rem]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      <fieldset className="mt-4" disabled={isSaving}>
        <legend className="text-sm font-medium text-slate-900 dark:text-white">
          {copy("token_plan.team.seat_policy", "超员策略")}
        </legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2" role="radiogroup">
          {POLICY_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = seatPolicy === option.value;
            return (
              <button
                aria-checked={isSelected}
                className={`flex items-start gap-3 rounded-md border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-40 ${
                  isSelected
                    ? "border-sky-500 bg-sky-500/[0.06]"
                    : "border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-zinc-950 dark:hover:bg-white/5"
                }`}
                key={option.value}
                onClick={() => { setSeatPolicy(option.value) }}
                role="radio"
                type="button"
              >
                <span
                  className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                    isSelected
                      ? "bg-sky-500 text-white"
                      : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300"
                  }`}
                >
                  <Icon aria-hidden="true" className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-950 dark:text-white">
                    {copy(option.labelKey, option.labelFallback)}
                    {isSelected
                      ? <Check aria-hidden="true" className="h-3.5 w-3.5 text-sky-500" />
                      : null}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {copy(option.descriptionKey, option.descriptionFallback)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-5 flex items-center justify-end gap-3">
        <Button
          disabled={!isDirty || isSaving}
          loading={isSaving}
          onClick={handleSave}
          type="button"
        >
          {isSaving
            ? copy("token_plan.team.policy_saving", "保存中…")
            : copy("token_plan.team.policy_save", "保存策略")}
        </Button>
      </div>
    </section>
  );
}
