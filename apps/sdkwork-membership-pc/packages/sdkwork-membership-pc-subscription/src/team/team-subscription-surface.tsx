import { useCallback, useEffect, useState } from "react";
import { Building2, LogIn, RefreshCw, ShieldCheck } from "lucide-react";
import { Button, LoadingBlock, StatusNotice } from "@sdkwork/ui-pc-react";

import type {
  SdkworkSubscriptionCatalogCheckoutPayment,
  SdkworkSubscriptionCatalogCheckoutPlan,
} from "../subscription-catalog-host";
import type { SdkworkSubscriptionPurchaseResult } from "../subscription-service";
import { SdkworkTeamOrganizationSelector } from "./team-organization-selector";
import { SdkworkTeamPlanCards, type SdkworkTeamBuyRequest } from "./team-plan-cards";
import { resolveTeamPlanErrorCopy } from "./team-plan-error-copy";
import { formatTeamCnyAmount } from "./team-plan-pricing";
import { applyOverviewToComposition } from "./team-roster-composition";
import { SdkworkTeamSeatDirectory } from "./team-seat-directory";
import { SdkworkTeamSeatPolicyPanel } from "./team-seat-policy";
import { SdkworkTeamSubscriptionSummary } from "./team-subscription-summary";
import {
  loadSdkworkTeamSnapshot,
  normalizeSdkworkTeamError,
  resolveTeamOrganizationChoices,
  type SdkworkTeamCheckoutPayment,
  type SdkworkTeamOwnMembership,
  type SdkworkTeamOrganizationChoice,
  type SdkworkTeamSnapshot,
  type SdkworkTeamSubscriptionError,
  type SdkworkTeamSubscriptionOverview,
} from "./team-subscription-port";
import {
  useSdkworkTeamSurfaceRuntime,
  useSdkworkTeamTranslate,
} from "./team-surface-context";

/**
 * Organization (team) subscription container.
 *
 * Data access is centralized in the host port (`SdkworkTeamSubscriptionPort`),
 * which is the only module that resolves membership, IAM, and order SDK clients.
 * Membership returns membership-owned facts only (the subscription overview and
 * the seat assignments); the organization roster, the caller's role, and the
 * member counts are composed from the IAM roster through that same port.
 *
 * This component owns the snapshot request lifecycle (bootstrap, retry,
 * unauthenticated sign-in guidance), the in-page organization switch, the
 * seat-management composition, and the hand-off to the host checkout dialog, so
 * both hosts render one team surface.
 */

interface TeamPlanState {
  isBootstrapped: boolean;
  isLoading: boolean;
  lastError: SdkworkTeamSubscriptionError | null;
  ownMemberships: readonly SdkworkTeamOwnMembership[];
  snapshot: SdkworkTeamSnapshot | null;
}

const INITIAL_TEAM_PLAN_STATE: TeamPlanState = {
  isBootstrapped: false,
  isLoading: false,
  lastError: null,
  ownMemberships: [],
  snapshot: null,
};

const ROLE_COPY: Record<string, { fallback: string; key: string }> = {
  admin: { fallback: "管理员", key: "token_plan.team.role_admin" },
  member: { fallback: "成员", key: "token_plan.team.role_member" },
  owner: { fallback: "所有者", key: "token_plan.team.role_owner" },
};

/** Display names resolved for at most this many organizations (selector list). */
const ORGANIZATION_NAME_LIMIT = 5;

interface PendingTeamCheckout {
  mode: SdkworkTeamBuyRequest["mode"];
  payment: SdkworkTeamCheckoutPayment;
  plan: SdkworkSubscriptionCatalogCheckoutPlan;
}

function useTeamPlanController() {
  const { port } = useSdkworkTeamSurfaceRuntime();
  const [state, setState] = useState<TeamPlanState>(INITIAL_TEAM_PLAN_STATE);

  const run = useCallback(async (silent: boolean): Promise<void> => {
    setState((current) => (
      silent ? current : { ...current, isLoading: true, lastError: null }
    ));

    // The organization list is read independently: a personal/platform-scoped
    // session fails the overview with `organization_scope_required`, and this
    // list is exactly what the surface needs to render in that state.
    const membershipsResult = await Promise.allSettled([port.listOwnMemberships()]);
    const ownMemberships = membershipsResult[0].status === "fulfilled"
      ? membershipsResult[0].value
      : undefined;

    try {
      const snapshot = await loadSdkworkTeamSnapshot(port, ownMemberships);
      setState((current) => ({
        isBootstrapped: true,
        isLoading: false,
        lastError: null,
        ownMemberships: ownMemberships ?? current.ownMemberships,
        snapshot,
      }));
    } catch (error) {
      const normalized = normalizeSdkworkTeamError(error);
      setState((current) => (
        silent && current.snapshot
          // A background refresh never replaces a valid snapshot with an error.
          ? {
            ...current,
            isBootstrapped: true,
            isLoading: false,
            ...(ownMemberships ? { ownMemberships } : {}),
          }
          : {
            ...current,
            isBootstrapped: true,
            isLoading: false,
            lastError: normalized,
            ...(ownMemberships ? { ownMemberships } : {}),
          }
      ));
    }
  }, [port]);

  const bootstrap = useCallback(() => run(false), [run]);

  const refresh = useCallback(() => {
    void run(true).catch(() => undefined);
  }, [run]);

  /**
   * Applies the overview a seat mutation or policy update returned.
   *
   * The roster and the seat map are unchanged by a policy update, so only the
   * membership-owned facts and the seat-overflow derivation are refreshed.
   */
  const replaceOverview = useCallback((overview: SdkworkTeamSubscriptionOverview) => {
    setState((current) => {
      if (!current.snapshot) {
        return current;
      }
      const composition = applyOverviewToComposition(current.snapshot.composition, overview);
      return {
        ...current,
        isBootstrapped: true,
        isLoading: false,
        lastError: null,
        snapshot: { ...current.snapshot, composition, overview },
      };
    });
  }, []);

  return { bootstrap, refresh, replaceOverview, state };
}

/** Maps an order payment onto the catalog checkout payment the host dialog reads. */
function toCatalogCheckoutPayment(
  payment: SdkworkTeamCheckoutPayment,
): SdkworkSubscriptionCatalogCheckoutPayment {
  return {
    ...(payment.amountCny === undefined ? {} : { amountCny: payment.amountCny }),
    ...(payment.expiresAt ? { expiresAt: payment.expiresAt } : {}),
    ...(payment.orderId ? { orderId: payment.orderId } : {}),
    ...(payment.qrCode || payment.cashierUrl
      ? { qrCode: payment.qrCode ?? payment.cashierUrl }
      : {}),
    status: payment.status,
  };
}

/**
 * Presents an already-created team payment through the personal checkout
 * contract, so the host dialog reuses the order QR/countdown/polling UI.
 */
function toPurchaseResult(payment: SdkworkTeamCheckoutPayment): SdkworkSubscriptionPurchaseResult {
  return {
    amountCny: payment.amountCny ?? null,
    durationDays: null,
    packageId: null,
    status: payment.status,
    ...(payment.cashierUrl ? { cashierUrl: payment.cashierUrl } : {}),
    ...(payment.expiresAt ? { expiresAt: payment.expiresAt } : {}),
    ...(payment.orderId ? { orderId: payment.orderId } : {}),
    ...(payment.qrCode ? { qrCode: payment.qrCode } : {}),
  };
}

/**
 * Renders the organization (team) subscription surface.
 *
 * @returns the team surface mounted by the shared catalog page.
 */
export function SdkworkTeamSubscriptionSurface() {
  const {
    port,
    onLoginRequired,
    onNotify,
    checkoutModal: CheckoutModal,
    locale,
  } = useSdkworkTeamSurfaceRuntime();
  const copy = useSdkworkTeamTranslate();
  const { bootstrap, refresh, replaceOverview, state } = useTeamPlanController();
  const [isExpanding, setIsExpanding] = useState(false);
  const [checkout, setCheckout] = useState<PendingTeamCheckout | null>(null);
  const [organizationNames, setOrganizationNames] = useState<Record<string, string>>({});
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<SdkworkTeamSubscriptionError | null>(null);

  useEffect(() => {
    if (!state.isBootstrapped && !state.isLoading && !state.lastError) {
      void bootstrap().catch(() => undefined);
    }
  }, [bootstrap, state.isBootstrapped, state.isLoading, state.lastError]);

  const overview = state.snapshot?.overview;
  const organizations = resolveTeamOrganizationChoices(
    state.ownMemberships,
    overview?.organizationId,
  );

  // Display names are permission-gated in IAM; a failed read falls back to the
  // organization id and never blocks the switch list.
  useEffect(() => {
    const targets = organizations
      .filter((organization) => organizationNames[organization.organizationId] === undefined)
      .slice(0, ORGANIZATION_NAME_LIMIT);
    if (targets.length === 0) {
      return undefined;
    }
    let active = true;
    void Promise.all(targets.map(async (organization) => {
      const name = await port.loadOrganizationName(organization.organizationId)
        .catch(() => undefined);
      return [organization.organizationId, name] as const;
    })).then((entries) => {
      if (!active) {
        return;
      }
      setOrganizationNames((current) => {
        const next = { ...current };
        for (const [organizationId, name] of entries) {
          if (name) {
            next[organizationId] = name;
          }
        }
        return next;
      });
    });
    return () => {
      active = false;
    };
  }, [organizationNames, organizations, port]);

  const organizationChoices: SdkworkTeamOrganizationChoice[] = organizations.map(
    (organization) => {
      const name = organizationNames[organization.organizationId];
      return name ? { ...organization, organizationName: name } : organization;
    },
  );

  /**
   * Switches the session to the selected team organization, then re-reads the
   * overview and roster so the surface reflects the new principal.
   */
  const handleSwitchOrganization = useCallback((organizationId: string): void => {
    if (isSwitching) {
      return;
    }
    setIsSwitching(true);
    setSwitchError(null);
    void port.switchOrganization(organizationId)
      .then(() => {
        onNotify(
          copy("token_plan.team.organization_switched", "已切换到所选团队组织。"),
          "success",
        );
        return bootstrap();
      })
      .catch((error: unknown) => {
        setSwitchError(normalizeSdkworkTeamError(error));
      })
      .finally(() => {
        setIsSwitching(false);
      });
  }, [bootstrap, copy, isSwitching, onNotify, port]);

  const switchErrorCopy = switchError ? resolveTeamPlanErrorCopy(switchError.reason) : null;
  const switchErrorNotice = switchError && switchErrorCopy ? (
    <div className="mt-3" data-team-organization-switch-error={switchError.reason}>
      <StatusNotice tone="danger">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm">{copy(switchErrorCopy.key, switchErrorCopy.fallback)}</span>
          {switchError.reason === "organization_sign_in_required" ? (
            <Button onClick={onLoginRequired} type="button">
              <LogIn aria-hidden="true" className="h-4 w-4" />
              {copy("nav.signin", "登录")}
            </Button>
          ) : (
            <Button
              onClick={() => { setSwitchError(null) }}
              size="sm"
              type="button"
              variant="ghost"
            >
              {copy("close", "关闭")}
            </Button>
          )}
        </div>
      </StatusNotice>
    </div>
  ) : null;

  /**
   * Starts the order-owned checkout for a seat purchase and hands the created
   * payment to the host dialog. The card keeps its own pending/error state by
   * awaiting this promise.
   */
  const startCheckout = useCallback(async (request: SdkworkTeamBuyRequest): Promise<void> => {
    const payment = await port.startCheckout({
      action: request.mode === "expand" ? "add_seats" : "purchase",
      packageId: request.packageId,
      seats: request.seats,
    });
    setCheckout({
      mode: request.mode,
      payment,
      plan: {
        audience: "team",
        id: payment.orderId ?? request.packageId,
        membershipTierKey: "team",
        name: request.packageName,
        packageNumericId: 0,
        packagePeriodLabel: request.periodLabel,
        priceLabel: formatTeamCnyAmount(request.total),
        ...(request.originalPriceLabel ? { originalPrice: request.originalPriceLabel } : {}),
      },
    });
  }, [port]);

  const closeCheckout = useCallback(() => { setCheckout(null) }, []);

  const handlePaymentStatus = useCallback(
    async (orderId: string): Promise<SdkworkSubscriptionCatalogCheckoutPayment> => (
      toCatalogCheckoutPayment(await port.getCheckoutStatus(orderId))
    ),
    [port],
  );

  const handlePurchase = useCallback(async (): Promise<SdkworkSubscriptionPurchaseResult> => {
    if (!checkout) {
      throw normalizeSdkworkTeamError(new Error("No team checkout has been started."));
    }
    return toPurchaseResult(checkout.payment);
  }, [checkout]);

  const handlePaymentCompleted = useCallback(
    async (payment: SdkworkSubscriptionCatalogCheckoutPayment): Promise<void> => {
      if (payment.status !== "completed" || checkout === null) {
        return;
      }
      onNotify(
        checkout.mode === "expand"
          ? copy("token_plan.team.add_seats_success", "坐席已增加到团队订阅，现在可以分配给成员。")
          : copy("token_plan.team.checkout_success", "团队订阅已开通，现在可以为成员分配坐席。"),
        "success",
      );
      setCheckout(null);
      setIsExpanding(false);
      refresh();
    },
    [checkout, copy, onNotify, refresh],
  );

  const snapshot = state.snapshot;
  const composition = snapshot?.composition;
  const lastError = state.lastError;
  const errorCopy = lastError ? resolveTeamPlanErrorCopy(lastError.reason) : null;
  const roleCopy = ROLE_COPY[composition?.viewerRole ?? ""] ?? null;
  const organizationTitle = composition?.organizationName?.trim()
    || composition?.organizationId?.trim()
    || copy("token_plan.team.no_org", "未选择组织");

  return (
    <div
      className="mx-auto w-full max-w-7xl px-4 pb-10 md:px-6 lg:px-8"
      data-team-plan-surface
    >
      <CheckoutModal
        isOpen={checkout !== null}
        onClose={closeCheckout}
        onPaymentCompleted={handlePaymentCompleted}
        onPaymentStatus={handlePaymentStatus}
        onPurchase={handlePurchase}
        plan={checkout?.plan ?? null}
      />

      {state.isLoading && !overview ? (
        <LoadingBlock label={copy("token_plan.team.loading", "正在加载团队订阅…")} />
      ) : null}

      {!overview && lastError && errorCopy ? (
        <div className="mt-2" data-team-plan-error={lastError.reason}>
          {lastError.reason === "unauthenticated" ? (
            <StatusNotice
              title={copy("errors.result.40101", "需要登录后继续。")}
              tone="warning"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm">{copy("errors.result.40101", "需要登录后继续。")}</span>
                <Button onClick={onLoginRequired} type="button">
                  <LogIn aria-hidden="true" className="h-4 w-4" />
                  {copy("nav.signin", "登录")}
                </Button>
              </div>
            </StatusNotice>
          ) : lastError.reason === "organization_scope_required" ? (
            <>
              <StatusNotice title={copy("token_plan.team.no_org", "未选择组织")} tone="warning">
                <span className="text-sm">
                  {copy(
                    "token_plan.team.no_org_hint",
                    "请先切换到团队组织，再购买和管理团队坐席。",
                  )}
                </span>
              </StatusNotice>
              {organizationChoices.length > 0 ? (
                <div className="mt-4">
                  <SdkworkTeamOrganizationSelector
                    isSwitching={isSwitching}
                    onSelect={handleSwitchOrganization}
                    organizations={organizationChoices}
                  />
                  {switchErrorNotice}
                </div>
              ) : (
                <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  {copy(
                    "token_plan.team.organization_none",
                    "当前账号不属于任何团队组织，因此无法购买或管理团队坐席。",
                  )}
                </p>
              )}
            </>
          ) : (
            <StatusNotice
              title={copy("token_plan.team.load_failed", "团队订阅加载失败。")}
              tone="danger"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm">{copy(errorCopy.key, errorCopy.fallback)}</span>
                <Button
                  disabled={state.isLoading}
                  loading={state.isLoading}
                  onClick={() => void bootstrap().catch(() => undefined)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <RefreshCw aria-hidden="true" className="h-4 w-4" />
                  {copy("token_plan.team.retry", "重试")}
                </Button>
              </div>
            </StatusNotice>
          )}
        </div>
      ) : null}

      {overview && composition ? (
        <>
          {organizationChoices.some((organization) => !organization.isCurrent) ? (
            <div className="mb-5">
              <SdkworkTeamOrganizationSelector
                isSwitching={isSwitching}
                onSelect={handleSwitchOrganization}
                organizations={organizationChoices}
              />
              {switchErrorNotice}
            </div>
          ) : null}

          <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                {copy("token_plan.team.org_label", "所属组织")}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Building2 aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-400" />
                <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
                  {organizationTitle}
                </h1>
                {roleCopy ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-200">
                    <ShieldCheck aria-hidden="true" className="h-3 w-3" />
                    {copy(roleCopy.key, roleCopy.fallback)}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                {copy(
                  "token_plan.team.subtitle",
                  "一个组织、一张账单，坐席分配给团队成员。",
                )}
              </p>
            </div>

            <Button
              className="self-start sm:self-auto"
              disabled={state.isLoading}
              loading={state.isLoading}
              onClick={() => void bootstrap().catch(() => undefined)}
              size="sm"
              type="button"
              variant="ghost"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              {copy("token_plan.team.retry", "重试")}
            </Button>
          </header>

          {overview.hasSubscription ? (
            <div className="space-y-5">
              {isExpanding ? (
                <SdkworkTeamPlanCards
                  initialSeats={overview.seatsPurchased}
                  mode="expand"
                  onBuy={startCheckout}
                  onCancel={() => { setIsExpanding(false) }}
                />
              ) : null}

              <SdkworkTeamSubscriptionSummary
                composition={composition}
                locale={locale}
                onBuyMoreSeats={
                  composition.canManageSeats && !isExpanding
                    ? () => { setIsExpanding(true) }
                    : undefined
                }
                overview={overview}
              />

              {composition.canManageSeats ? (
                <SdkworkTeamSeatDirectory
                  canManageSeats={composition.canManageSeats}
                  onNotify={onNotify}
                  onSeatChanged={refresh}
                  organizationId={composition.organizationId}
                  overview={overview}
                  seatAssignments={snapshot?.seatAssignments ?? []}
                />
              ) : null}

              {composition.canManageSeats ? (
                <SdkworkTeamSeatPolicyPanel
                  onNotify={onNotify}
                  onUpdated={replaceOverview}
                  overview={overview}
                />
              ) : null}
            </div>
          ) : (
            <SdkworkTeamPlanCards initialSeats={0} mode="subscribe" onBuy={startCheckout} />
          )}
        </>
      ) : null}
    </div>
  );
}
