# SDKWork Membership PRD

Status: active
Owner: SDKWork maintainers
Application: membership
Updated: 2026-07-26
Specs: REQUIREMENTS_SPEC.md, DOCUMENTATION_SPEC.md

## 1. Background And Problem

SDKWork Membership is the commerce-domain membership capability. It provides membership plans, package catalog, subscription lifecycle, paid-order fulfillment, entitlement fulfillment, points projection, daily rewards, and privilege usage tracking as a reusable T1 capability.

This capability is not the unified order center and is not the payment system. Token plan purchase, membership package purchase, order creation, order amount management, cashier entry, payment settlement, PSP webhook ingestion, recharge package, and exchange rules are owned by `sdkwork-order` and `sdkwork-payment`.

The product goal is to let host applications embed a complete membership experience while keeping capability ownership clean:

- membership owns catalog, subscription, entitlements, points projection, rewards, and fulfillment after settlement;
- order owns token-plan and membership-package order creation under unified order management;
- payment owns payment execution through order/payment ports;
- SDK consumers use service classes and composed SDK facades instead of raw HTTP.

## 2. Target Users

- **Operators** configure membership plans, packages, benefits, rewards, and operational state through backend-api surfaces.
- **Buyers** browse membership levels and packages, start purchase/renew/upgrade flows, complete cashier through the order/payment flow, and use membership privileges after settlement.
- **Integrators** embed the PC membership package, consume `@sdkwork/membership-app-sdk`, and inject checkout through the public membership checkout port from their application composition root.

## 3. Goals And Non-Goals

Goals:

- Provide a production-ready membership catalog and subscription domain.
- Support purchase, renew, and upgrade through the order-first checkout and immutable paid-order snapshot.
- Atomically materialize and activate the membership period after `sdkwork-order` confirms payment settlement.
- Initialize complete membership demo data for frontend flows without initializing order/payment tables.
- Keep frontend design unchanged while wiring UI -> service class -> composed SDK facade -> generated SDK.
- Keep API inputs and outputs aligned with `SdkWorkApiResponse`, `ProblemDetail`, standard pagination, and SDKWork SDK generation rules.

Non-goals:

- Do not create or manage `commerce_order` rows in membership.
- Do not create payment intents, attempts, payment methods, cashier URLs, PSP webhooks, recharge packages, exchange rules, or token-plan orders in membership.
- Do not add membership Rust dependencies on `sdkwork-order-*` crates.
- Do not bypass generated/composed SDKs with raw HTTP or manual auth headers in frontend services.

## 4. Scope

### 4.1 Plans

Plans define membership ranks, names, descriptions, status, and published versions. Rank `0` is the free tier. Paid ranks are activated only after order settlement triggers membership fulfillment.

### 4.2 Benefits

Benefits define grantable membership capabilities such as speed-up quota, priority queue, exclusive model access, and points-like benefits. For paid orders, period-scoped grants and ledger entries are created and activated inside the same Membership fulfillment transaction; they do not depend on a pre-payment pending subscription.

### 4.3 Packages

Packages are the sellable membership catalog units. They include price, currency, duration, points amount, display tags, recommendation state, ordering, and mapping to product SKU metadata. Package purchase orders are created by `sdkwork-order`; after payment, Membership validates the immutable Order snapshot against its tenant/platform catalog and atomically materializes the paid period.

### 4.4 Package Groups

Package groups organize packages by billing cycle and display context, such as yearly, monthly, quarterly, and one-time monthly. The PC subscription catalog reads package groups and packages through membership app SDK methods.

### 4.5 Purchase, Renew, And Upgrade

Purchase, renew, and upgrade follow a single order-first flow:

Token-plan and membership-package purchase ordering is in scope for `sdkwork-order` unified order management.

```text
PC membership UI payment choice
  -> host-injected SdkworkMembershipCheckoutPort
  -> order-owned service creates the membership-subject order
  -> order-owned checkout UI and payment-status service
  -> order/payment settlement
  -> order settlement calls membership fulfillment port
  -> membership atomically reserves and activates subscription, period, and entitlements
```

Action semantics:

- **purchase** atomically creates and activates a new `membership_subscription`, first `membership_period`, and period-scoped entitlement records after payment settlement.
- **renew** preserves the original subscription start, appends an active period from the current expiration boundary, and extends entitlement-account expiration.
- **upgrade** applies the paid target plan/package snapshot and activates the upgraded period-scoped entitlements.
- **replay** resolves through `membership_period.source_order_id` and returns the existing result without duplicate grants, ledgers, periods, or entitlement accounts.

Order responses own `requestNo`, `orderId`, amount, cashier, provider, payment parameters, and payment status. Membership fulfillment accepts only the immutable settlement snapshot and returns the membership activation outcome.

### 4.6 Points

Membership points are exposed through the membership capability as account and ledger projections. Seed data includes demo balances required by PC membership flows. Cross-capability payment or recharge bookkeeping remains outside membership.

### 4.7 Daily Rewards

Daily rewards track user check-in state and consecutive-day bonuses through `membership_daily_reward`. Duplicate reward claims are prevented by tenant/user/date uniqueness and idempotency.

### 4.8 Privilege Usage

Privilege usage reads quota from entitlement accounts and records per-period usage through `membership_privilege_usage`. Usage resets according to activated subscription periods.

## 5. Capability Boundaries

| Capability | Repository | Membership purchase responsibility |
| --- | --- | --- |
| Order | `sdkwork-order` | Unified order creation for token plans and membership packages, order amount breakdown, `orders.payments.create`, payment settlement, fulfillment saga |
| Payment | `sdkwork-payment` | Payment execution, intents, attempts, provider channels, refunds, PSP integration behind order/payment ports |
| Membership | `sdkwork-membership` | Catalog, subscription state, entitlement records, and atomic paid-order fulfillment after settlement |

Allowed dependency direction:

```text
sdkwork-order -> sdkwork-payment
sdkwork-order -> sdkwork-membership fulfillment port
frontend membership service -> @sdkwork/membership-app-sdk
application composition root -> sdkwork-membership + sdkwork-order
application composition root -> inject order-owned checkout port and UI
```

Forbidden dependency direction:

```text
sdkwork-payment -> sdkwork-order | sdkwork-membership
sdkwork-membership -> sdkwork-order packages, SDKs, services, UI, or Rust crates
sdkwork-membership -> INSERT commerce_order
sdkwork-membership database -> payment intent/attempt/method/cashier tables
```

Authority:

- `specs/commerce-order-membership-boundary.spec.json`
- `specs/COMMERCE_ORDER_BOUNDARY_SPEC.md`
- `../sdkwork-order/specs/commerce-checkout-topology.spec.json`
- `../sdkwork-payment/specs/commerce-dependency-boundary.spec.json`

## 6. Success Metrics

- Membership catalog page read latency P99 under 200 ms in normal deployment.
- Purchase/renew/upgrade fulfillment success rate above 99.5% excluding order/payment upstream failures.
- Fulfillment idempotency prevents duplicate entitlement grants for repeated settlement events.
- Database initialization remains limited to 18 membership capability tables.
- Static standards checks report no membership-owned order/payment table creation and no payment/cashier fields in Membership fulfillment contracts.

## 7. Phases

### Phase 1: Membership Catalog And PC Experience

- Membership plan, benefit, package, and package-group catalog.
- PC membership page, dashboard, package comparison, daily reward, points, and privilege usage.
- Generated/composed membership app SDK consumed through frontend service classes.
- Seed data covering demo catalog and authenticated membership read flows.

### Phase 2: Order-Led Checkout And Fulfillment

- `sdkwork-order` owns membership package and token plan order creation through unified order management.
- Order settlement supplies action, package, order number, subject, and paid timestamp through `MembershipPurchaseFulfillmentPort`; a pre-payment Membership reservation is not required.
- Product application roots compose the order-owned checkout service/UI with the membership checkout port.
- The PC subscription dashboard uses membership-owned default payment-method options for order checkout selection and does not depend on `sdkwork-payment` frontend or service packages.
- The standalone membership PC runtime configures only `VITE_SDKWORK_MEMBERSHIP_PC_APP_API_BASE_URL`.
- `apps/sdkwork-membership-pc/agent.app.config.json` `envBindings` is the source of truth for the membership SDK base URL key.
- Order runtime configuration belongs to the product application composition root, not the membership application.
- `orders.payments.create` returns cashier/payment parameters from order/payment.
- Order settlement calls Membership once; Membership reserves and activates the paid period and entitlements atomically and replays by source order without duplicate effects.
- Membership database initialization excludes order/payment/recharge/exchange tables.

### Phase 3: Commercial Operations

- Promotion/coupon composition through the owning promotion capability.
- Renewal retry and auto-renew authorization coordinated by order/payment capability boundaries.
- Membership analytics, conversion funnel, retention metrics, and privilege usage reporting.
- Additional tenant-specific catalog and benefit metadata as typed membership fields.

## 8. Linked Requirements

- API contracts: `apis/app-api/membership/membership-app-api.openapi.json`
- SDK family: `sdks/sdkwork-membership-app-sdk/`
- Database contract: `database/contract/schema.yaml`
- Boundary contract: `specs/commerce-order-membership-boundary.spec.json`
- Technical architecture: `docs/architecture/tech/TECH_ARCHITECTURE.md`

## 9. Open Questions

- Operator analytics for conversion and renewal should be modeled without copying order/payment tables into membership.
- Host applications must supply tenant context for guest catalog browsing before removing the standalone demo tenant fallback.
