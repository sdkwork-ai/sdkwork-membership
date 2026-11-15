import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { configureSdkworkMembershipSessionTokenProvider } from "@sdkwork/membership-service";
import { SdkworkThemeProvider } from "@sdkwork/ui-pc-react/theme";
import {
  SdkworkSubscriptionCatalogPage,
  createSdkworkSubscriptionCatalogController,
  type SdkworkSubscriptionCatalogData,
  type SdkworkSubscriptionCatalogModalProps,
} from "../src";

afterEach(() => {
  configureSdkworkMembershipSessionTokenProvider(null);
});

function buildCatalog(): SdkworkSubscriptionCatalogData {
  return {
    benefitsByRank: {},
    billingCycles: [
      { discountLabel: "5.8折", label: "连续包年" },
      { label: "单月购买" },
    ],
    comparisonCategories: [],
    memberSummary: null,
    packageGroupIds: [1, 2],
    packageGroups: [
      {
        description: "5.8折",
        id: 1,
        name: "连续包年",
        packages: [
          { durationDays: 365, id: 101, name: "基础会员(年)", pointAmount: 3936, price: 393, sortWeight: 1 },
          { durationDays: 365, id: 102, name: "高级会员(年)", pointAmount: 10992, price: 1099, sortWeight: 2 },
        ],
        sortWeight: 1,
      },
      {
        description: "6折",
        id: 2,
        name: "单月购买",
        packages: [
          { durationDays: 30, id: 201, name: "基础会员(月)", pointAmount: 400, price: 39, sortWeight: 1 },
          { durationDays: 30, id: 202, name: "高级会员(月)", pointAmount: 1000, price: 99, sortWeight: 2 },
        ],
        sortWeight: 2,
      },
    ],
    plans: [
      { id: 1, name: "基础", rank: 1 },
      { id: 2, name: "高级", rank: 2 },
    ],
  };
}

function CheckoutModalStub({ isOpen }: SdkworkSubscriptionCatalogModalProps) {
  return isOpen ? <div data-testid="checkout-modal-open" /> : null;
}

function PointsModalStub({ isOpen }: SdkworkSubscriptionCatalogModalProps) {
  return isOpen ? <div data-testid="points-modal-open" /> : null;
}

function PointsBalanceModalStub({
  currentPoints,
  isOpen,
}: SdkworkSubscriptionCatalogModalProps) {
  return isOpen ? <div data-testid="points-modal-open">{String(currentPoints)}</div> : null;
}

function renderCatalogPage() {
  // A logged-in IAM session is required for plan card checkout clicks.
  configureSdkworkMembershipSessionTokenProvider(() => ({
    accessToken: "test-access-token",
    authToken: "test-auth-token",
    refreshToken: "test-refresh-token",
  }));
  const controller = createSdkworkSubscriptionCatalogController({
    service: {
      getCatalog: async () => buildCatalog(),
    },
  });

  render(
    <SdkworkThemeProvider defaultTheme="light">
      <SdkworkSubscriptionCatalogPage
        catalogController={controller}
        components={{
          checkoutModal: CheckoutModalStub as never,
          pointsDetailsModal: PointsModalStub as never,
          pointsPurchaseModal: PointsModalStub as never,
          redeemModal: PointsModalStub as never,
        }}
      />
    </SdkworkThemeProvider>,
  );

  return controller;
}

describe("sdkwork-membership-pc-subscription catalog interactions", () => {
  function expectPlanName(name: string): void {
    const matches = screen.queryAllByText(name);
    expect(matches.length).toBeGreaterThan(0);
  }

  it("switches billing-cycle tabs and re-renders plan prices", async () => {
    renderCatalogPage();

    // DEFAULT_BILLING_CYCLE_INDEX is 3 (单月购买), clamped to the last group.
    await waitFor(() => {
      expectPlanName("基础会员(月)");
    });
    expect(screen.getAllByText("¥39").length).toBeGreaterThan(0);

    // Click the first billing tab: 连续包年 (hero and tier-compare both render tabs).
    fireEvent.click(screen.getAllByRole("button", { name: /连续包年/ })[0]);

    await waitFor(() => {
      expectPlanName("基础会员(年)");
    });
    expect(screen.getAllByText("¥393").length).toBeGreaterThan(0);
    expect(screen.queryAllByText("基础会员(月)")).toHaveLength(0);
  });

  it("opens the checkout modal when a plan card button is clicked", async () => {
    renderCatalogPage();

    await waitFor(() => {
      expectPlanName("基础会员(月)");
    });

    expect(screen.queryByTestId("checkout-modal-open")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: /¥39/ })[0]);
    expect(screen.getByTestId("checkout-modal-open")).toBeTruthy();
  });

  it("opens the points purchase modal from the hero action", async () => {
    renderCatalogPage();

    await waitFor(() => {
      expectPlanName("基础会员(月)");
    });

    expect(screen.queryByTestId("points-modal-open")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /购买算力积分/ }));
    expect(screen.getByTestId("points-modal-open")).toBeTruthy();
  });

  it("hands the host-supplied points balance to both points dialogs", async () => {
    configureSdkworkMembershipSessionTokenProvider(() => ({
      accessToken: "test-access-token",
      authToken: "test-auth-token",
    }));
    const controller = createSdkworkSubscriptionCatalogController({
      service: {
        getCatalog: async () => buildCatalog(),
      },
    });

    render(
      <SdkworkThemeProvider defaultTheme="light">
        <SdkworkSubscriptionCatalogPage
          catalogController={controller}
          components={{
            checkoutModal: CheckoutModalStub as never,
            pointsDetailsModal: PointsBalanceModalStub as never,
            pointsPurchaseModal: PointsBalanceModalStub as never,
            redeemModal: PointsModalStub as never,
          }}
          currentPoints={42.5}
        />
      </SdkworkThemeProvider>,
    );

    await waitFor(() => {
      expectPlanName("基础会员(月)");
    });

    // The details dialog used to render 0 because the page never forwarded the
    // balance; opening both dialogs must expose the same Token Bank figure.
    fireEvent.click(screen.getByRole("button", { name: "算力积分详情" }));
    fireEvent.click(screen.getByRole("button", { name: /购买算力积分/ }));

    const openDialogs = screen.getAllByTestId("points-modal-open");
    expect(openDialogs).toHaveLength(2);
    for (const dialog of openDialogs) {
      expect(dialog.textContent).toBe("42.5");
    }
    cleanup();
  });

  it("falls back to the host member summary point balance for both points dialogs", async () => {
    configureSdkworkMembershipSessionTokenProvider(() => ({
      accessToken: "test-access-token",
      authToken: "test-auth-token",
    }));
    const controller = createSdkworkSubscriptionCatalogController({
      service: {
        getCatalog: async () => buildCatalog(),
      },
    });

    render(
      <SdkworkThemeProvider defaultTheme="light">
        <SdkworkSubscriptionCatalogPage
          catalogController={controller}
          components={{
            checkoutModal: CheckoutModalStub as never,
            pointsDetailsModal: PointsBalanceModalStub as never,
            pointsPurchaseModal: PointsBalanceModalStub as never,
            redeemModal: PointsModalStub as never,
          }}
          memberSummary={{ membershipTierKey: "none", pointBalance: 7.25 }}
        />
      </SdkworkThemeProvider>,
    );

    await waitFor(() => {
      expectPlanName("基础会员(月)");
    });

    fireEvent.click(screen.getByRole("button", { name: "算力积分详情" }));
    fireEvent.click(screen.getByRole("button", { name: /购买算力积分/ }));

    const openDialogs = screen.getAllByTestId("points-modal-open");
    expect(openDialogs).toHaveLength(2);
    for (const dialog of openDialogs) {
      expect(dialog.textContent).toBe("7.25");
    }
    cleanup();
  });

  it("keeps an explicit empty balance instead of falling back to the member summary", async () => {
    configureSdkworkMembershipSessionTokenProvider(() => ({
      accessToken: "test-access-token",
      authToken: "test-auth-token",
    }));
    const controller = createSdkworkSubscriptionCatalogController({
      service: {
        getCatalog: async () => buildCatalog(),
      },
    });

    render(
      <SdkworkThemeProvider defaultTheme="light">
        <SdkworkSubscriptionCatalogPage
          catalogController={controller}
          components={{
            checkoutModal: CheckoutModalStub as never,
            pointsDetailsModal: PointsBalanceModalStub as never,
            pointsPurchaseModal: PointsBalanceModalStub as never,
            redeemModal: PointsModalStub as never,
          }}
          currentPoints={null}
          memberSummary={{ membershipTierKey: "none", pointBalance: 7.25 }}
        />
      </SdkworkThemeProvider>,
    );

    await waitFor(() => {
      expectPlanName("基础会员(月)");
    });

    fireEvent.click(screen.getByRole("button", { name: "算力积分详情" }));
    fireEvent.click(screen.getByRole("button", { name: /购买算力积分/ }));

    const openDialogs = screen.getAllByTestId("points-modal-open");
    expect(openDialogs).toHaveLength(2);
    for (const dialog of openDialogs) {
      expect(dialog.textContent).toBe("null");
    }
    cleanup();
  });

  it("renders no plan cards when the selected billing cycle has no packages", async () => {
    configureSdkworkMembershipSessionTokenProvider(() => ({
      accessToken: "test-access-token",
      authToken: "test-auth-token",
    }));
    const controller = createSdkworkSubscriptionCatalogController({
      service: {
        getCatalog: async () => ({
          ...buildCatalog(),
          packageGroups: [
            { id: 1, name: "连续包年", packages: [], sortWeight: 1 },
          ],
        }),
      },
    });

    render(
      <SdkworkThemeProvider defaultTheme="light">
        <SdkworkSubscriptionCatalogPage
          catalogController={controller}
          components={{
            checkoutModal: CheckoutModalStub as never,
            pointsDetailsModal: PointsModalStub as never,
            pointsPurchaseModal: PointsModalStub as never,
            redeemModal: PointsModalStub as never,
          }}
        />
      </SdkworkThemeProvider>,
    );

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /连续包年/ }).length).toBeGreaterThan(0);
    });

    // With no packages the page must not render placeholder cards.
    const cardButtons = screen.queryAllByRole("button", { name: /^¥/ });
    expect(cardButtons).toHaveLength(0);
  });

  it("notifies instead of dead-clicking when a package id is not numeric", async () => {
    configureSdkworkMembershipSessionTokenProvider(() => ({
      accessToken: "test-access-token",
      authToken: "test-auth-token",
    }));
    const onNotify = vi.fn();
    const controller = createSdkworkSubscriptionCatalogController({
      service: {
        getCatalog: async () => ({
          ...buildCatalog(),
          packageGroups: [
            {
              id: 1,
              name: "连续包年",
              packages: [
                { durationDays: 365, id: "package-basic-annual", name: "基础版(年)", pointAmount: 6400, price: 640, sortWeight: 1 },
              ],
              sortWeight: 1,
            },
          ],
        }),
      },
    });

    render(
      <SdkworkThemeProvider defaultTheme="light">
        <SdkworkSubscriptionCatalogPage
          catalogController={controller}
          components={{
            checkoutModal: CheckoutModalStub as never,
            pointsDetailsModal: PointsModalStub as never,
            pointsPurchaseModal: PointsModalStub as never,
            redeemModal: PointsModalStub as never,
          }}
          onNotify={onNotify}
        />
      </SdkworkThemeProvider>,
    );

    await waitFor(() => {
      expectPlanName("基础版(年)");
    });

    // A package with a non-numeric id maps to packageNumericId 0. The click
    // must surface a notice instead of silently doing nothing.
    fireEvent.click(screen.getAllByRole("button", { name: /¥640/ })[0]);
    expect(screen.queryByTestId("checkout-modal-open")).toBeNull();
    expect(onNotify).toHaveBeenCalledWith(
      expect.stringMatching(/暂时无法购买/),
      "error",
    );
  });
});
