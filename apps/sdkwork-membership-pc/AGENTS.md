# Application Guidelines

## SDKWORK Soul

Read `../../../sdkwork-specs/SOUL.md` before executing tasks in this application root. Follow specs before memory, dictionary before context, stop on ambiguity, and evidence before completion.

## SDKWORK Standards

Canonical SDKWORK specs path from this application root:

- `../../../sdkwork-specs/README.md`
- `../../../sdkwork-specs/SOUL.md`
- `../../../sdkwork-specs/AGENTS_SPEC.md`
- `../../../sdkwork-specs/PNPM_SCRIPT_SPEC.md`
- `../../../sdkwork-specs/GITHUB_WORKFLOW_SPEC.md`
- `../../../sdkwork-specs/CODE_STYLE_SPEC.md`
- `../../../sdkwork-specs/NAMING_SPEC.md`

Do not copy root standard text into this application. If these relative paths do not resolve, stop and report the broken workspace layout.

## Application Identity

Read `sdkwork.app.config.json` only when changing PC application behavior, runtime config, SDK wiring, release metadata, packaging, or app-owned capabilities.

- App key: `sdkwork-membership-pc`
- App type: `APP_REACT`
- Domain: `commerce`
- Capability: `membership`
- Runtime: `web` / `react`
- Delivery modes: `WEB_URL`
- Supported deployment profiles: `standalone`, `cloud`
- Default deployment profile: `standalone`

This is the PC web application for the SDKWork Membership capability. It consumes the membership `app-api` and renders membership tiers, entitlements, and upgrade flows.

## Local Dictionary Structure

- `AGENTS.md`: agent execution rules for this PC application root.
- `sdkwork.app.config.json`: PC application identity, metadata, and runtime config.
- `packages/`: React packages for membership UI surfaces (`sdkwork-membership-pc-membership`, `sdkwork-membership-pc-common`).
- `specs/`: application-level spec systems when present.
- `docs/`: application-local documentation when present.

## Spec Resolution Order

Standards are resolved in this order:

1. Current or nearest `AGENTS.md` (this file).
2. `sdkwork.app.config.json` when present.
3. Nearest module `specs/README.md` and `specs/component.spec.json` when the task touches an authored package.
4. Repository root `AGENTS.md` at `../../AGENTS.md` for repository-wide rules.
5. Global `sdkwork-specs/README.md` through the declared relative path.
6. Task-specific global specs referenced by the task matrix, nearest `AGENTS.md`, or module `canonicalSpecs`.
7. Implementation files.

Local files may narrow the task, but global `sdkwork-specs` remain authoritative.

Loading is dynamic and progressive. Agents MUST load the nearest `AGENTS.md` and dictionary entries first, then only the root specs required by the current task. Agents MUST NOT eagerly load all language, runtime, UI, deployment, or SDK specs for unrelated work. Language-specific specs are on-demand and loaded only when the touched files require them.

## Required Specs By Task Type

Code changes require `../../../sdkwork-specs/CODE_STYLE_SPEC.md`, `../../../sdkwork-specs/NAMING_SPEC.md`, and only the language/framework spec for the touched files.

| Task | Required specs |
| --- | --- |
| Agent/workflow rules | `SOUL.md`, `AGENTS_SPEC.md`, `SDKWORK_WORKSPACE_SPEC.md` |
| Any code change | `CODE_STYLE_SPEC.md`, `NAMING_SPEC.md`, plus only the touched language/framework spec |
| TypeScript/React code | `TYPESCRIPT_CODE_SPEC.md` (loaded on demand) |
| Frontend/UI code | `FRONTEND_CODE_SPEC.md`, `FRONTEND_SPEC.md`, `UI_ARCHITECTURE_SPEC.md`, `APP_PC_REACT_UI_SPEC.md` (loaded on demand) |
| API integration | `API_SPEC.md`, `SDK_SPEC.md`, `FRONTEND_SPEC.md` |
| App identity/release | `APP_MANIFEST_SPEC.md`, `CONFIG_SPEC.md`, `DEPLOYMENT_SPEC.md` |
| Packaging / GitHub workflows | `GITHUB_WORKFLOW_SPEC.md`, `PNPM_SCRIPT_SPEC.md`, `DEPLOYMENT_SPEC.md` |

Language specs are on-demand. Do not require agents to load TypeScript and frontend specs for unrelated tasks.

## Code Style Rules

Follow `../../../sdkwork-specs/CODE_STYLE_SPEC.md` and `../../../sdkwork-specs/NAMING_SPEC.md`:

- React packages use `@sdkwork/membership-pc-*` naming.
- Consume membership `app-api` through generated SDK clients, not hand-rolled fetch calls.
- Do not introduce legacy API envelopes or `requestId` wire fields in frontend code.
- Use `sdkwork-utils` TypeScript helpers when available to reduce duplicate code.

## Build, Test, and Verification

Application scripts follow `../../../sdkwork-specs/PNPM_SCRIPT_SPEC.md`. Standard commands run from repository root:

```bash
pnpm --filter @sdkwork/membership-pc-membership typecheck
pnpm dev
pnpm build
```

Record commands and outputs. Run `pnpm verify` from the repository root before completing work.

## Agent Execution Rules

- Load this `AGENTS.md` and `sdkwork.app.config.json` first, then only the task-specific specs from `../../../sdkwork-specs/`.
- Stop and report when relative `sdkwork-specs` paths do not resolve.
- Consume the membership `app-api` through generated SDK clients; do not hand-roll API calls.
- Do not introduce legacy envelopes or `requestId` wire fields in frontend code.
- Run the relevant verification scripts before completing work:
  - `node ../../../sdkwork-specs/tools/check-api-response-envelope.mjs`
  - `node ../../../sdkwork-specs/tools/check-agent-workflow-standard.mjs --root ../../..`

## Task-Specific Standards

- App SDK consumer work loads `APP_SDK_INTEGRATION_SPEC.md`, `SDK_SPEC.md`, and
  `SDK_WORKSPACE_GENERATION_SPEC.md`, then runs
  `node ../../../sdkwork-specs/tools/check-app-sdk-consumer-imports.mjs --workspace ../..`.
- API response or frontend SDK integration work loads `API_SPEC.md`, `SDK_SPEC.md`,
  `FRONTEND_SPEC.md`, and `TEST_SPEC.md`, then runs the repository API operation and response gates.
- List/search UI or service work additionally loads `PAGINATION_SPEC.md` and runs
  `node ../../../sdkwork-specs/tools/check-pagination.mjs --workspace ../..`.
## HTTP API Response Envelope

All L2+ SDKWork-owned custom HTTP contracts, including `app-api`, `backend-api`, and SDKWork-owned business `open-api`, `MUST` follow `API_SPEC.md` section 4.5, section 14, and section 15:

- **Default classification:** omitted `x-sdkwork-wire-protocol` means SDKWork-owned custom API (`sdkwork-v3`); only operation-level `x-sdkwork-wire-protocol: external` plus `x-sdkwork-external-protocol-id` identifies a third-party compatibility `open-api` operation.
- **Input:** typed request bodies, section 14.1 list/search/command input, `SdkWorkListQuery`, and `q` for free-text search.
- **Success output:** `SdkWorkApiResponse` with `{ "code": 0, "data": <payload>, "traceId": "<server-uuid>" }`.
- **Error output:** HTTP 4xx/5xx `application/problem+json` (`ProblemDetail`) with numeric `code` and `traceId`; SDKWork-owned errors may include `i18nKey` and `locale` presentation metadata.
- Success `code` is numeric `int32`; HTTP 2xx JSON bodies `MUST` use `0` only. REST semantics remain on HTTP status (`201`, `202`, etc.).
- Platform error codes are numeric non-zero values per section 15.3 (`40001`, `40101`, `40401`, …).
- Single resource: `data.item`
- Lists: `data.items` + `data.pageInfo` (`PageInfo.mode` is `offset` or `cursor`)
- Commands: `data.accepted` plus optional `resourceId` / `status`
- Async accept (`202`): `data.operationId`, `data.status`, optional `pollUrl`
- Operation patterns: retrieve/list/search/create/update/delete/command/async/bulk semantics follow `API_SPEC.md` section 15.4; create uses `201`, delete uses `204` with no JSON body, and `PUT`/`PATCH` use SDK action `update`.

Vendor compatibility `open-api` routes that mirror upstream tool or provider wire (for example OpenAI `/v1/*`, Anthropic/Claude `/anthropic/v1/*`, Google/Gemini `/google/v1beta/*`, Claude Code, or Codex) `MAY` opt out only when every exempt operation declares operation-level `x-sdkwork-wire-protocol: external` and `x-sdkwork-external-protocol-id` per `API_SPEC.md` section 4.5.2. SDKWork-owned business `open-api` operations `MUST NOT` opt out. Mixed OpenAPI documents are validated per operation; one external operation never exempts SDKWork-owned operations in the same document.

Errors `MUST` use HTTP 4xx/5xx with `application/problem+json` (`ProblemDetail`) including required numeric `code` and `traceId`. Optional `i18nKey` and `locale` are display metadata only. Business failures `MUST NOT` use HTTP 2xx with non-zero `code`, string wire codes, `success`, or human `message`.

Forbidden legacy envelopes and fields: `PlusApiResult`, `AppbaseApiResult`, `StoreApiResult`, `SdkWorkResponse`, per-domain `*ApiResult`, wire field `requestId`, bare domain DTOs at the HTTP root, and top-level `{ items, pageInfo, traceId }` without `data`.

Handlers `MUST` serialize success and map errors through `sdkwork-web-framework` response mapping. Generated HTTP SDKs (`--standard-profile sdkwork-v3`) unwrap `data` by default and expose typed numeric `ProblemDetail.code` / `traceId` and returned localization metadata on errors; use `.raw` when the full envelope is required.

Before completing API contract, SDK generation, or frontend service work, run:

```bash
node <sdkwork-specs>/tools/check-api-operation-patterns.mjs --workspace <workspace-root>
node <sdkwork-specs>/tools/check-api-response-envelope.mjs --workspace <workspace-root>
```

Authority: `sdkwork-specs/API_SPEC.md` section 4.5 and sections 14–16, `SDK_SPEC.md` section 4.2, `FRONTEND_SPEC.md`, `MIGRATION_SPEC.md` section 4.2.

## Human Review Rules

Follow `../../../sdkwork-specs/GITHUB_WORKFLOW_SPEC.md` for packaging and release workflow changes:

- Require human review before merging API contract changes that affect frontend consumption.
- Require human review before introducing new SDK dependencies or altering the app runtime config.
- Do not commit secrets, live tokens, or app-local credential handling.
- Run `pnpm verify` from the repository root before requesting review.
- Update `docs/product/prd/PRD.md` and `docs/architecture/tech/TECH_ARCHITECTURE.md` at the repository root when application behavior changes.
