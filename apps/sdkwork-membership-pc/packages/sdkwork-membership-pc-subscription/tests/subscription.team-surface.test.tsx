import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SdkworkThemeProvider } from "@sdkwork/ui-pc-react/theme";

import {
  SdkworkSubscriptionCatalogPage,
  SdkworkTeamSubscriptionError,
  createSdkworkSubscriptionCatalogController,
  type SdkworkSubscriptionCatalogCheckoutModalProps,
  type SdkworkSubscriptionCatalogData,
  type SdkworkSubscriptionCatalogTeamProps,
  type SdkworkTeamCheckoutInput,
  type SdkworkTeamCheckoutPayment,
  type SdkworkTeamOwnMembership,
  type SdkworkTeamPackage,
  type SdkworkTeamRosterPage,
  type SdkworkTeamSeatAssignment,
  type SdkworkTeamSubscriptionOverview,
  type SdkworkTeamSubscriptionPort,
} from "../src";

/** A team organization the account belongs to (not the platform organization). */
const TEAM_ORGANIZATION_ID = "org-team";

afterEach(() => {
  vi.clearAllMocks();
});

function buildCatalog(): SdkworkSubscriptionCatalogData {
  return {
    benefitsByRank: {},
    billingCycles: [{ label: "Monthly" }],
    comparisonCategories: [],
    memberSummary: null,
    packageGroupIds: [],
    packageGroups: [],
    plans: [],
  };
}

function CheckoutModalStub({
  isOpen,
  plan,
}: SdkworkSubscriptionCatalogCheckoutModalProps) {
  return (
    <div
      data-checkout-open={isOpen ? "true" : "false"}
      data-plan-id={plan?.id ?? ""}
      data-testid="team-checkout-modal"
    />
  );
}

const TEAM_PACKAGE: SdkworkTeamPackage = {
  id: "42",
  name: "Team Pro Monthly",
  planId: "plan-1",
  planName: "Team Pro",
  planRank: "1",
  price: "19.9",
  recommended: true,
  recurrenceCycle: "month",
  seatMax: "50",
  seatMin: "5",
  seatPointsAmount: "1000",
  sortWeight: "1",
};

interface FakePortOptions {
  overview: SdkworkTeamSubscriptionOverview;
  /** Overview the bind call returns; defaults to the current one when omitted. */
  boundOverview?: SdkworkTeamSubscriptionOverview;
  /** Rejects the bind call with this failure. */
  bindError?: SdkworkTeamSubscriptionError;
  /** Rejects every overview read with this failure (scope-required states). */
  overviewError?: SdkworkTeamSubscriptionError;
  /** Own memberships the organization selector lists. */
  memberships?: SdkworkTeamOwnMembership[];
  /** Rejects the organization switch with this failure. */
  switchError?: SdkworkTeamSubscriptionError;
  /** Runs after a switch is accepted, so the fake backend can change scope. */
  onSwitched?: (organizationId: string) => void;
  owner?: boolean;
  roster?: SdkworkTeamRosterPage;
  seatAssignments?: SdkworkTeamSeatAssignment[];
}

function createFakePort(options: FakePortOptions) {
  const startCheckout = vi.fn<
    (input: SdkworkTeamCheckoutInput) => Promise<SdkworkTeamCheckoutPayment>
  >(async () => ({
    orderId: "order-9",
    qrCode: "weixin://pay/9",
    status: "pending",
  }));
  const switchOrganization = vi.fn(async (organizationId: string) => {
    await Promise.resolve(organizationId);
    if (options.switchError !== undefined) {
      throw options.switchError;
    }
    if (options.onSwitched !== undefined) {
      options.onSwitched(organizationId);
    }
  });
  const port: SdkworkTeamSubscriptionPort = {
    assignSeat: vi.fn(async (userId: string) => ({ assignedAt: "", seatNo: 4, userId })),
    bindOrganization: vi.fn(async (organizationId: string) => {
      if (options.bindError !== undefined) {
        throw options.bindError;
      }
      return options.boundOverview ?? { ...options.overview, organizationId };
    }),
    getCheckoutStatus: vi.fn(async () => ({
      orderId: "order-9",
      qrCode: "weixin://pay/9",
      status: "pending" as const,
    })),
    getOverview: vi.fn(async () => {
      if (options.overviewError !== undefined) {
        throw options.overviewError;
      }
      return options.overview;
    }),
    listOwnMemberships: vi.fn(async () => options.memberships ?? [{
      isPrimary: true,
      organizationId: options.overview.organizationId,
      role: options.owner === false ? "member" as const : "owner" as const,
      status: "active",
    }]),
    listPackages: vi.fn(async () => [TEAM_PACKAGE]),
    listRosterPage: vi.fn(async () => options.roster ?? {
      hasMore: false,
      items: [],
      page: 1,
      pageSize: 10,
      total: 0,
    }),
    listSeatAssignments: vi.fn(async () => options.seatAssignments ?? []),
    loadOrganizationName: vi.fn(async (organizationId: string) => (
      organizationId === TEAM_ORGANIZATION_ID ? "Acme Team" : "Acme"
    )),
    reconcileSeats: vi.fn(async () => ({ revokedCount: 0, seatsPurchased: 0, seatsUsed: 0 })),
    revokeSeat: vi.fn(async () => undefined),
    startCheckout,
    switchOrganization,
    updateSeatPolicy: vi.fn(async () => options.overview),
  };
  return { port, startCheckout, switchOrganization };
}

function renderPage(team?: SdkworkSubscriptionCatalogTeamProps, onLoginRequired?: () => void) {
  const controller = createSdkworkSubscriptionCatalogController({
    service: { getCatalog: async () => buildCatalog() },
  });
  return render(
    <SdkworkThemeProvider defaultTheme="light">
      <SdkworkSubscriptionCatalogPage
        catalogController={controller}
        components={{
          checkoutModal: CheckoutModalStub,
          pointsDetailsModal: () => null,
          pointsPurchaseModal: () => null,
          redeemModal: () => null,
        }}
        onLoginRequired={onLoginRequired}
        team={team}
      />
    </SdkworkThemeProvider>,
  );
}

const personalOverview: SdkworkTeamSubscriptionOverview = {
  autoAssignSeat: true,
  hasSubscription: false,
  organizationId: "org-1",
  seatPolicy: "strict",
  seatsAvailable: 0,
  seatsPurchased: 0,
  seatsUsed: 0,
};

/**
 * The page renders its personal checkout modal and the team surface renders its
 * own instance of the same host component, so the open one is read by state.
 * @param view - the rendered page.
 * @returns the plan id of the opened checkout, or null while all are closed.
 */
function openedCheckoutPlanId(view: ReturnType<typeof render>): string | null {
  const opened = view
    .getAllByTestId("team-checkout-modal")
    .find((element) => element.getAttribute("data-checkout-open") === "true");
  return opened?.getAttribute("data-plan-id") ?? null;
}

describe("shared subscription catalog team capability", () => {
  it("renders no audience switch when the host omits the team port", async () => {
    const view = renderPage();
    await waitFor(() => {
      expect(view.container.querySelector("[data-token-plan-audience-tabs]")).toBeNull();
    });
  });

  it("switches to the team surface and starts a seat checkout through the port", async () => {
    const { port, startCheckout } = createFakePort({ overview: personalOverview });
    const view = renderPage({ port });

    const tabs = await view.container.querySelectorAll("[data-token-plan-audience-tabs]");
    expect(tabs).toHaveLength(1);
    expect(view.container.querySelector("[data-team-plan-surface]")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: /团队订阅/u }));

    await waitFor(() => {
      expect(view.container.querySelector("[data-team-plan-surface]")).not.toBeNull();
    });
    const teamPlan = await screen.findByRole("button", { name: /订阅 5 个坐席/u });
    fireEvent.click(teamPlan);

    await waitFor(() => {
      expect(startCheckout).toHaveBeenCalledWith({
        action: "purchase",
        packageId: "42",
        seats: 5,
      });
    });
    await waitFor(() => {
      expect(openedCheckoutPlanId(view)).toBe("order-9");
    });
    expect(port.listPackages).toHaveBeenCalled();
  });

  it("renders the active team summary, seat directory, and policy for an owner", async () => {
    const { port } = createFakePort({
      overview: {
        autoAssignSeat: true,
        expiresAt: "2026-12-31T00:00:00Z",
        hasSubscription: true,
        organizationId: "org-1",
        planName: "Team Pro",
        seatPolicy: "strict",
        seatsAvailable: 1,
        seatsPurchased: 3,
        seatsUsed: 2,
      },
      roster: {
        hasMore: false,
        items: [
          { displayName: "Ada", membershipId: "m-1", membershipKind: "owner", userId: "u-1" },
          { displayName: "Bob", membershipId: "m-2", membershipKind: "member", userId: "u-2" },
        ],
        page: 1,
        pageSize: 10,
        total: 2,
      },
      seatAssignments: [{ assignedAt: "2026-01-01T00:00:00Z", seatNo: 1, userId: "u-1" }],
    });
    const view = renderPage({ port });

    fireEvent.click(await screen.findByRole("tab", { name: /团队订阅/u }));

    await waitFor(() => {
      expect(view.container.querySelector("[data-team-subscription-summary]")).not.toBeNull();
    });
    expect(view.container.querySelector("[data-team-seat-directory]")).not.toBeNull();
    expect(view.container.querySelector("[data-team-seat-policy]")).not.toBeNull();
    expect(await screen.findByText("Team Pro")).toBeInTheDocument();
    expect(view.container.querySelector('[data-seat-state="active"]')).not.toBeNull();
    expect(view.container.querySelector('[data-seat-state="unassigned"]')).not.toBeNull();
  });

  it("hides seat management from a plain organization member", async () => {
    const { port } = createFakePort({
      overview: {
        autoAssignSeat: false,
        hasSubscription: true,
        organizationId: "org-1",
        seatPolicy: "strict",
        seatsAvailable: 1,
        seatsPurchased: 3,
        seatsUsed: 2,
      },
      owner: false,
    });
    const view = renderPage({ port });

    fireEvent.click(await screen.findByRole("tab", { name: /团队订阅/u }));

    await waitFor(() => {
      expect(view.container.querySelector("[data-team-subscription-summary]")).not.toBeNull();
    });
    expect(view.container.querySelector("[data-team-seat-directory]")).toBeNull();
    expect(view.container.querySelector("[data-team-seat-policy]")).toBeNull();
  });

  it("offers the account's team organizations when the session is platform-scoped", async () => {
    const memberships: SdkworkTeamOwnMembership[] = [
      { isPrimary: true, organizationId: "0", status: "active" },
      { isPrimary: false, organizationId: TEAM_ORGANIZATION_ID, role: "owner", status: "active" },
    ];
    const options: FakePortOptions = {
      memberships,
      overview: personalOverview,
      overviewError: new SdkworkTeamSubscriptionError(
        "organization_scope_required",
        "team operations require an organization-scoped session",
        403,
      ),
      onSwitched: () => {
        options.overviewError = undefined;
        options.overview = { ...personalOverview, organizationId: TEAM_ORGANIZATION_ID };
      },
    };
    const { port, switchOrganization } = createFakePort(options);
    const view = renderPage({ port });

    fireEvent.click(await screen.findByRole("tab", { name: /团队订阅/u }));

    await waitFor(() => {
      expect(view.container.querySelector("[data-team-organization-selector]")).not.toBeNull();
    });
    // The platform organization ("0") is never offered as a team target.
    expect(view.container.querySelector('[data-team-organization-option="0"]')).toBeNull();
    const option = view.container.querySelector(
      `[data-team-organization-option="${TEAM_ORGANIZATION_ID}"]`,
    );
    expect(option).not.toBeNull();
    expect(option?.getAttribute("aria-pressed")).toBe("false");
    expect(await screen.findByText("Acme Team")).toBeInTheDocument();

    fireEvent.click(option as HTMLElement);

    await waitFor(() => {
      expect(switchOrganization).toHaveBeenCalledWith(TEAM_ORGANIZATION_ID);
    });
  });

  it("says plainly when the account belongs to no team organization", async () => {
    const { port } = createFakePort({
      memberships: [{ isPrimary: true, organizationId: "0", status: "active" }],
      overview: personalOverview,
      overviewError: new SdkworkTeamSubscriptionError(
        "organization_scope_required",
        "team operations require an organization-scoped session",
        403,
      ),
    });
    const view = renderPage({ port });

    fireEvent.click(await screen.findByRole("tab", { name: /团队订阅/u }));

    await waitFor(() => {
      expect(view.container.querySelector('[data-team-plan-error="organization_scope_required"]'))
        .not.toBeNull();
    });
    expect(view.container.querySelector("[data-team-organization-selector]")).toBeNull();
    expect(
      screen.getByText("当前账号不属于任何团队组织，因此无法购买或管理团队坐席。"),
    ).toBeInTheDocument();
  });

  it("offers the team plans to an account without an organization", async () => {
    // A platform-scoped session answers 200 with an empty organizationId, so the
    // catalog can sell team seats before an organization exists.
    const { port, startCheckout } = createFakePort({
      memberships: [{ isPrimary: true, organizationId: "0", status: "active" }],
      overview: { ...personalOverview, organizationId: "" },
    });
    const view = renderPage({ port });

    fireEvent.click(await screen.findByRole("tab", { name: /团队订阅/u }));

    await waitFor(() => {
      expect(view.container.querySelector("[data-team-plan-cards]")).not.toBeNull();
    });
    // No organization scope, no seat directory.
    expect(view.container.querySelector("[data-team-seat-directory]")).toBeNull();
    expect(view.container.querySelector("[data-team-organization-bind]")).toBeNull();

    fireEvent.click(await screen.findByRole("button", { name: /订阅 5 个坐席/u }));
    await waitFor(() => {
      expect(startCheckout).toHaveBeenCalledWith({
        action: "purchase",
        packageId: "42",
        seats: 5,
      });
    });
  });

  it("renders the organization bind step for a paid-but-unbound team subscription", async () => {
    const unboundOverview: SdkworkTeamSubscriptionOverview = {
      autoAssignSeat: true,
      hasSubscription: true,
      organizationBindingStatus: "unbound",
      organizationId: "",
      planName: "Team Pro",
      seatPolicy: "strict",
      seatsAvailable: 5,
      seatsPurchased: 5,
      seatsUsed: 0,
    };
    const bindError = new SdkworkTeamSubscriptionError(
      "team_organization_already_subscribed",
      "team_organization_already_subscribed: the organization already has an active team subscription",
      409,
    );
    const { port } = createFakePort({
      bindError,
      boundOverview: {
        ...unboundOverview,
        organizationBindingStatus: "bound",
        organizationId: TEAM_ORGANIZATION_ID,
      },
      memberships: [
        { isPrimary: true, organizationId: "0", status: "active" },
        { isPrimary: false, organizationId: TEAM_ORGANIZATION_ID, role: "owner", status: "active" },
      ],
      overview: unboundOverview,
    });
    const view = renderPage({ port });

    fireEvent.click(await screen.findByRole("tab", { name: /团队订阅/u }));

    await waitFor(() => {
      expect(view.container.querySelector("[data-team-organization-bind]")).not.toBeNull();
    });
    // The unbound state never offers the organization-scoped seat directory.
    expect(view.container.querySelector("[data-team-seat-directory]")).toBeNull();
    expect(view.container.querySelector("[data-team-seat-policy]")).toBeNull();
    // A second purchase is not offered while one unbound subscription exists.
    expect(view.container.querySelector("[data-team-plan-cards]")).toBeNull();

    const option = view.container.querySelector(
      `[data-team-organization-bind-option="${TEAM_ORGANIZATION_ID}"]`,
    );
    expect(option).not.toBeNull();
    expect(option?.getAttribute("data-team-organization-bind-eligible")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /绑定到此组织/u }));

    await waitFor(() => {
      expect(port.bindOrganization).toHaveBeenCalledWith(TEAM_ORGANIZATION_ID);
    });
    await waitFor(() => {
      expect(view.container.querySelector(
        '[data-team-organization-bind-error="team_organization_already_subscribed"]',
      )).not.toBeNull();
    });
  });

  it("marks an organization the caller cannot manage as ineligible", async () => {
    const { port } = createFakePort({
      memberships: [
        { isPrimary: false, organizationId: TEAM_ORGANIZATION_ID, role: "member", status: "active" },
      ],
      overview: {
        autoAssignSeat: true,
        hasSubscription: true,
        organizationBindingStatus: "unbound",
        organizationId: "",
        seatPolicy: "strict",
        seatsAvailable: 2,
        seatsPurchased: 2,
        seatsUsed: 0,
      },
    });
    const view = renderPage({ port });

    fireEvent.click(await screen.findByRole("tab", { name: /团队订阅/u }));

    await waitFor(() => {
      expect(view.container.querySelector("[data-team-organization-bind]")).not.toBeNull();
    });
    const option = view.container.querySelector(
      `[data-team-organization-bind-option="${TEAM_ORGANIZATION_ID}"]`,
    );
    expect(option?.getAttribute("data-team-organization-bind-eligible")).toBe("false");
  });

  it("asks for a fresh sign-in when the platform cannot switch the session", async () => {
    const onLoginRequired = vi.fn();
    const { port, switchOrganization } = createFakePort({
      memberships: [
        { isPrimary: true, organizationId: "0", status: "active" },
        { isPrimary: false, organizationId: TEAM_ORGANIZATION_ID, role: "admin", status: "active" },
      ],
      overview: personalOverview,
      overviewError: new SdkworkTeamSubscriptionError(
        "organization_scope_required",
        "team operations require an organization-scoped session",
        403,
      ),
      switchError: new SdkworkTeamSubscriptionError(
        "organization_sign_in_required",
        "login continuation required",
        400,
      ),
    });
    const view = renderPage({ port }, onLoginRequired);
    fireEvent.click(await screen.findByRole("tab", { name: /团队订阅/u }));

    let option: Element | null = null;
    await waitFor(() => {
      option = view.container.querySelector(
        `[data-team-organization-option="${TEAM_ORGANIZATION_ID}"]`,
      );
      expect(option).not.toBeNull();
    });
    fireEvent.click(option as unknown as HTMLElement);

    await waitFor(() => {
      expect(switchOrganization).toHaveBeenCalledWith(TEAM_ORGANIZATION_ID);
    });
    await waitFor(() => {
      expect(view.container.querySelector(
        '[data-team-organization-switch-error="organization_sign_in_required"]',
      )).not.toBeNull();
    });
    fireEvent.click(screen.getByRole("button", { name: /登录/u }));
    expect(onLoginRequired).toHaveBeenCalledTimes(1);
  });
});
