import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LoadingBlock, StatusNotice } from "@sdkwork/ui-pc-react";
import { hasSdkworkMembershipSession } from "@sdkwork/membership-service";
import { SubscriptionCatalogHero } from "../components/subscription-catalog-hero";
import { SubscriptionCatalogPlanGrid } from "../components/subscription-catalog-plan-grid";
import { SubscriptionCatalogTierCompare } from "../components/subscription-catalog-tier-compare";
import { sdkworkSubscriptionCatalogHostComponents } from "../components/subscription-catalog-host-components";
import { useSdkworkSubscriptionIntl } from "../subscription-intl";
import type { SdkworkSubscriptionCatalogPlanCardModel } from "../subscription-catalog-content";
import {
  useSdkworkSubscriptionCatalogController,
  useSdkworkSubscriptionCatalogControllerState,
  type SdkworkSubscriptionCatalogController,
} from "../subscription-catalog-controller";
import {
  SDKWORK_SUBSCRIPTION_CATALOG_UNAVAILABLE_TIER_KEY,
  type SdkworkSubscriptionCatalogCheckoutPayment,
  type SdkworkSubscriptionCatalogCheckoutPlan,
  type SdkworkSubscriptionCatalogPageProps as SdkworkSubscriptionCatalogHostPageProps,
  type SdkworkSubscriptionCatalogTranslate,
} from "../subscription-catalog-host";
import type { SdkworkSubscriptionPurchaseResult } from "../subscription-service";
import {
  SdkworkSubscriptionAudienceTabs,
  SdkworkTeamSubscriptionSurface,
  SdkworkTeamSurfaceProvider,
  type SdkworkSubscriptionAudience,
  type SdkworkTeamSurfaceRuntime,
} from "../team";

export interface SdkworkSubscriptionCatalogPageProps extends SdkworkSubscriptionCatalogHostPageProps {
  catalogController?: SdkworkSubscriptionCatalogController;
}

/** A no-op component used when no `notifyOutlet` prop is supplied. */
function EmptyNotifyOutlet() {
  return null;
}

function redirectToDefaultLogin(): void {
  if (typeof window === "undefined") {
    return;
  }
  const { pathname, search, hash } = window.location;
  // Already on the auth surface: re-wrapping the whole current URL would nest
  // the redirect param one level deeper on every bounce. Stay put instead.
  if (pathname === "/auth" || pathname.startsWith("/auth/")) {
    return;
  }
  const returnPath = `${pathname}${search}${hash}`;
  window.location.assign(`/auth/login?redirect=${encodeURIComponent(returnPath || "/")}`);
}

export function SdkworkSubscriptionCatalogPage({
  catalogController: catalogControllerProp,
  checkoutPort,
  components,
  memberSummary: memberSummaryProp,
  notifyOutlet: NotifyOutletProp,
  onLoginRequired,
  onMembershipTierUpdated,
  onNotify,
  team,
}: SdkworkSubscriptionCatalogPageProps) {
  const { t } = useTranslation();
  const { copy } = useSdkworkSubscriptionIntl();

  // Use provided host components or fall back to built-in defaults so the
  // page works with zero configuration: <SdkworkSubscriptionCatalogPage />
  const hostComponents = components ?? sdkworkSubscriptionCatalogHostComponents;
  const NotifyOutlet = NotifyOutletProp ?? EmptyNotifyOutlet;

  // Stable no-op-safe callback wrappers for when the caller doesn't supply them.
  const handleMembershipTierUpdated = useCallback(
    (membershipTierKey: string, durationDays: number) => {
      onMembershipTierUpdated?.(membershipTierKey, durationDays);
    },
    [onMembershipTierUpdated],
  );
  const handleNotify = useCallback(
    (message: string, tone: "error" | "info" | "success") => {
      if (onNotify) {
        onNotify(message, tone);
      } else if (tone === "error") {
        // eslint-disable-next-line no-console
        console.error(`[subscription-catalog] ${message}`);
      }
    },
    [onNotify],
  );

  const {
    checkoutModal: CheckoutModal,
    pointsDetailsModal: PointsDetailsModal,
    pointsPurchaseModal: PointsPurchaseModal,
    redeemModal: RedeemModal,
  } = hostComponents;

  const controller = useSdkworkSubscriptionCatalogController(catalogControllerProp, {
    checkoutPort,
    translate: (key, defaultValue) => String(t(key, defaultValue ?? key)),
  });
  const state = useSdkworkSubscriptionCatalogControllerState(controller);

  const [isPointsModalOpen, setIsPointsModalOpen] = useState(false);
  const [isPointsDetailsModalOpen, setIsPointsDetailsModalOpen] = useState(false);
  const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const pendingPurchaseRef = useRef<SdkworkSubscriptionPurchaseResult | null>(null);
  const completedPaymentKeyRef = useRef<string | null>(null);

  const memberSummary = memberSummaryProp ?? state.memberSummary;
  const handleLoginRequired = onLoginRequired ?? redirectToDefaultLogin;

  const [audience, setAudience] = useState<SdkworkSubscriptionAudience>("personal");
  const translateTeamCopy = useMemo<SdkworkSubscriptionCatalogTranslate>(
    () => team?.translate ?? ((key, defaultValue) => String(t(key, defaultValue ?? key))),
    [t, team?.translate],
  );

  /**
   * Team surface runtime derived from the page's own props.
   *
   * The page owns the sign-in, notification, and payment presentation; the team
   * surface owns the seat management and the checkout hand-off, so a host plugs
   * the team in through one `team` prop.
   */
  const teamRuntime = useMemo<SdkworkTeamSurfaceRuntime | null>(
    () => (team
      ? {
        checkoutModal: CheckoutModal,
        ...(team.locale ? { locale: team.locale } : {}),
        onLoginRequired: handleLoginRequired,
        onNotify: handleNotify,
        port: team.port,
        translate: translateTeamCopy,
      }
      : null),
    [CheckoutModal, handleLoginRequired, handleNotify, team, translateTeamCopy],
  );
  const isTeamAudience = teamRuntime !== null && audience === "team";

  useEffect(() => {
    if (!state.isBootstrapped && !state.isLoading) {
      void controller.bootstrap().catch(() => undefined);
    }
  }, [controller, state.isBootstrapped, state.isLoading]);

  function openCheckoutForPlan(
    packageId: string,
    membershipTierKey: string,
    packageName: string,
    priceLabel: string,
    packageNumericId: number,
    originalPriceLabel?: string,
    packagePeriodLabel = "年",
  ) {
    if (!hasSdkworkMembershipSession()) {
      handleLoginRequired();
      return;
    }

    if (packageNumericId <= 0) {
      handleNotify(
        t("plan_unavailable_to_purchase", "该套餐暂时无法购买，请稍后重试。"),
        "error",
      );
      return;
    }

    if (
      membershipTierKey === SDKWORK_SUBSCRIPTION_CATALOG_UNAVAILABLE_TIER_KEY
      || memberSummary?.membershipTierKey === membershipTierKey
    ) {
      return;
    }

    const checkoutPlan: SdkworkSubscriptionCatalogCheckoutPlan = {
      id: packageId,
      membershipTierKey,
      name: packageName,
      originalPrice: originalPriceLabel,
      packageNumericId,
      packagePeriodLabel,
      priceLabel,
    };
    controller.selectCheckoutPlan(checkoutPlan);
    pendingPurchaseRef.current = null;
    completedPaymentKeyRef.current = null;
    setIsCheckoutModalOpen(true);
  }

  function handlePlanCardSelect(plan: SdkworkSubscriptionCatalogPlanCardModel) {
    if (plan.packageNumericId <= 0) {
      handleNotify(
        t("plan_unavailable_to_purchase", "该套餐暂时无法购买，请稍后重试。"),
        "error",
      );
      return;
    }

    openCheckoutForPlan(
      plan.id,
      plan.membershipTierKey,
      plan.name,
      plan.priceLabel,
      plan.packageNumericId,
      plan.originalPriceLabel || undefined,
      plan.packagePeriodLabel,
    );
  }

  function openPointsPurchase() {
    setIsPointsModalOpen(true);
  }

  async function handleCheckoutPurchase() {
    const selectedCheckoutPlan = state.selectedCheckoutPlan;
    if (!selectedCheckoutPlan) {
      throw new Error("No subscription plan has been selected.");
    }

    try {
      const result = await controller.purchaseSelectedPlan();
      pendingPurchaseRef.current = result;
      return result;
    } catch (error) {
      handleNotify(
        error instanceof Error ? error.message : t("subscription_failed", "订阅失败，请稍后重试。"),
        "error",
      );
      throw error;
    }
  }

  async function handleCheckoutPaymentStatus(orderId: string) {
    return controller.getPurchaseStatus(orderId);
  }

  async function handleCheckoutPaymentCompleted(
    payment: SdkworkSubscriptionCatalogCheckoutPayment,
  ) {
    if (payment.status !== "completed") {
      return;
    }

    const selectedCheckoutPlan = state.selectedCheckoutPlan;
    const paymentKey = payment.orderId ?? selectedCheckoutPlan?.id;
    if (!selectedCheckoutPlan || !paymentKey || completedPaymentKeyRef.current === paymentKey) {
      return;
    }

    completedPaymentKeyRef.current = paymentKey;
    handleMembershipTierUpdated(
      selectedCheckoutPlan.membershipTierKey,
      pendingPurchaseRef.current?.durationDays ?? 365,
    );
    handleNotify(t("subscription_success", "订阅成功！"), "success");
    await controller.refresh();
  }

  function closeCheckoutModal() {
    pendingPurchaseRef.current = null;
    completedPaymentKeyRef.current = null;
    setIsCheckoutModalOpen(false);
    controller.clearCheckoutPlan();
  }

  return (
    <div className="w-full pb-20 font-sans">
      <NotifyOutlet />

      <CheckoutModal
        isOpen={isCheckoutModalOpen}
        onClose={closeCheckoutModal}
        onPaymentCompleted={handleCheckoutPaymentCompleted}
        onPaymentStatus={handleCheckoutPaymentStatus}
        onPurchase={handleCheckoutPurchase}
        plan={state.selectedCheckoutPlan}
      />

      {team ? (
        <div className="pb-4 pt-1">
          <SdkworkSubscriptionAudienceTabs
            active={audience}
            labels={team.labels}
            onChange={setAudience}
            translate={translateTeamCopy}
          />
        </div>
      ) : null}

      {isTeamAudience && teamRuntime ? (
        <SdkworkTeamSurfaceProvider value={teamRuntime}>
          <SdkworkTeamSubscriptionSurface />
        </SdkworkTeamSurfaceProvider>
      ) : null}

      {!isTeamAudience && state.isLoading && !state.isBootstrapped ? (
        <div className="px-6 py-12">
          <LoadingBlock label={t("loading_catalog", "正在加载套餐信息...")} />
        </div>
      ) : null}

      {!isTeamAudience && state.lastError && state.catalog === null && !state.isLoading ? (
        <div className="px-6 py-12">
          <StatusNotice title={t("load_failed", "加载失败")} tone="danger">
            {state.lastError}
          </StatusNotice>
          <div className="mt-4 text-center">
            <button
              className="rounded-lg bg-zinc-900 px-6 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
              onClick={() => {
                void controller.retry().catch(() => undefined);
              }}
              type="button"
            >
              {t("retry", "重试")}
            </button>
          </div>
        </div>
      ) : null}

      {!isTeamAudience && state.isBootstrapped && state.catalog !== null ? (
        <>
          <SubscriptionCatalogHero
            billingCycleIndex={state.billingCycleIndex}
            billingCycles={state.billingCycles}
            onOpenPointsDetails={() => setIsPointsDetailsModalOpen(true)}
            onOpenPointsPurchase={openPointsPurchase}
            onOpenRedeem={() => setIsRedeemModalOpen(true)}
            onSelectBillingCycle={(index) => {
              controller.selectBillingCycle(index);
            }}
            subtitleLead={t("choose_suitable_plan", "选择合适你的套餐，或直接")}
            subtitlePointsActionLabel={t("buy_points", "购买算力积分")}
            subtitleRedeemActionLabel={t("redeem_vip", "会员兑换")}
            title={t("unlock_infinite", "订阅特权，解锁无尽竞技能力")}
          />

          <SubscriptionCatalogPlanGrid onSelectPlan={handlePlanCardSelect} plans={state.planCards} />

          <div className="flex items-center justify-center gap-2 py-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">
              {copy.catalog.categoryToken}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">{copy.catalog.categoryLabel}</span>
          </div>

          <SubscriptionCatalogTierCompare
            billingCycleIndex={state.billingCycleIndex}
            billingCycles={state.billingCycles}
            comingSoonLabel={t("coming_soon", "敬请期待")}
            comparisonCategories={state.comparisonCategories}
            currentPlanLabel={t("current_plan", "当前计划")}
            firstYear58Label={t("first_year_58", "首年5.8折")}
            firstYear60Label={t("first_year_60", "首年6折")}
            onSelectBillingCycle={(index) => {
              controller.selectBillingCycle(index);
            }}
            onSelectPackage={(packageId, membershipTierKey, packageName, priceLabel, originalPriceLabel, packagePeriodLabel) => {
              const tierColumn = state.tierColumns.find((column) => column.packageId === packageId);
              if (!tierColumn) {
                return;
              }
              openCheckoutForPlan(
                packageId,
                membershipTierKey,
                packageName,
                priceLabel,
                tierColumn.packageNumericId,
                originalPriceLabel,
                packagePeriodLabel,
              );
            }}
            perMonthShortLabel={t("per_month_short", "每月")}
            perYearShortLabel={t("per_year_short", "每年")}
            premiumPlanLabel={t("premium_plan", "高级会员")}
            sectionTitle={t("which_plan_suits_you", "哪个计划更适合你")}
            standardPlanLabel={t("standard_plan", "标准会员")}
            superPlanLabel={t("super_plan", "超级会员")}
            tierColumns={state.tierColumns}
            basicPlanLabel={t("basic_plan", "基础会员")}
          />

          <PointsPurchaseModal
            currentPoints={memberSummaryProp?.pointBalance ?? null}
            isOpen={isPointsModalOpen}
            onClose={() => setIsPointsModalOpen(false)}
          />

          <PointsDetailsModal
            isOpen={isPointsDetailsModalOpen}
            onClose={() => setIsPointsDetailsModalOpen(false)}
          />

          <RedeemModal
            isOpen={isRedeemModalOpen}
            onClose={() => setIsRedeemModalOpen(false)}
          />
        </>
      ) : null}
    </div>
  );
}
