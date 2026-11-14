# @sdkwork/membership-pc-subscription

## Purpose

Subscription checkout, coupon application, and premium membership selection.

## Placement

- Architecture: `pc-react`
- Domain: `commerce`
- Capability: `subscription`
- Status: `ready`

## Depends on

- `@sdkwork/ui-pc-react` for shared UI primitives and patterns
- `@sdkwork/membership-service` for generated app/backend SDK boundaries, session checks, and response normalization
- Lower-level foundation host packages only

## Ownership

This package is implemented as an independent SDKWork commerce capability. It owns its public React/service contracts and consumes commerce data through injected service boundaries with wallet and membership ownership kept separate.

## Runtime boundary

All remote commerce access goes through `@sdkwork/membership-service` or through sibling commerce services that use the same boundary. Generated SDK clients remain behind the shared service contract.

Subscription catalog reads and purchases are orchestrated by:

- `subscription-catalog-service` — `memberships.packageGroups.list`, `plans.list`, `benefits.list`, purchase delegation
- `subscription-service` — checkout dashboard, coupons, payment methods, `memberships.purchases.*`
- `subscription-catalog-controller` — page lifecycle for `SubscriptionCatalogPage`

Static fixtures in `subscription-catalog-content.ts` are offline fallbacks only; production paths load data from app-api via SDK.

**Commerce checkout boundary:** The subscription package does not import order or payment SDKs, services, or UI packages. It delegates purchase intent and status reads through a host-injected `SdkworkMembershipCheckoutPort`. A product application composition root supplies the order-owned service and checkout UI. After payment success, order calls the membership fulfillment port so `pending_activation` subscriptions become active.

## Organization (team) subscription capability

`SdkworkSubscriptionCatalogPage` accepts an optional `team` capability:

```tsx
<SdkworkSubscriptionCatalogPage
  team={{
    port: teamSubscriptionPort,       // host implementation
    labels: { team: '团队订阅' },      // optional tab copy overrides
    translate: (key, fallback) => t(key, fallback), // optional localization
    locale: 'zh-CN',                  // optional date locale
  }}
/>
```

- With `team`, the page renders the 个人订阅 / 团队订阅 audience switch above the personal hero and mounts the team seat surface when the team audience is selected (`[data-token-plan-audience-tabs]`, `[data-team-plan-surface]`).
- Without `team`, the page is exactly the personal catalog it renders today.

The package still owns no transport. Everything the team surface needs arrives
through `SdkworkTeamSubscriptionPort` (`./catalog`), which the host implements
with its own generated SDK clients:

| Port method | Owner |
| --- | --- |
| `getOverview`, `listSeatAssignments`, `assignSeat`, `revokeSeat`, `updateSeatPolicy`, `reconcileSeats` | membership app API |
| `listRosterPage`, `listOwnMemberships`, `loadOrganizationName` | IAM app API |
| `listPackages` | membership catalog (`audience=team`) |
| `startCheckout`, `getCheckoutStatus` | order-owned membership checkout |
| `switchOrganization` | IAM app SDK organization selection + host session refresh |

### Organization scope and switching

Team endpoints resolve the organization from the authenticated principal, so a
personal/platform-scoped session answers `organization_scope_required`. The
surface then lists the account's team organizations from `listOwnMemberships()`
(the platform organization `0` is never offered) in a
`[data-team-organization-selector]` and marks the current one. Selecting an
organization calls `switchOrganization(id)` and re-reads the overview and roster.

The IAM app API's organization selection continues a sign-in challenge, so a
platform that has no pending challenge answers 400; the port maps that to the
`organization_sign_in_required` reason and the surface offers the host sign-in
instead of dropping the session. Hosts that issue a session on selection
(BirdCoder re-publishes its token manager, Cloud Router re-hydrates its IAM
runtime) refresh before the next read.

The surface reuses the page's host checkout modal for the seat payment
(`components.checkoutModal`), so a host that already presents the personal
checkout presents team seats the same way. Failure reasons the membership app
API sends (`seat_capacity_exceeded`, `seat_already_assigned`, …) are normalized
by `normalizeSdkworkTeamError` and rendered as localized copy instead of raw
wire codes.

## Verification

Use the package `typecheck` script and focused Vitest coverage for service, controller, and UI behavior when changing this package.

## SDKWork Documentation Contract

Domain: commerce
Capability: subscription
Package type: react-package
Status: ready

### Public API

Public exports are declared in `specs/component.spec.json` under `contracts.publicExports`.

### Required SDK Surface

- None declared in `specs/component.spec.json`.

### Configuration

Configuration keys and runtime entrypoints are declared in `specs/component.spec.json`.

### SaaS/Private/Local Behavior

This module follows the canonical standards linked from `specs/component.spec.json`, including deployment and runtime configuration rules where applicable.

### Security

Do not add secrets, live tokens, manual auth headers, or app-local credential handling to this module.

### Extension Points

Extension points are limited to declared public exports, runtime entrypoints, SDK clients, events, and config keys.

### Verification

- `pnpm --filter @sdkwork/membership-pc-subscription typecheck`

### Owner And Status

Owner and lifecycle status are tracked in `specs/component.spec.json`.
