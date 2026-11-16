import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageLayout } from "@sdkwork/ui-mobile-react";
import { Crown, Headphones, Percent, ShieldCheck, Star } from "lucide-react";

import {
  getMembershipSubscriptionRuntime,
  type MembershipPaymentMethod,
  type MembershipPlan,
  type MembershipStatus,
} from "./membership-runtime";

const BENEFITS = [
  { descriptionKey: "membership.benefits.price.description", icon: Percent, titleKey: "membership.benefits.price.title" },
  { descriptionKey: "membership.benefits.points.description", icon: Star, titleKey: "membership.benefits.points.title" },
  { descriptionKey: "membership.benefits.support.description", icon: Headphones, titleKey: "membership.benefits.support.title" },
  { descriptionKey: "membership.benefits.afterSales.description", icon: ShieldCheck, titleKey: "membership.benefits.afterSales.title" },
] as const;

const BENEFIT_FALLBACKS: Readonly<Record<string, { description: string; title: string }>> = {
  "membership.benefits.afterSales.title": { title: "售后保障", description: "会员专属售后通道" },
  "membership.benefits.points.title": { title: "积分回馈", description: "下单积分多倍累计" },
  "membership.benefits.price.title": { title: "会员专属价", description: "会员商品专属优惠价" },
  "membership.benefits.support.title": { title: "优先客服", description: "专属客服优先接入" },
};

function formatPrice(value: number | null | undefined): string {
  if (value == null) {
    return "--";
  }
  return `¥${value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatExpiry(value: string | undefined): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

/**
 * Membership subscription screen: current level hero, benefit grid, package
 * list and a payment-method picker. Plans, status and the purchase command all
 * come from the injected {@link MembershipSubscriptionRuntime}.
 */
export function MembershipSubscriptionPage() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<MembershipStatus | null>(null);
  const [plans, setPlans] = useState<readonly MembershipPlan[]>([]);
  const [methods, setMethods] = useState<readonly MembershipPaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState("");
  const [busyPlanId, setBusyPlanId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const runtime = getMembershipSubscriptionRuntime();
    if (!runtime) {
      setError(t("membership.unavailable", "会员能力尚未接入"));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [nextStatus, nextPlans, nextMethods] = await Promise.all([
        runtime.loadStatus(),
        runtime.loadPlans(),
        runtime.loadPaymentMethods(),
      ]);
      setStatus(nextStatus);
      setPlans(nextPlans);
      setMethods(nextMethods);
      setSelectedMethod((current) => current || nextMethods[0]?.code || "");
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : t("membership.loadFailed", "会员信息加载失败"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function purchase(planId: number): Promise<void> {
    const runtime = getMembershipSubscriptionRuntime();
    if (!runtime || busyPlanId !== null) {
      return;
    }
    if (!selectedMethod) {
      setMessage(t("membership.plans.payFailed", "暂不可用，请稍后再试"));
      return;
    }
    setBusyPlanId(planId);
    setMessage(null);
    try {
      const result = await runtime.purchase({ paymentMethod: selectedMethod, planId });
      setMessage(
        result.status === "completed"
          ? t("membership.plans.success", "开通成功")
          : result.status === "pending"
            ? t("membership.plans.pending", "支付处理中，请稍后查看")
            : result.message ?? t("membership.plans.failed", "开通失败，请稍后重试"),
      );
      if (result.status === "completed") {
        await load();
      }
    } catch (cause: unknown) {
      setMessage(cause instanceof Error ? cause.message : t("membership.plans.failed", "开通失败，请稍后重试"));
    } finally {
      setBusyPlanId(null);
    }
  }

  return (
    <PageLayout title={t("membership.title", "会员中心")}>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto bg-bg-color px-3 py-3 pb-8">
        {loading ? (
          <p className="py-10 text-center text-[13px] text-text-sub">{t("membership.loading", "加载会员信息...")}</p>
        ) : null}

        {error ? (
          <div className="flex flex-col items-center gap-3 rounded-xl bg-chat-other-bg p-4 text-center">
            <p className="text-[13px] text-text-sub">{error}</p>
            <button
              className="min-h-9 rounded-full border border-border-color px-4 py-1.5 text-[13px] text-text-main active:bg-active-bg"
              onClick={() => void load()}
              type="button"
            >
              {t("membership.retry", "重试")}
            </button>
          </div>
        ) : null}

        {!loading && !error ? (
          <>
            <section className="rounded-xl bg-primary-blue p-5 text-white">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
                <Crown aria-hidden="true" size={20} />
              </span>
              <h1 className="mt-2 text-[21px] font-bold leading-tight">
                {status?.levelName || t("membership.defaultLevel", "普通会员")}
              </h1>
              <p className="mt-1 text-[12px] opacity-85">
                {t("membership.heroSubtitle", "开通会员享专属价、积分回馈与优先客服")}
              </p>
              {status?.expireAt ? (
                <p className="mt-2 text-[12px] opacity-85">
                  {t("membership.plans.expire", "有效期至 {{date}}", { date: formatExpiry(status.expireAt) })}
                </p>
              ) : null}
            </section>

            {message ? (
              <div className="rounded-xl bg-fill px-4 py-3 text-[13px] text-text-main" role="status">
                {message}
              </div>
            ) : null}

            <section>
              <h2 className="mb-2 text-[15px] font-semibold text-text-main">
                {t("membership.benefits.title", "会员权益")}
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {BENEFITS.map((benefit) => {
                  const Icon = benefit.icon;
                  const fallback = BENEFIT_FALLBACKS[benefit.titleKey];
                  return (
                    <div className="rounded-xl bg-chat-other-bg p-3" key={benefit.titleKey}>
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-blue/10 text-primary-blue">
                        <Icon aria-hidden="true" size={16} />
                      </span>
                      <p className="mt-2 text-[13px] font-semibold text-text-main">
                        {t(benefit.titleKey, fallback?.title ?? "")}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-snug text-text-sub">
                        {t(benefit.descriptionKey, fallback?.description ?? "")}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>

            <section>
              <h2 className="mb-2 text-[15px] font-semibold text-text-main">
                {t("membership.plans.title", "会员方案")}
              </h2>
              {plans.length === 0 ? (
                <div className="rounded-xl bg-chat-other-bg py-8 text-center text-[13px] text-text-sub">
                  {t("membership.plans.empty", "暂无可选方案")}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {plans.map((plan) => (
                    <div
                      className="flex items-center justify-between gap-3 rounded-xl bg-chat-other-bg p-4"
                      key={plan.id}
                    >
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-[14px] font-semibold text-text-main">
                          {plan.name}
                          {plan.recommended ? (
                            <em className="rounded bg-primary-blue/10 px-1.5 py-0.5 text-[10px] not-italic text-primary-blue">
                              {t("membership.plans.recommended", "推荐")}
                            </em>
                          ) : null}
                        </p>
                        {plan.durationDays != null ? (
                          <p className="mt-0.5 text-[11px] text-text-sub">
                            {t("membership.plans.duration", "{{days}} 天", { days: plan.durationDays })}
                          </p>
                        ) : null}
                        {plan.description ? (
                          <p className="mt-0.5 text-[11px] text-text-sub">{plan.description}</p>
                        ) : null}
                        <p className="mt-1 text-[16px] font-bold text-primary-blue">{formatPrice(plan.priceCny)}</p>
                      </div>
                      <button
                        className="shrink-0 rounded-full bg-primary-blue px-4 py-2 text-[13px] font-medium text-white active:opacity-80 disabled:opacity-50"
                        disabled={busyPlanId !== null}
                        onClick={() => void purchase(plan.id)}
                        type="button"
                      >
                        {busyPlanId === plan.id
                          ? t("membership.plans.opening", "开通中...")
                          : status?.isMember
                            ? t("membership.plans.renew", "续费")
                            : t("membership.plans.open", "立即开通")}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {methods.length > 0 && plans.length > 0 ? (
              <section>
                <h2 className="mb-2 text-[15px] font-semibold text-text-main">
                  {t("membership.payment.title", "支付方式")}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {methods.map((method) => (
                    <button
                      className={`min-h-9 rounded-full border px-4 text-[13px] ${
                        selectedMethod === method.code
                          ? "border-primary-blue bg-primary-blue/10 text-primary-blue"
                          : "border-border-color text-text-main"
                      }`}
                      key={method.code}
                      onClick={() => setSelectedMethod(method.code)}
                      type="button"
                    >
                      {method.label}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </PageLayout>
  );
}
