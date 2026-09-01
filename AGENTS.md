# Repository Guidelines

## SDKWORK Soul

Read `../sdkwork-specs/SOUL.md` before executing tasks in this root. Follow specs before memory, dictionary before context, stop on ambiguity, and evidence before completion.

## SDKWORK Standards

Canonical SDKWORK specs path from this root:

- `../sdkwork-specs/README.md`
- `../sdkwork-specs/SOUL.md`
- `../sdkwork-specs/AGENTS_SPEC.md`
- `../sdkwork-specs/PNPM_SCRIPT_SPEC.md`
- `../sdkwork-specs/GITHUB_WORKFLOW_SPEC.md`
- `../sdkwork-specs/CODE_STYLE_SPEC.md`
- `../sdkwork-specs/NAMING_SPEC.md`
- `../sdkwork-specs/SOURCE_CONFIG_SPEC.md`

Do not copy root standard text into this repository. If these relative paths do not resolve, stop and report the broken workspace layout.

## Application Identity

Read `sdkwork.app.config.json` only when changing Settings application behavior, runtime config, SDK wiring, release metadata, packaging, app-owned capabilities, or deployment metadata.

- Domain: `commerce`
- Capability: `membership`
- Table prefix: `membership_`
- App API prefix: `/app/v3/api/membership`
- Backend API prefix: `/backend/v3/api/membership`
- PC application root: `apps/sdkwork-membership-pc/`

This is a **T1 commerce capability repository**. This repository is self-contained with its own API server, persistence, IAM middleware, and SDK surfaces.

## Capability Dependency Boundary

**Order creation and payment settlement are owned by `sdkwork-order`. Membership owns catalog, subscription/entitlement domain, and fulfillment after order payment success.**

| Direction | Allowed |
| --- | --- |
| Order → Payment | Yes (in-process ports; payment MUST NOT depend on order) |
| Order → Membership | Yes (`MembershipPurchaseFulfillmentPort` after `subject=membership` settlement) |
| Membership → Order packages, SDKs, services, or UI | **No** (membership exposes a host-injected checkout port only) |
| Membership → Payment packages, SDKs, services, or UI | **No** |
| Payment → Order / Membership | **No** (foundation module) |
| Membership → `sdkwork-order-*` Rust crates | **No** |
| Membership → `INSERT commerce_order` | **No** (order domain only; membership reserves subscription by `orderId`) |
| Application composition root → Membership + Order | Yes (inject the order-owned checkout implementation into membership UI) |

Authority: `specs/commerce-order-membership-boundary.spec.json`, `specs/COMMERCE_ORDER_BOUNDARY_SPEC.md`, `../sdkwork-order/specs/commerce-checkout-topology.spec.json`, `../sdkwork-payment/specs/commerce-dependency-boundary.spec.json`.

## Framework Integration Boundaries

### Mandatory Frameworks

- `sdkwork-web-framework`: All HTTP `*-api` surfaces (`open-api`, `app-api`, `backend-api`) MUST integrate `sdkwork-web-core`, `sdkwork-web-axum`, `sdkwork-web-bootstrap`, and route crates through `sdkwork-routes-web-framework-backend-api`. Business repositories MUST NOT fork the standard interceptor chain or request-context framework locally. Authority: `WEB_FRAMEWORK_SPEC.md`.
- `sdkwork-database`: Database lifecycle, migrations, seeds, drift, and SPI orchestration through `sdkwork-database-config`, `sdkwork-database-lifecycle`, `sdkwork-database-spi`, `sdkwork-database-sqlx`. Authority: `DATABASE_FRAMEWORK_SPEC.md`.
- `sdkwork-utils`: Cross-language utility library to reduce duplicate code. Use `sdkwork-utils-rust` for string, datetime, validation, crypto, encoding, collection, http_api operations. Authority: `CODE_STYLE_SPEC.md`.

### Optional Frameworks

- `sdkwork-discovery`: Not integrated. This repository has no RPC services. Add `sdkwork-discovery` integration when RPC services are introduced. Authority: `DISCOVERY_SPEC.md`.
- `sdkwork-drive`: Not integrated. This repository has no file upload surfaces. Add `sdkwork-drive` integration when file upload capabilities are introduced. Authority: `DRIVE_SPEC.md`.

## Local Dictionary Structure

- `AGENTS.md`: agent execution rules and relative spec entrypoint.
- `sdkwork.app.config.json`: application identity, app metadata, release surfaces, and owned capabilities.
- `etc/`: deployable-root source configuration and typed standalone/cloud profile authority.
- `.sdkwork/`: local skills, plugins, manifests, and repository/application AI workspace metadata.
- `specs/`: repository/application root specs for cross-module machine contracts.
- `docs/`: Canon documentation at `docs/product/prd/PRD.md` and `docs/architecture/tech/TECH_ARCHITECTURE.md`.
- `apis/`: OpenAPI authorities for `app-api`.
- `sdks/`: SDK families, OpenAPI authorities, derived generator inputs, route manifests, family-root `sdk-manifest.json`, and generated outputs.
- `crates/`: Rust workspace members (service, repository-sqlx, route crates, database-host, service-host, standalone-gateway, gateway-assembly).
- `apps/sdkwork-membership-pc/`: PC web application root with its own `sdkwork.app.config.json`.
- `database/`: DDL baselines, migrations, seeds, and contract registry.
- `package.json`: pnpm scripts and dev dependencies for the workspace root.

## Spec Resolution Order

Standards are resolved in this order:

1. Current or nearest `AGENTS.md`.
2. `sdkwork.app.config.json` when present.
3. Nearest module `specs/README.md` and `specs/component.spec.json` when the task touches an authored module.
4. Repository/application root `specs/` when the task is repository-wide or application-wide.
5. Local `.sdkwork/README.md`, `.sdkwork/skills/`, and `.sdkwork/plugins/` when relevant.
6. Global `sdkwork-specs/README.md` through the declared relative path.
7. Task-specific global specs referenced by the task matrix, nearest `AGENTS.md`, or module `canonicalSpecs`.
8. Implementation files.

Local files may narrow the task, but global `sdkwork-specs` remain authoritative.

Loading is dynamic and progressive. Agents MUST load the nearest `AGENTS.md` and dictionary entries first, then only the root specs required by the current task. Agents MUST NOT eagerly load all language, runtime, UI, deployment, or SDK specs for unrelated work. Language-specific specs are on-demand and loaded only when the touched files require them.

## Required Specs By Task Type

Code changes require `../sdkwork-specs/CODE_STYLE_SPEC.md`, `../sdkwork-specs/NAMING_SPEC.md`, and only the language/framework spec for the touched files.

| Task | Required specs |
| --- | --- |
| Agent/workflow rules | `SOUL.md`, `AGENTS_SPEC.md`, `SDKWORK_WORKSPACE_SPEC.md` |
| Any code change | `CODE_STYLE_SPEC.md`, `NAMING_SPEC.md`, plus only the touched language/framework spec |
| Build scripts / dev runners | `CODE_STYLE_SPEC.md` §7, `TYPESCRIPT_CODE_SPEC.md` §5, `PNPM_SCRIPT_SPEC.md` §11 |
| Rust code | `RUST_CODE_SPEC.md` (loaded on demand) |
| TypeScript/Node code | `TYPESCRIPT_CODE_SPEC.md` (loaded on demand) |
| Frontend/UI code | `FRONTEND_CODE_SPEC.md`, `FRONTEND_SPEC.md`, `UI_ARCHITECTURE_SPEC.md` (loaded on demand) |
| API changes | `API_SPEC.md`, `WEB_FRAMEWORK_SPEC.md`, `WEB_BACKEND_SPEC.md`, `SDK_SPEC.md`, `TEST_SPEC.md` |
| Rust HTTP route crates / API servers | `API_SPEC.md`, `SUBJECT_ID_SPEC.md`, `WEB_FRAMEWORK_SPEC.md`, `WEB_BACKEND_SPEC.md`, `RUST_CODE_SPEC.md`, `SECURITY_SPEC.md`, `TEST_SPEC.md` |
| Database changes | `DATABASE_SPEC.md`, `DATABASE_FRAMEWORK_SPEC.md`, `SUBJECT_ID_SPEC.md`, `PRIVACY_SPEC.md`, `TEST_SPEC.md` |
| SDK generation/consumption | `SDK_SPEC.md`, `SDK_WORKSPACE_GENERATION_SPEC.md`, `API_SPEC.md`, `TEST_SPEC.md` |
| App identity/release | `APP_MANIFEST_SPEC.md`, `CONFIG_SPEC.md`, `DEPLOYMENT_SPEC.md` |
| Source config/runtime environment | `SOURCE_CONFIG_SPEC.md`, `CONFIG_SPEC.md`, `ENVIRONMENT_SPEC.md`, `RUNTIME_DIRECTORY_SPEC.md`, `DEPLOYMENT_SPEC.md`, `TEST_SPEC.md` |
| Security/auth | `IAM_SPEC.md`, `SUBJECT_ID_SPEC.md`, `SECURITY_SPEC.md`, `PRIVACY_SPEC.md` |
| Packaging / GitHub workflows | `GITHUB_WORKFLOW_SPEC.md`, `PNPM_SCRIPT_SPEC.md`, `DEPLOYMENT_SPEC.md` |

Language specs are on-demand. Do not require agents to load Rust, TypeScript, and frontend specs for unrelated tasks.

## Int64 Wire Contract (API_SPEC §13.6)

- OpenAPI `int64` fields and parameters `MUST` be `type: string`, `format: int64`,
  a decimal `pattern` such as `^-?[0-9]+$`, and `x-sdkwork-int64-string: true`.
  `type: integer, format: int64` is a contract violation: generated TypeScript
  SDKs then emit `number`, and browsers silently round ids past
  `Number.MAX_SAFE_INTEGER` (2^53), replaying wrong ids into lookups.
- Rust response DTOs `MUST` serialize `i64` wire fields with
  `#[serde(with = "sdkwork_utils_rust::serde_int64")]` (or `::option`); request
  boundaries parse inbound strings with the same helper.
- Generated TypeScript SDKs keep `int64` as `string`; frontend code `MUST NOT`
  convert ids/snowflake ids/sequence ids to `number` for storage, comparison,
  or submission.
- Verification: `node <sdkwork-specs>/tools/check-api-operation-patterns.mjs --workspace .`

## Code Style Rules

Follow `../sdkwork-specs/CODE_STYLE_SPEC.md` and `../sdkwork-specs/NAMING_SPEC.md`:

- Rust crates use `sdkwork_membership_*` naming (no `sdkwork_commerce_*` aliases).
- SQL repositories emit canonical `SdkWorkApiResponse` / `application/problem+json` envelopes through `sdkwork-web-framework` response mapping.
- Use `sdkwork-utils-rust` helpers (`string`, `datetime`, `validation`, `currency`, `number`) instead of hand-rolled utilities to reduce duplicate code.
- No legacy envelopes (`PlusApiResult`, `AppbaseApiResult`, `StoreApiResult`, `SdkWorkResponse`, per-domain `*ApiResult`) or `requestId` wire fields.

## Build, Test, and Verification

Repository root scripts follow `../sdkwork-specs/PNPM_SCRIPT_SPEC.md`. Standard commands:

```bash
pnpm install
pnpm dev              # Start PC dev server
pnpm build           # Build PC app
pnpm start           # Run standalone gateway binary
pnpm test            # Run node + vitest + cargo tests
pnpm check           # Run app-composition, db, gateway, typecheck checks
pnpm verify          # typecheck + vitest + cargo test + app-composition
pnpm typecheck       # TypeScript typecheck
pnpm format          # cargo fmt --all
pnpm format:rust:check  # cargo fmt --all -- --check
pnpm clean           # Remove reproducible local artifacts
```

Database lifecycle commands (`db:validate`, `db:plan`, `db:init`, `db:migrate`, `db:seed`, `db:status`, `db:drift:check`, `db:bootstrap`) delegate to `sdkwork-database-cli` per `DATABASE_FRAMEWORK_SPEC.md`.

Record commands and outputs. Run `pnpm verify` and `cargo test --workspace` before completing work.

## Agent Execution Rules

- Load `AGENTS.md` and `sdkwork.app.config.json` first, then only the task-specific specs from `../sdkwork-specs/`.
- Stop and report when relative `sdkwork-specs` paths do not resolve.
- Do not fork `sdkwork-web-framework` interceptor chains or request-context framework locally.
- Do not introduce legacy envelopes or `requestId` wire fields.
- Use `sdkwork-utils-rust` helpers instead of duplicating utility code.
- Run the relevant verification scripts before completing work:
  - `node ../sdkwork-specs/tools/check-api-response-envelope.mjs`
  - `node ../sdkwork-specs/tools/verify-repo.mjs --root .`
  - `node ../sdkwork-specs/tools/check-database-framework-standard.mjs --root .`
  - `node ../sdkwork-specs/tools/check-agent-workflow-standard.mjs --root .`
  - `node ../sdkwork-specs/tools/check-pnpm-script-standard.mjs --root .`

## Task-Specific Standards

- App SDK consumer work loads `APP_SDK_INTEGRATION_SPEC.md`, `SDK_SPEC.md`, and
  `SDK_WORKSPACE_GENERATION_SPEC.md`, then runs
  `node ../sdkwork-specs/tools/check-app-sdk-consumer-imports.mjs --workspace .`.
- API contract, route, response, or SDK generation work loads `API_SPEC.md`, `WEB_FRAMEWORK_SPEC.md`,
  `WEB_BACKEND_SPEC.md`, `SDK_SPEC.md`, and `TEST_SPEC.md`, then runs
  `check-api-operation-patterns.mjs` and `check-api-response-envelope.mjs` against this workspace.
- List/search work additionally loads `PAGINATION_SPEC.md` and runs
  `node ../sdkwork-specs/tools/check-pagination.mjs --workspace .`.
## Human Review Rules

Follow `../sdkwork-specs/GITHUB_WORKFLOW_SPEC.md` for packaging and release workflow changes:

- Require human review before merging API contract, database migration, SDK generation, or deployment manifest changes.
- Require human review before introducing new framework dependencies or altering the standard interceptor chain.
- Do not commit secrets, live tokens, or app-local credential handling. Protected API and SDK access must use the generated SDK or approved service boundary.
- Run `pnpm verify` and all relevant check scripts before requesting review.
- Document breaking changes in `docs/architecture/decisions/` ADRs and update `docs/product/prd/PRD.md` and `docs/architecture/tech/TECH_ARCHITECTURE.md` accordingly.

<!-- SDKWORK-NAMING-STANDARD: v1 -->
## Rust Naming And Dependency Declaration

Authority: `../sdkwork-specs/NAMING_SPEC.md` section 3.1 and section 3.2.

Two identifier planes exist in every Rust crate and they MUST NOT be mixed: the package plane
(Cargo, filesystem, lock file) uses kebab-case, and the crate plane (lib target, modules, source
imports) uses snake_case.

- `[package].name`, the crate directory, `[features]` keys, and `[[bin]].name` use kebab-case.
- `[lib].name`, module files, module directories, and Rust imports use snake_case.
- A crate whose `[package].name` contains a hyphen SHOULD declare `[lib].name` explicitly
  (default: package name with every `-` replaced by `_`). A shorter lib name is allowed only
  when declared explicitly and used consistently by every consumer.
- Cargo dependency keys, `[workspace.dependencies]` keys, and `Cargo.lock` entries use the
  dependency package name. Use `package = "..."` when an alias is required.
- Every external crate referenced by `src/` MUST be declared in that crate's `[dependencies]`.
  Test-only crates belong in `[dev-dependencies]`; `build.rs` crates belong in
  `[build-dependencies]`.
- Never delete a dependency line, and never demote one from `[dependencies]` to
  `[dev-dependencies]`, while `src/` still imports it. Verify manifest cleanups with the
  command below before committing them.
- Regenerate and commit `Cargo.lock` in the same change as any dependency table edit.

Verification:

```bash
node ../sdkwork-specs/tools/check-rust-crate-naming-standard.mjs --root .
```
<!-- /SDKWORK-NAMING-STANDARD: v1 -->

<!-- SDKWORK-RUST-CODE-STANDARD: v1 -->
## Rust Code Standard

Authority: `../sdkwork-specs/RUST_CODE_SPEC.md` (v2, industry-best baseline); package/crate
naming and dependency declaration are normative in `../sdkwork-specs/NAMING_SPEC.md` section 3.1
and 3.2.

- Crates are responsibility-shaped: service, repository-sqlx, routes, service-host, native-host,
  worker, assembly, gateway. No generic `core`/`common`/`backend`/`runtime` suffixes.
- Errors are typed enums (`thiserror`) implementing `std::error::Error` with a `source` chain.
  `anyhow` only at binary/CLI/test boundaries, never in lib `[dependencies]`.
- No `unsafe` without a `// SAFETY:` comment; crates default to `unsafe_code = "forbid"`.
  No `unwrap`/`expect`/`panic!`/`todo!`/`dbg!` in library code reachable from public API.
- No lock guard held across `.await`; every external await has a timeout; spawned tasks are
  awaited/detached with a documented owner; retries are bounded, jittered, and idempotent.
- Public API is minimal, documented, `#[must_use]` where applicable, and semver-clean. Leaking
  framework types (`sqlx::Row`, axum extractors) through public signatures is forbidden.
- Workspace root declares `[workspace.package]` (edition, rust-version) and `[workspace.lints]`
  (RUST_CODE_SPEC.md section 13 baseline); every member inherits both with
  `edition.workspace = true` and `[lints] workspace = true`.

Verification:

```bash
node ../sdkwork-specs/tools/check-rust-crate-naming-standard.mjs --root .
node ../sdkwork-specs/tools/check-rust-manifest-standard.mjs --root .
# when service/repository/route/gateway dependencies change:
node ../sdkwork-specs/tools/check-rust-backend-composition.mjs --root .
```
<!-- /SDKWORK-RUST-CODE-STANDARD: v1 -->

<!-- SDKWORK-TYPESCRIPT-CODE-STANDARD: v1 -->
## TypeScript Code Standard

Authority: `../sdkwork-specs/TYPESCRIPT_CODE_SPEC.md` (v2, industry-best baseline).

- `tsconfig` runs `strict: true` and the strict family; public APIs are typed and `any`-free.
  `import type` is required for type-only imports (`verbatimModuleSyntax`).
- Errors are typed at package/service boundaries; no empty catches, no swallowed promise
  rejections, no bare `throw new Error('...')` for business failures.
- Async: every promise is settled; external awaits have timeouts; `AbortSignal` accepted for
  cancellable work; bounded concurrency; no unbounded `Promise.all`.
- Public API is minimal, JSDoc-documented, `@deprecated` where applicable, and semver-clean.
- Discriminated unions model closed variant sets; no `as`/`@ts-ignore` bypasses without a guard.
- Node/build runners verify build-critical sources and self-heal from git (CODE_STYLE_SPEC §7);
  `pnpm clean` never deletes git-tracked build-critical files.

Verification:

```bash
pnpm typecheck && pnpm test && pnpm lint
node ../sdkwork-specs/tools/check-application-layering.mjs --root .
```
<!-- /SDKWORK-TYPESCRIPT-CODE-STANDARD: v1 -->

<!-- SDKWORK-FRONTEND-CODE-STANDARD: v1 -->
## Frontend Code Standard

Authority: `../sdkwork-specs/FRONTEND_CODE_SPEC.md` (v2); language rules follow
`../sdkwork-specs/TYPESCRIPT_CODE_SPEC.md` (React/TS) or `../sdkwork-specs/DART_CODE_SPEC.md` (Flutter).

- UI -> service -> injected SDK flow is preserved; components never construct SDK clients or
  assemble raw HTTP/auth headers.
- React: hooks rules clean (`react-hooks`), `useEffect` with full deps and cleanup, stable
  list keys, error boundaries at route/page level, derived state during render (not in effects).
- State: server state behind services/query layer; client state local or minimal typed store;
  no duplication of server state in client stores.
- Accessibility: accessible names, keyboard behavior, visible focus, color is never the only
  signal; error states announced.
- i18n for all user-facing copy in reusable/user-facing packages (I18N_SPEC §6.1).
- PC/H5 `outDir` uses `dist/{standalone,cloud}/{dev,test,staging,prod}`.

Verification:

```bash
pnpm typecheck && pnpm test && pnpm lint
node ../sdkwork-specs/tools/check-application-layering.mjs --root .
node ../sdkwork-specs/tools/check-browser-dist-layout.mjs --root .   # PC/H5 apps
```
<!-- /SDKWORK-FRONTEND-CODE-STANDARD: v1 -->

<!-- SDKWORK-PNPM-WORKSPACE-STANDARD: v1 -->
## pnpm Workspace Dependency And Package Import

Authority: `../sdkwork-specs/PNPM_WORKSPACE_DEPENDENCY_SPEC.md` (companion to
`../sdkwork-specs/DEPENDENCY_MANAGEMENT_SPEC.md`).

Sibling SDKWork repositories are consumed through a dual-track model that MUST stay consistent:

- **Local development** (`pnpm dev`, `pnpm build`): pnpm workspace protocol. Each sibling
  package is declared ONCE in this repository root `pnpm-workspace.yaml` `packages:` as a
  `../sdkwork-*` relative path, and consumed with `workspace:*` in `package.json`. Never use
  `file:`/`link:`/git-URL specifiers for SDKWork sibling packages in any environment.
- **CI / release packaging**: git-repository dependency checkout. Every sibling referenced by the
  local workspace MUST have a matching `dependencies[]` entry in `sdkwork.workflow.json` so CI
  clones the sibling into the same `../sdkwork-*` relative layout (`GITHUB_WORKFLOW_SPEC.md`).
  `package.json` is never rewritten for CI.

Import rules for sibling SDKWork packages:

- Import by package name only: `import { X } from "@sdkwork/package-name"`. The specifier MUST
  equal the target package's `package.json` `name` exactly - no shortening, renaming, or alias.
- Forbidden: relative imports that cross a package boundary into another SDKWork repository or
  another workspace package's `src/` (for example `import ... from "../../sdkwork-appbase/.../src/..."`).
- Consume only the public `exports` surface of a package; never deep-import sibling `src/` internals.
- Every non-relative import in a workspace member MUST resolve to that member's own
  `dependencies`/`devDependencies`/`peerDependencies` (import closure).
- Vite aliases MUST NOT rename or redirect `@sdkwork/*` packages, MUST NOT be added to make a
  resolution error pass, and are allowed only for documented bootstrap/SDK-generation entrypoints.
- Fix a resolution failure by correcting the workspace declaration or the package `exports`,
  not by adding an alias.

Verification:

```bash
node ../sdkwork-specs/tools/verify-repo.mjs --root .
node ../sdkwork-specs/tools/check-workspace-member-protocol.mjs --root .
node ../sdkwork-specs/tools/check-dependency-list-completeness.mjs --target <repo-name>
```
<!-- /SDKWORK-PNPM-WORKSPACE-STANDARD: v1 -->

<!-- SDKWORK-SDK-GENERATION-STANDARD: v1 -->
## Generated SDK Output Is Generator-Owned

Authority: `../sdkwork-specs/SDK_SPEC.md` and `../sdkwork-specs/SDK_WORKSPACE_GENERATION_SPEC.md`.

Everything generated under `sdks/` — `generated/server-openapi/` trees, generated language
workspaces, `dist/` build output, generated `sdkwork-sdk.json`, generated
`.sdkwork/sdkwork-generator-*` reports, and standardizer-synced OpenAPI snapshots — is produced by
the canonical SDK generator `../sdkwork-sdk-generator/bin/sdkgen.js` (`@sdkwork/sdk-generator`).

- Do not hand-edit generated SDK files, including type definitions, dist bundles, and generated
  package metadata. Manual edits are overwritten by the next generation run and break
  reproducibility and contract audits.
- When generated or compiled SDK output does not meet a contract or standard, fix the upstream
  source — authored API contract, route manifest, OpenAPI authority, derived `*.sdkgen.*` input,
  generator profile, or `custom/` runtime build scripts — then regenerate through the standard
  generation command. Do not patch generated output in place.
- Remove stale generated files by re-running the family generation command, which owns cleanup of
  disappeared routes and models; do not hand-prune generated trees.
- The only approved handwritten surfaces are `custom/` roots inside generated workspaces and
  authored `composed/` facades outside `generated/server-openapi`.

Verification:

```bash
node ../sdkwork-specs/tools/sync-agent-sdk-generation-standard.mjs --root . --check
```
<!-- /SDKWORK-SDK-GENERATION-STANDARD: v1 -->
