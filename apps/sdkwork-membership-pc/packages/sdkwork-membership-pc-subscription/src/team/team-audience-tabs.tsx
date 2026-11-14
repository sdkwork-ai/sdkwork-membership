import { Building2, UserRound } from "lucide-react";

/** Which subscription audience the catalog page presents. */
export type SdkworkSubscriptionAudience = "personal" | "team";

/** Optional copy overrides for the audience switch. */
export interface SdkworkSubscriptionAudienceLabels {
  /** Accessible group label. */
  label?: string;
  /** Personal tab label. */
  personal?: string;
  /** Team tab label. */
  team?: string;
}

export interface SdkworkSubscriptionAudienceTabsProps {
  active: SdkworkSubscriptionAudience;
  labels?: SdkworkSubscriptionAudienceLabels;
  onChange: (audience: SdkworkSubscriptionAudience) => void;
  /** Localized lookup: key plus default copy. */
  translate: (key: string, defaultValue: string) => string;
}

const AUDIENCES: readonly SdkworkSubscriptionAudience[] = ["personal", "team"];

/**
 * Top-level audience switch for the subscription catalog page.
 *
 * The switch only renders when the host supplies a team capability, so a page
 * without a team port keeps today's personal-only catalog.
 *
 * Layout is intrinsic: the strip is an `inline-flex` row with one gap unit
 * between the two tabs, and each tab keeps its icon and label on a single line
 * (`shrink-0` + `whitespace-nowrap`). Nothing stretches the pill across the
 * viewport, so the two labels never collide even in a 320px-wide dark shell.
 *
 * @param props - active audience, copy overrides, change handler, and lookup.
 * @returns the audience tab strip.
 */
export function SdkworkSubscriptionAudienceTabs({
  active,
  labels,
  onChange,
  translate,
}: SdkworkSubscriptionAudienceTabsProps) {
  return (
    <div className="flex w-full min-w-0 justify-center">
      <div
        aria-label={labels?.label ?? translate("token_plan.audience.label", "订阅类型")}
        className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-slate-100 p-1 dark:border-white/10 dark:bg-white/5"
        data-token-plan-audience-tabs
        role="tablist"
      >
        {AUDIENCES.map((audience) => {
          const isActive = audience === active;
          const Icon = audience === "personal" ? UserRound : Building2;
          const label = audience === "personal"
            ? labels?.personal ?? translate("token_plan.audience.personal", "个人订阅")
            : labels?.team ?? translate("token_plan.audience.team", "团队订阅");
          return (
            <button
              aria-selected={isActive}
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-black ${
                isActive
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
              data-audience={audience}
              key={audience}
              onClick={() => { onChange(audience) }}
              role="tab"
              type="button"
            >
              <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
