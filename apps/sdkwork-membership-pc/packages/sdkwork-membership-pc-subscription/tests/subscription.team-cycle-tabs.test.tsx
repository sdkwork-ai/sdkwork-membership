import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SdkworkThemeProvider } from "@sdkwork/ui-pc-react/theme";

import type { SdkworkSubscriptionCatalogCheckoutModalProps } from "../src/subscription-catalog-host";
import {
  SdkworkTeamPlanCards,
  type SdkworkTeamBuyRequest,
} from "../src/team/team-plan-cards";
import { SdkworkTeamSurfaceProvider } from "../src/team/team-surface-context";
import type {
  SdkworkTeamPackage,
  SdkworkTeamPackageGroup,
  SdkworkTeamSubscriptionPort,
} from "../src/team/team-subscription-port";

const CHECKOUT_MODAL = (_props: SdkworkSubscriptionCatalogCheckoutModalProps) => null;

/** One team package per plan/cycle pair, priced per seat like the catalog seed. */
const TEAM_PACKAGES: readonly SdkworkTeamPackage[] = [
  {
    id: "611",
    name: "团队基础版 - 按月按坐席",
    packageGroupId: "602",
    planId: "plan-team-starter",
    planName: "团队基础版",
    planRank: "11",
    price: "99",
    originalPrice: "129",
    recurrenceCycle: "month",
    seatMax: "200",
    seatMin: "3",
    seatPointsAmount: "5000",
    recommended: false,
    sortWeight: "11",
  },
  {
    id: "612",
    name: "团队基础版 - 按年按坐席",
    packageGroupId: "601",
    planId: "plan-team-starter",
    planName: "团队基础版",
    planRank: "11",
    price: "999",
    originalPrice: "1548",
    recurrenceCycle: "year",
    seatMax: "200",
    seatMin: "3",
    seatPointsAmount: "5000",
    recommended: false,
    sortWeight: "11",
  },
  {
    id: "617",
    name: "团队基础版 - 按季按坐席",
    packageGroupId: "603",
    planId: "plan-team-starter",
    planName: "团队基础版",
    planRank: "11",
    price: "291",
    originalPrice: "297",
    recurrenceCycle: "quarter",
    seatMax: "200",
    seatMin: "3",
    seatPointsAmount: "5000",
    recommended: false,
    sortWeight: "11",
  },
  {
    id: "620",
    name: "团队基础版 - 按单月按坐席",
    packageGroupId: "604",
    planId: "plan-team-starter",
    planName: "团队基础版",
    planRank: "11",
    price: "109",
    originalPrice: "119",
    recurrenceCycle: "once",
    seatMax: "200",
    seatMin: "3",
    seatPointsAmount: "5000",
    recommended: false,
    sortWeight: "11",
  },
];

const GROUP_PACKAGE = (groupPackageId: string): SdkworkTeamPackage => {
  const found = TEAM_PACKAGES.find((item) => item.packageGroupId === groupPackageId);
  if (!found) {
    throw new Error(`missing team package for group ${groupPackageId}`);
  }
  return found;
};

/** The four billing options, in catalog `sortWeight` order. */
const TEAM_GROUPS: readonly SdkworkTeamPackageGroup[] = [
  {
    billingCycle: "year",
    description: "9.7折",
    durationDays: "365",
    id: "601",
    name: "连续包年",
    packages: [GROUP_PACKAGE("601")],
  },
  {
    billingCycle: "month",
    description: "9.9折",
    durationDays: "30",
    id: "602",
    name: "连续包月",
    packages: [GROUP_PACKAGE("602")],
  },
  {
    billingCycle: "quarter",
    description: "9.8折",
    durationDays: "90",
    id: "603",
    name: "连续包季",
    packages: [GROUP_PACKAGE("603")],
  },
  {
    billingCycle: "once",
    durationDays: "30",
    id: "604",
    name: "单月购买",
    packages: [GROUP_PACKAGE("604")],
  },
];

function createPort(groups: readonly SdkworkTeamPackageGroup[]): SdkworkTeamSubscriptionPort {
  return {
    listPackageGroups: vi.fn(async () => groups),
    listPackages: vi.fn(async () => TEAM_PACKAGES),
  } as unknown as SdkworkTeamSubscriptionPort;
}

function renderCards(
  port: SdkworkTeamSubscriptionPort,
  onBuy = vi.fn<(request: SdkworkTeamBuyRequest) => Promise<void>>(async () => undefined),
) {
  render(
    <SdkworkThemeProvider defaultTheme="light">
      <SdkworkTeamSurfaceProvider
        value={{
          checkoutModal: CHECKOUT_MODAL,
          onLoginRequired: () => undefined,
          onNotify: () => undefined,
          port,
          translate: (key: string, defaultValue?: string) => defaultValue ?? key,
        }}
      >
        <SdkworkTeamPlanCards initialSeats={0} mode="subscribe" onBuy={onBuy} />
      </SdkworkTeamSurfaceProvider>
    </SdkworkThemeProvider>,
  );
  return { onBuy };
}

/** Reads the four cycle tabs' rendered labels. */
function readCycleTabs(): string[] {
  return screen
    .getAllByRole("button")
    .filter((button) => button.getAttribute("data-team-cycle-tab") !== null)
    .map((button) => button.textContent?.replaceAll(/\s+/gu, " ").trim() ?? "");
}

describe("team plan cards four billing options", () => {
  it("renders one cycle tab per package group with its discount label", async () => {
    renderCards(createPort(TEAM_GROUPS));

    await waitFor(() => {
      expect(screen.queryByText("正在加载团队订阅…")).toBeNull();
    });

    expect(readCycleTabs()).toEqual([
      "连续包年 9.7折",
      "连续包月 9.9折",
      "连续包季 9.8折",
      "单月购买",
    ]);
    const active = screen
      .getAllByRole("button")
      .filter((button) => button.getAttribute("aria-pressed") === "true");
    expect(active).toHaveLength(1);
    expect(active[0]?.getAttribute("data-team-cycle-tab")).toBe("601");
    expect(screen.getAllByText("¥999").length).toBeGreaterThan(0);
    expect(screen.getAllByText("¥2,997").length).toBeGreaterThan(0);
  });

  it("re-prices the card when another cycle is selected", async () => {
    renderCards(createPort(TEAM_GROUPS));

    await waitFor(() => {
      expect(screen.getAllByText("¥2,997").length).toBeGreaterThan(0);
    });

    for (const [groupKey, unitPrice, total] of [
      ["602", "¥99", "¥297"],
      ["603", "¥291", "¥873"],
      ["604", "¥109", "¥327"],
    ] as const) {
      fireEvent.click(
        screen
          .getAllByRole("button")
          .find((button) => button.getAttribute("data-team-cycle-tab") === groupKey)!,
      );
      await waitFor(() => {
        expect(screen.getAllByText(unitPrice).length).toBeGreaterThan(0);
      });
      expect(screen.getAllByText(total).length).toBeGreaterThan(0);
    }
  });

  it("checks out the package of the selected group", async () => {
    const { onBuy } = renderCards(createPort(TEAM_GROUPS));

    await waitFor(() => {
      expect(screen.getAllByText("¥2,997").length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getByRole("button", { name: /订阅 3 个坐席/u }));

    await waitFor(() => {
      expect(onBuy).toHaveBeenCalled();
    });
    const request = onBuy.mock.calls[0]?.[0] as { packageId: string; seats: number; total: number };
    expect(request.packageId).toBe("612");
    expect(request.seats).toBe(3);
    expect(request.total).toBe(2997);
  });

  it("falls back to recurrence tabs when the host serves no groups", async () => {
    renderCards(createPort([]));

    await waitFor(() => {
      expect(readCycleTabs()).toEqual(["连续包年", "连续包月", "连续包季", "单月购买"]);
    });
  });
});
