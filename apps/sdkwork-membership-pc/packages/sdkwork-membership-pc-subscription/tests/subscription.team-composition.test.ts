import { describe, expect, it } from "vitest";

import {
  composeTeamSeatComposition,
  joinTeamSeatDirectory,
  normalizeSdkworkTeamError,
  parseOwnMemberships,
  resolveTeamOrganizationChoices,
  resolveTeamOrganizationId,
  resolveTeamViewerRole,
  SdkworkTeamSubscriptionError,
  type SdkworkTeamRosterMember,
  type SdkworkTeamSeatAssignment,
} from "../src";
import {
  buildTeamCycleOptions,
  computeTeamSeatTotal,
  groupTeamPlanPackages,
  resolveAdditionalSeatBounds,
  resolveDefaultAdditionalSeatCount,
  selectTeamPlanPackage,
} from "../src/team/team-plan-pricing";

const roster: SdkworkTeamRosterMember[] = [
  { displayName: "Ada", membershipId: "m-1", membershipKind: "owner", userId: "u-1", username: "ada" },
  { displayName: "Bob", membershipId: "m-2", membershipKind: "member", userId: "u-2", username: "bob" },
  { displayName: "Cara", membershipId: "m-3", membershipKind: "admin", userId: "u-3", username: "cara" },
  { displayName: "Dan", membershipId: "m-4", membershipKind: "member", userId: "u-4", username: "dan" },
];

const seatAssignments: SdkworkTeamSeatAssignment[] = [
  { assignedAt: "2026-01-01T00:00:00Z", seatNo: 1, userId: "u-1" },
  { assignedAt: "2026-01-02T00:00:00Z", seatNo: 2, userId: "u-2" },
  { assignedAt: "2026-01-03T00:00:00Z", seatNo: 3, userId: "u-999" },
];

const overview = {
  autoAssignSeat: true,
  hasSubscription: true,
  organizationId: "org-from-principal",
  seatPolicy: "flex_overflow" as const,
  seatsAvailable: 0,
  seatsPurchased: 2,
  seatsUsed: 3,
};

describe("shared team seat composition", () => {
  it("derives the viewer role, licence counts, and overflow from IAM plus membership facts", () => {
    // The caller's own IAM membership is authoritative for the organization.
    const ownMemberships = parseOwnMemberships([
      { id: "m-2", isPrimary: false, membershipType: "member", organizationId: "org-secondary", status: "active" },
      { id: "m-1", isPrimary: true, membershipType: "OWNER", organizationId: "org-primary", status: "active" },
    ]);
    // The membership-reported organization is the session scope and wins over
    // the caller's own membership list (whose primary row may be the platform).
    expect(resolveTeamOrganizationId(ownMemberships, "org-from-principal")).toBe("org-from-principal");
    // A platform-scoped session falls back to the primary team membership.
    const organizationId = resolveTeamOrganizationId(ownMemberships, "0");
    expect(organizationId).toBe("org-primary");
    expect(resolveTeamViewerRole(ownMemberships, organizationId)).toBe("owner");

    const composition = composeTeamSeatComposition({
      membersTotal: roster.length,
      organizationId,
      organizationName: "Acme",
      overview,
      roster,
      seatAssignments,
      viewerRole: "owner",
    });

    expect(composition.membersTotal).toBe(4);
    // Only assignments whose user is on the roster count as licensed.
    expect(composition.licensedMembers).toBe(2);
    expect(composition.unlicensedMembers).toBe(2);
    expect(composition.overSeat).toBe(true);
    expect(composition.overSeatCount).toBe(1);
    expect(composition.canManageSeats).toBe(true);
    expect(composition.organizationId).toBe("org-primary");
    expect(composition.organizationName).toBe("Acme");

    // The member role never manages seats.
    const memberView = composeTeamSeatComposition({
      membersTotal: roster.length,
      organizationId,
      overview,
      roster,
      seatAssignments,
      viewerRole: "member",
    });
    expect(memberView.canManageSeats).toBe(false);
  });

  it("joins unassigned roster members without inventing a seat number", () => {
    const rows = joinTeamSeatDirectory(roster, seatAssignments);
    expect(rows).toHaveLength(4);
    expect(rows.filter((row) => row.isAssigned)).toHaveLength(2);
    expect(rows.map((row) => row.seatNo ?? null)).toEqual([1, 2, null, null]);
    expect(rows[3]?.name).toBe("Dan");
  });
});

describe("shared team plan pricing", () => {
  const packages = [
    {
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
    },
    {
      id: "43",
      name: "Team Pro Annual",
      planId: "plan-1",
      planRank: "1",
      price: "199",
      recurrenceCycle: "year",
      seatMax: "50",
      seatMin: "5",
      seatPointsAmount: "12000",
      recommended: true,
      sortWeight: "1",
    },
  ];

  it("groups monthly and annual variants under one plan and selects by cycle", () => {
    const plans = groupTeamPlanPackages(packages);
    expect(plans).toHaveLength(1);
    expect(plans[0]?.planName).toBe("Team Pro");
    // No package group is served: the tabs fall back to the recurrence cycle.
    const options = buildTeamCycleOptions(packages, [], (cycle) => cycle);
    expect(options.map((option) => option.billingCycle)).toEqual(["year", "month"]);
    expect(selectTeamPlanPackage(plans[0]!, options[1]!)?.id).toBe("42");
    expect(selectTeamPlanPackage(plans[0]!, options[0]!)?.id).toBe("43");
  });

  it("builds one tab per package group and selects the group's own package", () => {
    const grouped = [
      { ...packages[0]!, id: "611", packageGroupId: "602" },
      { ...packages[1]!, id: "612", recurrenceCycle: "year", packageGroupId: "601" },
      { ...packages[0]!, id: "617", recurrenceCycle: "quarter", packageGroupId: "603" },
      { ...packages[0]!, id: "620", recurrenceCycle: "once", packageGroupId: "604" },
    ];
    const groups = [
      {
        billingCycle: "year",
        description: "9.7折",
        durationDays: "365",
        id: "601",
        name: "连续包年",
        packages: [grouped[1]!],
      },
      {
        billingCycle: "month",
        description: "9.9折",
        durationDays: "30",
        id: "602",
        name: "连续包月",
        packages: [grouped[0]!],
      },
      {
        billingCycle: "quarter",
        description: "9.8折",
        durationDays: "90",
        id: "603",
        name: "连续包季",
        packages: [grouped[2]!],
      },
      { billingCycle: "once", durationDays: "30", id: "604", name: "单月购买", packages: [grouped[3]!] },
    ];

    const options = buildTeamCycleOptions(grouped, groups, (cycle) => cycle);
    expect(options.map((option) => option.key)).toEqual(["601", "602", "603", "604"]);
    expect(options.map((option) => option.label)).toEqual([
      "连续包年",
      "连续包月",
      "连续包季",
      "单月购买",
    ]);
    expect(options[0]?.description).toBe("9.7折");
    expect(options[0]?.durationDays).toBe(365);

    const plans = groupTeamPlanPackages(grouped);
    expect(plans).toHaveLength(1);
    for (const option of options) {
      expect(selectTeamPlanPackage(plans[0]!, option)?.packageGroupId).toBe(option.groupId);
    }
  });

  it("prices a seat total and keeps the expand stepper counting added seats", () => {
    expect(computeTeamSeatTotal("19.9", 5)).toBe(99.5);
    const bounds = resolveAdditionalSeatBounds({ max: 50, min: 5 });
    expect(bounds).toEqual({ max: 50, min: 1 });
    expect(resolveDefaultAdditionalSeatCount({ max: 50, min: 5 })).toBe(5);
  });
});

describe("shared team organization choices", () => {
  it("drops the platform organization, dedupes by organization, and marks the current one", () => {
    const choices = resolveTeamOrganizationChoices([
      { isPrimary: true, organizationId: "0", status: "active" },
      { isPrimary: false, organizationId: "org-team", role: "member", status: "active" },
      { isPrimary: false, organizationId: "org-team", role: "owner", status: "active" },
      { isPrimary: false, organizationId: "org-left", role: "member", status: "left" },
      { isPrimary: false, organizationId: "org-other", role: "admin", status: "active" },
    ], "org-team");

    expect(choices.map((choice) => choice.organizationId)).toEqual(["org-team", "org-other"]);
    expect(choices[0]).toMatchObject({ isCurrent: true, role: "owner" });
    expect(choices[1]).toMatchObject({ isCurrent: false, role: "admin" });
  });

  it("offers nothing when the account only holds the platform organization", () => {
    const choices = resolveTeamOrganizationChoices(
      [{ isPrimary: true, organizationId: "0", status: "active" }],
      undefined,
    );
    expect(choices).toEqual([]);
  });
});

describe("shared team failure normalization", () => {
  it("keeps a typed failure and maps a membership problem reason", () => {
    const typed = new SdkworkTeamSubscriptionError("seat_already_assigned", "taken", 409);
    expect(normalizeSdkworkTeamError(typed)).toBe(typed);

    const normalized = normalizeSdkworkTeamError({
      httpStatus: 409,
      problem: { detail: "seat taken", reason: "seat_already_assigned" },
    });
    expect(normalized.reason).toBe("seat_already_assigned");
    expect(normalized.httpStatus).toBe(409);
    expect(normalized.message).toBe("seat taken");
  });

  it("classifies the unauthenticated platform code and unknown failures", () => {
    expect(normalizeSdkworkTeamError({ problem: { code: 40101 } }).reason).toBe("unauthenticated");
    expect(normalizeSdkworkTeamError(new Error("boom")).reason).toBe("unknown");
  });
});
