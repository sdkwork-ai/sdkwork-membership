import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");

function readRelative(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8").replace(/\r\n/g, "\n");
}

function readJson(relativePath) {
  return JSON.parse(readRelative(relativePath));
}

function listAppPackageRoots() {
  const appRoots = [
    "apps/sdkwork-membership-common/packages",
    "apps/sdkwork-membership-pc/packages",
  ];
  return appRoots.flatMap((appRoot) => {
    const absoluteAppRoot = path.join(root, appRoot);
    return readdirSync(absoluteAppRoot)
      .map((entry) => path.join(appRoot, entry).replace(/\\/g, "/"))
      .filter((relativePath) => {
        const absolutePath = path.join(root, relativePath);
        return statSync(absolutePath).isDirectory()
          && existsSync(path.join(absolutePath, "package.json"));
      });
  });
}

function listRelativeFilesByName(relativeDirectory, fileName) {
  const results = [];
  const ignoredDirectories = new Set(["dist", "node_modules", "target"]);

  function visit(relativePath) {
    const absolutePath = path.join(root, relativePath);
    for (const entry of readdirSync(absolutePath)) {
      if (ignoredDirectories.has(entry)) {
        continue;
      }
      const childRelativePath = path.join(relativePath, entry).replace(/\\/g, "/");
      const childAbsolutePath = path.join(root, childRelativePath);
      const stat = statSync(childAbsolutePath);
      if (stat.isDirectory()) {
        visit(childRelativePath);
      } else if (entry === fileName) {
        results.push(childRelativePath);
      }
    }
  }

  visit(relativeDirectory);
  return results;
}

test("membership PC bootstrap does not expose auth tokens through browser env", () => {
  const shellSource = readRelative("apps/sdkwork-membership-pc/packages/sdkwork-membership-pc-shell/src/index.tsx");
  const viteConfig = readRelative("apps/sdkwork-membership-pc/vite.config.ts");
  const envExample = readRelative("apps/sdkwork-membership-pc/.env.example");

  for (const [label, source] of [
    ["membership PC shell", shellSource],
    ["membership PC vite config", viteConfig],
    ["membership PC env example", envExample],
  ]) {
    assert.equal(
      source.includes("VITE_SDKWORK_AUTH_TOKEN"),
      false,
      `${label} must not expose auth tokens through VITE_* browser env`,
    );
    assert.equal(
      source.includes("VITE_SDKWORK_ACCESS_TOKEN"),
      false,
      `${label} must not expose access tokens through VITE_* browser env`,
    );
  }

  assert.equal(
    viteConfig.includes("process.env.SDKWORK_ACCESS_TOKEN"),
    false,
    "vite config must not inline private SDKWORK_ACCESS_TOKEN into browser bundles",
  );
});

test("membership anonymous catalog SDK operations suppress stored credentials", () => {
  const sdkgen = readJson("sdks/sdkwork-membership-app-sdk/openapi/sdkwork-membership-app-api.sdkgen.json");
  const generatedMembershipsApi = readRelative(
    "sdks/sdkwork-membership-app-sdk/sdkwork-membership-app-sdk-typescript/generated/server-openapi/src/api/memberships.ts",
  );
  const anonymousCatalogPaths = [
    "/app/v3/api/memberships/plans",
    "/app/v3/api/memberships/benefits",
    "/app/v3/api/memberships/packages",
  ];

  for (const operationPath of anonymousCatalogPaths) {
    const operation = sdkgen.paths[operationPath]?.get;
    assert.ok(operation, `${operationPath} must remain in the membership app SDK input`);
    assert.deepEqual(operation.security, [], `${operation.operationId} must declare security: []`);
    assert.equal(
      operation["x-sdkwork-auth-mode"],
      "anonymous",
      `${operation.operationId} must retain the anonymous credential profile`,
    );

    const relativePath = operationPath.replace("/app/v3/api", "");
    const escapedPath = relativePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(
      generatedMembershipsApi,
      new RegExp("appApiPath\\(`" + escapedPath + "`\\)[\\s\\S]{0,320}skipAuth: true"),
      `${operation.operationId} must suppress TokenManager credentials in generated transport`,
    );
  }
});

test("membership PC SDK inventory marks generated app SDK as available", () => {
  const inventorySource = readRelative("apps/sdkwork-membership-pc/packages/sdkwork-membership-pc-core/src/composition/sdk-inventory.ts");
  const sdkDescriptorSource = readRelative("apps/sdkwork-membership-pc/packages/sdkwork-membership-pc-core/src/sdk/index.ts");

  assert.equal(
    inventorySource.includes("status: \"pending-generation\""),
    false,
    "membership app SDK is generated and must not be documented as pending generation",
  );
  assert.equal(
    sdkDescriptorSource.includes("until then"),
    false,
    "SDK descriptor docs must not retain historical pending-generation wording",
  );
});

test("membership authored app packages declare component specs", () => {
  const missing = [];
  for (const packageRoot of listAppPackageRoots()) {
    for (const specPath of ["specs/component.spec.json", "specs/README.md"]) {
      if (!existsSync(path.join(root, packageRoot, specPath))) {
        missing.push(`${packageRoot}/${specPath}`);
      }
    }
  }
  assert.deepEqual(missing, []);
});

test("membership docs require host-injected order checkout without membership order dependencies", () => {
  const agentSource = readRelative("AGENTS.md");
  const prdSource = readRelative("docs/product/prd/PRD.md");
  const techSource = readRelative("docs/architecture/tech/TECH_ARCHITECTURE.md");
  const boundarySpec = readRelative("specs/COMMERCE_ORDER_BOUNDARY_SPEC.md");
  const boundaryContract = readJson("specs/commerce-order-membership-boundary.spec.json");
  const subscriptionReadme = readRelative("apps/sdkwork-membership-pc/packages/sdkwork-membership-pc-subscription/README.md");

  for (const [label, source] of [
    ["repository AGENTS", agentSource],
    ["commerce order boundary spec", boundarySpec],
    ["subscription README", subscriptionReadme],
  ]) {
    assert.equal(
      source.includes("Payment execution uses `@sdkwork/payment-app-sdk`"),
      false,
      `${label} must not claim membership checkout executes payment through payment-app-sdk`,
    );
    assert.equal(
      source.includes("payment→membership callback path")
        || source.includes("payment -> membership callback path"),
      false,
      `${label} must not document a payment-to-membership callback path`,
    );
    assert.equal(
      source.includes("host-injected"),
      true,
      `${label} must document host-injected checkout composition`,
    );
    assert.equal(
      source.includes("@sdkwork/order-app-sdk"),
      false,
      `${label} must not document a membership-to-order SDK dependency`,
    );
  }

  assert.equal(
    boundaryContract.allowedDependencyDirection.some(
      (direction) =>
        direction.includes("payment-app-sdk")
        && !direction.includes("cashier")
        && !direction.includes("not payment execution"),
    ),
    false,
    "machine boundary contract must not list payment-app-sdk as the membership payment execution dependency",
  );
  assert.equal(
    prdSource.includes("Final production token-plan catalog ownership must be finalized"),
    false,
    "PRD must not leave token-plan/order ownership as an open historical question",
  );
  const prdOpenQuestions = prdSource.split("## 9. Open Questions")[1] ?? "";
  assert.equal(
    prdOpenQuestions.includes("Token-plan catalog and token-plan order creation"),
    false,
    "PRD Open Questions must not contain resolved token-plan/order ownership decisions",
  );
  assert.equal(
    prdSource.includes("Token-plan and membership-package purchase ordering is in scope for `sdkwork-order` unified order management."),
    true,
    "PRD must document resolved order-owned purchase responsibility in a normative section",
  );
  assert.equal(
    techSource.includes("`sdkwork-order` is the backend capability that depends on membership through the fulfillment port; membership does not depend on order packages, SDKs, services, UI, Rust crates, or order/payment database lifecycle assets."),
    true,
    "technical architecture must document the corrected order-to-membership dependency direction",
  );
});

test("commerce boundary machine contract does not allow payment to depend on order tables", () => {
  const boundaryContract = readJson("specs/commerce-order-membership-boundary.spec.json");

  assert.equal(
    boundaryContract.allowedDependencyDirection.some((direction) => direction.startsWith("payment ->")),
    false,
    "payment must not be listed as depending on order or membership in allowed dependency directions",
  );
  assert.equal(
    boundaryContract.allowedDependencyDirection.some((direction) => direction.includes("commerce_order")),
    false,
    "machine boundary contract must not allow payment-to-commerce_order dependency entries",
  );
});

test("membership PC shell lazy-loads feature route packages", () => {
  const shellSource = readRelative("apps/sdkwork-membership-pc/packages/sdkwork-membership-pc-shell/src/index.tsx");

  assert.equal(
    /import\s+\{[^}]*\}\s+from\s+["']@sdkwork\/membership-pc-membership["']/.test(shellSource),
    false,
    "membership shell must not statically import membership feature pages into the entry chunk",
  );
  assert.equal(
    /import\s+\{[^}]*\}\s+from\s+["']@sdkwork\/membership-pc-subscription["']/.test(shellSource),
    false,
    "membership shell must not statically import subscription feature pages into the entry chunk",
  );
  assert.equal(
    shellSource.includes("lazy(async () =>"),
    true,
    "membership shell must use React lazy route imports for feature packages",
  );
  assert.equal(
    shellSource.includes("import(\"@sdkwork/membership-pc-membership\")"),
    true,
    "membership shell must dynamically import the membership feature package",
  );
  assert.equal(
    shellSource.includes("import(\"@sdkwork/membership-pc-subscription\")"),
    true,
    "membership shell must dynamically import the subscription feature package",
  );
});

test("membership PC shell does not own order SDK bootstrap or configuration", () => {
  const shellSource = readRelative("apps/sdkwork-membership-pc/packages/sdkwork-membership-pc-shell/src/index.tsx");
  const shellComponent = readJson("apps/sdkwork-membership-pc/packages/sdkwork-membership-pc-shell/specs/component.spec.json");
  const envExample = readRelative("apps/sdkwork-membership-pc/.env.example");

  assert.equal(
    envExample.includes("VITE_SDKWORK_ORDER_APP_API_BASE_URL="),
    false,
    "membership PC env example must not declare an order app-api base URL",
  );
  assert.equal(
    shellSource.includes("VITE_SDKWORK_ORDER_APP_API_BASE_URL"),
    false,
    "membership PC shell must not read an order app-api base URL",
  );
  assert.equal(
    shellSource.includes("bootstrapSdkworkOrderAppService"),
    false,
    "membership PC shell must not bootstrap the order app SDK",
  );
  assert.deepEqual(
    shellComponent.contracts.runtimeEntrypoints,
    ["MembershipAppShell"],
    "membership PC shell runtime entrypoints must list only public integration entrypoints",
  );
  assert.equal(
    shellComponent.contracts.configKeys.includes("VITE_SDKWORK_ORDER_APP_API_BASE_URL"),
    false,
    "membership PC shell component config must not include an order base URL",
  );
});

test("membership PC runtime config does not use unregistered common SDK base URL fallback", () => {
  const shellSource = readRelative("apps/sdkwork-membership-pc/packages/sdkwork-membership-pc-shell/src/index.tsx");
  const viteConfig = readRelative("apps/sdkwork-membership-pc/vite.config.ts");
  const envExample = readRelative("apps/sdkwork-membership-pc/.env.example");
  const techSource = readRelative("docs/architecture/tech/TECH_ARCHITECTURE.md");
  const shellComponent = readJson("apps/sdkwork-membership-pc/packages/sdkwork-membership-pc-shell/specs/component.spec.json");
  const expectedConfigKeys = ["VITE_SDKWORK_MEMBERSHIP_PC_APP_API_BASE_URL"];
  const dependencySurfaces = shellComponent.contracts.dependencyApiSurfaces ?? [];

  for (const [label, source] of [
    ["membership PC shell", shellSource],
    ["membership PC vite config", viteConfig],
    ["membership PC env example", envExample],
  ]) {
    assert.equal(
      source.includes("VITE_SDKWORK_MEMBERSHIP_PC_SDK_BASE_URL"),
      false,
      `${label} must not read or advertise an unregistered common SDK base URL fallback`,
    );
  }

  assert.equal(
    techSource.includes("This repository does not declare `VITE_SDKWORK_MEMBERSHIP_PC_SDK_BASE_URL` or any other common SDK base URL fallback."),
    true,
    "technical architecture must explicitly reject the retired unregistered common SDK base URL fallback",
  );
  assert.deepEqual(
    shellComponent.contracts.configKeys,
    expectedConfigKeys,
    "membership PC shell config keys must only include the explicit app-api base URL keys",
  );
  assert.deepEqual(
    dependencySurfaces.map((surface) => ({
      workspace: surface.workspace,
      runtimeMode: surface.runtimeMode,
      sameOriginAllowed: surface.sameOriginAllowed,
    })),
    [
      {
        workspace: "sdkwork-membership-app-sdk",
        runtimeMode: "external-service",
        sameOriginAllowed: false,
      },
    ],
    "membership PC shell external-service dependency surfaces must explicitly disable same-origin inheritance",
  );
});

test("membership PC app manifest owns Vite SDK base URL env bindings", () => {
  const appManifest = readJson("apps/sdkwork-membership-pc/agent.app.config.json");
  const shellComponent = readJson("apps/sdkwork-membership-pc/packages/sdkwork-membership-pc-shell/specs/component.spec.json");
  const envExample = readRelative("apps/sdkwork-membership-pc/.env.example");
  const prdSource = readRelative("docs/product/prd/PRD.md");
  const techSource = readRelative("docs/architecture/tech/TECH_ARCHITECTURE.md");
  const envBindings = appManifest.envBindings;
  const expectedConfigKeys = ["VITE_SDKWORK_MEMBERSHIP_PC_APP_API_BASE_URL"];

  assert.ok(envBindings, "membership PC app manifest must declare envBindings");
  assert.equal(
    appManifest.backend?.appId,
    appManifest.app?.key,
    "manifest backend.appId must match app.key for sdkwork-dev-config tokenized env generation",
  );
  assert.equal(envBindings.schemaVersion, 2);
  assert.equal(envBindings.family, "web");
  assert.equal(envBindings.runtime, "vite-react");
  assert.equal(envBindings.preset, "vite-react-standard");
  assert.equal(envBindings.outputStrategy, "dotenv-overlay");
  assert.equal(envBindings.platform, "web");
  assert.equal(envBindings.ownerMode, "tenant");
  assert.equal(envBindings.grantMode, "current");
  assert.equal(envBindings.tokenPlatform, "WEB");

  const variableNames = new Set((envBindings.variables ?? []).map((variable) => variable.name));
  assert.deepEqual(
    expectedConfigKeys.filter((key) => !variableNames.has(key)),
    [],
    "manifest envBindings.variables must declare every PC SDK base URL key",
  );
  for (const key of expectedConfigKeys) {
    assert.equal(
      envExample.includes(`${key}=`),
      true,
      `${key} must stay visible in the tracked Vite env example`,
    );
  }

  assert.equal(
    envBindings.sdkBaseUrls?.appApiBaseUrlKey,
    "VITE_SDKWORK_MEMBERSHIP_PC_APP_API_BASE_URL",
    "manifest must bind the membership app SDK to the membership app-api base URL key",
  );
  assert.deepEqual(
    envBindings.sdkBaseUrls?.dependencySdkBaseUrlKeys,
    {},
    "membership manifest must not bind dependency SDK base URLs",
  );
  assert.deepEqual(
    shellComponent.contracts.configKeys,
    expectedConfigKeys,
    "shell component config keys must stay aligned with manifest env bindings",
  );
  assert.equal(
    JSON.stringify(envBindings).includes("VITE_SDKWORK_MEMBERSHIP_PC_SDK_BASE_URL"),
    false,
    "manifest must not reintroduce the retired common SDK base URL fallback",
  );
  assert.equal(
    prdSource.includes("`apps/sdkwork-membership-pc/agent.app.config.json` `envBindings` is the source of truth for the membership SDK base URL key."),
    true,
    "PRD must document manifest-owned Vite SDK base URL binding",
  );
  assert.equal(
    techSource.includes("`apps/sdkwork-membership-pc/agent.app.config.json` owns the schema-v2 `envBindings` contract for the membership Vite key."),
    true,
    "technical architecture must document manifest-owned envBindings",
  );
});

test("membership component external service surfaces explicitly disable same-origin inheritance", () => {
  const componentSpecPaths = [
    ...listRelativeFilesByName("specs", "component.spec.json"),
    ...listRelativeFilesByName("apps", "component.spec.json"),
    ...listRelativeFilesByName("crates", "component.spec.json"),
    ...listRelativeFilesByName("sdks", "component.spec.json"),
  ];
  const violations = [];

  for (const specPath of componentSpecPaths) {
    const spec = readJson(specPath);
    const dependencySurfaces = spec.contracts?.dependencyApiSurfaces ?? [];
    for (const surface of dependencySurfaces) {
      if (surface.runtimeMode !== "external-service") {
        continue;
      }
      if (surface.sameOriginAllowed !== false) {
        violations.push(`${specPath}:${surface.workspace}:sameOriginAllowed`);
      }
      if (typeof surface.requiredBaseUrlKey !== "string" || !surface.requiredBaseUrlKey.trim()) {
        violations.push(`${specPath}:${surface.workspace}:requiredBaseUrlKey`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

test("membership baseline does not create order-owned order tables", () => {
  const postgresBaseline = readRelative("database/ddl/baseline/postgres/0001_membership_baseline.sql");

  for (const table of [
    "commerce_order",
    "commerce_order_item",
    "commerce_order_amount_breakdown",
  ]) {
    assert.equal(
      postgresBaseline.includes(`CREATE TABLE IF NOT EXISTS ${table}`),
      false,
      `PostgreSQL baseline must not create order-owned ${table}`,
    );
  }
});

test("membership database initialization does not create payment-owned tables or seed payment catalog", () => {
  const postgresBaseline = readRelative("database/ddl/baseline/postgres/0001_membership_baseline.sql");
  const seedSource = readRelative("database/seeds/common/001_catalog.sql")
    + "\n" + readRelative("database/fixtures/002_dev_demo.sql");
  const postgresRepository = readRelative("crates/sdkwork-membership-repository-sqlx/src/postgres.rs");

  for (const table of [
    "commerce_payment_method",
    "commerce_payment_intent",
    "commerce_payment_attempt",
  ]) {
    assert.equal(
      postgresBaseline.includes(`CREATE TABLE IF NOT EXISTS ${table}`),
      false,
      `PostgreSQL baseline must not create payment-owned ${table}`,
    );
  }
  assert.equal(
    postgresBaseline.includes("source_payment_intent_id"),
    false,
    "PostgreSQL membership-owned tables must not retain payment intent linkage columns",
  );

  assert.equal(
    seedSource.includes("INSERT OR IGNORE INTO commerce_payment_method"),
    false,
    "membership seed must not initialize payment method catalog; payment/order lifecycle owns it",
  );
  assert.equal(
    seedSource.includes("source_payment_intent_id"),
    false,
    "membership seed must not initialize payment intent linkage columns",
  );

  assert.equal(
    postgresRepository.includes("commerce_payment_intent"),
    false,
    "PostgreSQL repository must not query payment-owned commerce_payment_intent",
  );
  assert.equal(
    postgresRepository.includes("source_payment_intent_id"),
    false,
    "PostgreSQL repository must not persist payment intent identifiers",
  );
});

test("membership database contract excludes order payment and token-order tables", () => {
  const schemaSource = readRelative("database/contract/schema.yaml");
  const tableRegistry = readJson("database/contract/table-registry.json");
  const tableNames = new Set(tableRegistry.tables.map((table) => table.name ?? table.table_name));

  for (const table of [
    "commerce_order",
    "commerce_order_item",
    "commerce_order_amount_breakdown",
    "commerce_payment_method",
    "commerce_payment_intent",
    "commerce_payment_attempt",
    "commerce_payment_provider",
    "commerce_payment_provider_account",
    "commerce_payment_channel",
    "commerce_payment_route_rule",
    "commerce_recharge_package",
    "commerce_exchange_rule",
  ]) {
    assert.equal(
      schemaSource.includes(`name: ${table}`),
      false,
      `membership schema contract must not register external ${table}`,
    );
    assert.equal(
      tableNames.has(table),
      false,
      `membership table registry must not register external ${table}`,
    );
  }
});

test("membership reservation API and facade do not own payment or cashier fields", () => {
  const api = readJson("apis/app-api/membership/membership-app-api.openapi.json");
  const sdkgen = readJson("sdks/sdkwork-membership-app-sdk/openapi/sdkwork-membership-app-api.sdkgen.json");
  const facadeSource = readRelative("sdks/sdkwork-membership-app-sdk/sdkwork-membership-app-sdk-typescript/src/index.ts");
  const membershipServiceSource = readRelative("apps/sdkwork-membership-pc/packages/sdkwork-membership-pc-membership/src/membership-service.ts");

  for (const [label, document] of [
    ["app-api authority", api],
    ["app SDK sdkgen input", sdkgen],
  ]) {
    const commandProperties = document.components.schemas.CommerceOperationCommand.properties;
    const outcomeSchema = document.components.schemas.AppMembershipPurchaseOutcome;
    const outcomeProperties = outcomeSchema.properties;
    const outcomeRequired = new Set(outcomeSchema.required ?? []);

    assert.equal(
      Object.hasOwn(commandProperties, "paymentMethod"),
      false,
      `${label} membership reserve command must not accept paymentMethod`,
    );

    for (const field of [
      "success",
      "providerCode",
      "paymentMethod",
      "paymentProduct",
      "paymentId",
      "cashierUrl",
      "qrCodePayload",
      "qrCodeImageUrl",
      "requestPaymentPayload",
    ]) {
      assert.equal(
        Object.hasOwn(outcomeProperties, field),
        false,
        `${label} membership reserve outcome must not expose legacy success or order/payment-owned ${field}`,
      );
      assert.equal(
        outcomeRequired.has(field),
        false,
        `${label} membership reserve outcome must not require legacy success or order/payment-owned ${field}`,
      );
    }
  }

  const commandBody = facadeSource.match(/interface\s+CommerceOperationCommand\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
  const outcomeBody = facadeSource.match(/interface\s+AppMembershipPurchaseOutcome\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";

  assert.equal(
    /paymentMethod\??:/.test(commandBody),
    false,
    "membership composed facade command must not expose paymentMethod",
  );
  assert.equal(
    /(success|providerCode|paymentMethod|paymentProduct|nextAction|paymentId|cashierUrl|qrCodePayload|qrCodeImageUrl|requestPaymentPayload)/.test(outcomeBody),
    false,
    "membership composed facade outcome must not expose legacy success or payment/cashier fields",
  );
  assert.equal(
    /const\s+reserveBody\s*=\s*\{([\s\S]*?)\n\s*\};/.exec(membershipServiceSource)?.[1]?.includes("paymentMethod") ?? false,
    false,
    "membership PC service must not pass paymentMethod to membership reservation SDK calls",
  );
});

test("membership app API uses structured DTO fields instead of human message payloads", () => {
  const api = readJson("apis/app-api/membership/membership-app-api.openapi.json");
  const sdkgen = readJson("sdks/sdkwork-membership-app-sdk/openapi/sdkwork-membership-app-api.sdkgen.json");
  const facadeSource = readRelative("sdks/sdkwork-membership-app-sdk/sdkwork-membership-app-sdk-typescript/src/index.ts");
  const repositoryTypes = readRelative("crates/sdkwork-membership-repository-sqlx/src/types.rs");
  const postgresRepository = readRelative("crates/sdkwork-membership-repository-sqlx/src/postgres.rs");

  for (const [label, document] of [
    ["app-api authority", api],
    ["app SDK sdkgen input", sdkgen],
  ]) {
    const dailyReward = document.components.schemas.AppMembershipDailyRewardResponse;
    assert.equal(
      Object.hasOwn(dailyReward.properties, "message"),
      false,
      `${label} daily reward response must not return backend human message payloads`,
    );
    assert.equal(
      new Set(dailyReward.required ?? []).has("message"),
      false,
      `${label} daily reward response must not require backend human message payloads`,
    );
  }

  const dailyRewardBody = facadeSource.match(/interface\s+AppMembershipDailyRewardResponse\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
  assert.equal(
    /message\??:/.test(dailyRewardBody),
    false,
    "membership composed facade daily reward response must not expose a human message field",
  );

  for (const [label, source] of [
    ["repository DTOs", repositoryTypes],
    ["postgres repository", postgresRepository],
  ]) {
    assert.equal(
      /AppMembershipDailyRewardResponse[\s\S]*?message:/.test(source),
      false,
      `${label} must not define or emit AppMembershipDailyRewardResponse.message`,
    );
    assert.equal(
      source.includes("claimed {reward_points} points"),
      false,
      `${label} must not generate user-facing daily reward text in backend DTOs`,
    );
  }
});

test("membership SDK service ports do not accept legacy response envelopes", () => {
  const portsSource = readRelative("apps/sdkwork-membership-common/packages/sdkwork-membership-sdk-ports/src/index.ts");
  const listEnvelopeSource = readRelative("apps/sdkwork-membership-common/packages/sdkwork-membership-service/src/list-envelope.ts");

  assert.equal(
    portsSource.includes("code?: number | string"),
    false,
    "membership SDK ports must not accept string response codes",
  );
  assert.equal(
    portsSource.includes("message?: string"),
    false,
    "membership SDK ports must not model legacy success/error message fields",
  );
  assert.equal(
    portsSource.includes("msg?: string"),
    false,
    "membership SDK ports must not model legacy msg aliases",
  );
  assert.equal(
    /candidate\.data\s*\?\?\s*value/.test(listEnvelopeSource),
    false,
    "membership response unwrap must not silently accept malformed or legacy envelopes",
  );
});

test("membership SDK families use sdk-manifest as the per-family metadata source of truth", () => {
  const sdkFamilyRoots = [
    "sdks/sdkwork-membership-app-sdk",
    "sdks/sdkwork-membership-backend-sdk",
  ];
  const agentSource = readRelative("AGENTS.md");
  const techSource = readRelative("docs/architecture/tech/TECH_ARCHITECTURE.md");
  const violations = [];

  for (const sdkFamilyRoot of sdkFamilyRoots) {
    const componentSpec = readJson(`${sdkFamilyRoot}/specs/component.spec.json`);
    const manifestPath = `${sdkFamilyRoot}/sdk-manifest.json`;
    const canonicalSpecFiles = new Set(
      (componentSpec.canonicalSpecs ?? []).map((canonicalSpec) => canonicalSpec.file),
    );

    if (!canonicalSpecFiles.has("SDK_MANIFEST_SPEC.md")) {
      violations.push(`${sdkFamilyRoot}:missing-sdk-manifest-spec-link`);
    }
    if (!existsSync(path.join(root, manifestPath))) {
      violations.push(`${sdkFamilyRoot}:missing-sdk-manifest`);
      continue;
    }
    if (!(componentSpec.component?.manifests ?? []).includes("sdk-manifest.json")) {
      violations.push(`${sdkFamilyRoot}:component-manifest-not-declared`);
    }
    const sdkManifest = readJson(manifestPath);
    if (JSON.stringify(componentSpec.contracts?.sdkDependencies ?? []) !== JSON.stringify(sdkManifest.sdkDependencies ?? [])) {
      violations.push(`${sdkFamilyRoot}:sdk-dependencies-mismatch`);
    }
  }

  assert.equal(
    techSource.includes("`sdk-manifest.json` is the required per-family SDK metadata source of truth and must stay aligned with `specs/component.spec.json`."),
    true,
    "technical architecture must document the per-family SDK manifest boundary",
  );
  assert.equal(
    agentSource.includes("SDK assembly"),
    false,
    "repository AGENTS.md must not describe SDK family metadata as retired SDK assembly",
  );
  assert.deepEqual(violations, []);
});

test("membership Rust purchase command does not own order item or payment artifacts", () => {
  const repositoryTypes = readRelative("crates/sdkwork-membership-repository-sqlx/src/types.rs");
  const appRouteSource = readRelative("crates/sdkwork-routes-membership-app-api/src/router.rs");
  const serviceDomainSource = readRelative("crates/sdkwork-membership-service/src/domain/mod.rs");

  const submitCommandBody = repositoryTypes.match(/struct\s+SubmitMembershipPurchaseCommand\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
  for (const field of [
    "order_item_uuid",
    "payment_uuid",
    "attempt_uuid",
    "out_trade_no",
    "expire_at",
  ]) {
    assert.equal(
      submitCommandBody.includes(field),
      false,
      `membership purchase command must not own order/payment artifact ${field}`,
    );
  }

  for (const [label, source] of [
    ["membership app route", appRouteSource],
    ["membership service domain", serviceDomainSource],
  ]) {
    for (const fragment of [
      "payment_method",
      "normalize_optional_payment_method",
      "PAYMENT_EXPIRE_SECONDS",
      "out_trade_no",
      "payment_id",
      "payment_uuid",
      "attempt_uuid",
      "order_item_uuid",
    ]) {
      assert.equal(
        source.includes(fragment),
        false,
        `${label} must not retain ${fragment} in membership purchase reservation logic`,
      );
    }
  }
});

test("membership PC packages do not depend on order or payment packages", () => {
  const subscriptionPackage = readJson("apps/sdkwork-membership-pc/packages/sdkwork-membership-pc-subscription/package.json");
  const subscriptionComponent = readJson("apps/sdkwork-membership-pc/packages/sdkwork-membership-pc-subscription/specs/component.spec.json");
  const membershipServicePackage = readJson("apps/sdkwork-membership-common/packages/sdkwork-membership-service/package.json");
  const promotionCouponPackage = readJson("../sdkwork-promotion/apps/sdkwork-promotion-pc/packages/sdkwork-promotion-pc-coupon/package.json");
  const membershipWorkspaceOverlay = readJson("../sdkwork-specs/workspace/consumers/sdkwork-membership.json");
  const subscriptionService = readRelative("apps/sdkwork-membership-pc/packages/sdkwork-membership-pc-subscription/src/subscription-service.ts");
  const subscriptionModel = readRelative("apps/sdkwork-membership-pc/packages/sdkwork-membership-pc-subscription/src/subscription.ts");
  const viteConfig = readRelative("apps/sdkwork-membership-pc/vite.config.ts");
  const tsconfig = readRelative("tsconfig.base.json");
  const workspaceConfig = readRelative("pnpm-workspace.yaml");
  const prdSource = readRelative("docs/product/prd/PRD.md");
  const techSource = readRelative("docs/architecture/tech/TECH_ARCHITECTURE.md");
  const forbiddenCommercePackages = [
    "@sdkwork/order-app-sdk",
    "@sdkwork/order-service",
    "@sdkwork/order-pc-checkout",
    "@sdkwork/order-pc-recharge",
    "@sdkwork/payment-pc-payment",
    "@sdkwork/payment-service",
    "@sdkwork/payment-contracts",
    "@sdkwork/payment-sdk-ports",
    "@sdkwork/payment-pc-core",
  ];

  for (const packageName of forbiddenCommercePackages) {
    for (const field of ["dependencies", "peerDependencies", "devDependencies"]) {
      assert.equal(
        Object.hasOwn(subscriptionPackage[field] ?? {}, packageName),
        false,
        `subscription package.json ${field} must not depend on ${packageName}`,
      );
    }
  }

  assert.deepEqual(
    (subscriptionComponent.contracts.requiredPorts ?? [])
      .map((port) => port.package)
      .filter((packageName) => typeof packageName === "string" && packageName.startsWith("@sdkwork/payment")),
    [],
    "subscription component required ports must not point at payment frontend/service packages",
  );
  assert.equal(
    membershipServicePackage.dependencies?.["@sdkwork/order-app-sdk"],
    undefined,
    "membership service must not consume the order app SDK",
  );
  assert.equal(
    workspaceConfig.includes("../sdkwork-order/sdks/sdkwork-order-app-sdk/sdkwork-order-app-sdk-typescript"),
    false,
    "membership pnpm workspace must not include order packages",
  );
  assert.equal(
    promotionCouponPackage.dependencies?.["@sdkwork/promotion-pc-core"],
    "workspace:*",
    "promotion coupon package consumed by subscription must declare promotion PC core as a workspace dependency",
  );
  assert.equal(
    workspaceConfig.includes("../sdkwork-promotion/apps/sdkwork-promotion-pc/packages/sdkwork-promotion-pc-core"),
    true,
    "pnpm workspace must include promotion PC core required by promotion coupon",
  );
  const overlayPackages = membershipWorkspaceOverlay.pnpm?.packages ?? [];
  assert.equal(
    overlayPackages.includes("../sdkwork-order/sdks/sdkwork-order-app-sdk/sdkwork-order-app-sdk-typescript"),
    false,
    "sdkwork-specs membership workspace overlay must not include the order app SDK package",
  );
  assert.equal(
    overlayPackages.includes("../sdkwork-promotion/apps/sdkwork-promotion-pc/packages/sdkwork-promotion-pc-core"),
    true,
    "sdkwork-specs membership workspace overlay must include promotion PC core",
  );
  assert.equal(
    overlayPackages.includes("../sdkwork-promotion/sdks/sdkwork-promotion-backend-sdk/sdkwork-promotion-backend-sdk-typescript"),
    true,
    "sdkwork-specs membership workspace overlay must close the promotion service workspace dependency graph",
  );
  for (const paymentOverlay of [
    "../sdkwork-payment/apps/sdkwork-payment-common/packages/*",
    "../sdkwork-payment/apps/sdkwork-payment-pc/packages/sdkwork-payment-pc-payment",
  ]) {
    assert.equal(
      overlayPackages.includes(paymentOverlay),
      false,
      `sdkwork-specs membership workspace overlay must not require retired payment package ${paymentOverlay}`,
    );
  }

  for (const [label, source] of [
    ["subscription service", subscriptionService],
    ["subscription model", subscriptionModel],
    ["membership PC vite config", viteConfig],
    ["workspace tsconfig", tsconfig],
    ["pnpm workspace", workspaceConfig],
  ]) {
    for (const fragment of [
      "@sdkwork/payment-pc-payment",
      "@sdkwork/payment-service",
      "../sdkwork-payment",
    ]) {
      assert.equal(
        source.includes(fragment),
        false,
        `${label} must not retain payment frontend/service package coupling through ${fragment}`,
      );
    }
  }

  assert.equal(
    prdSource.includes("The PC subscription dashboard uses membership-owned default payment-method options for order checkout selection and does not depend on `sdkwork-payment` frontend or service packages."),
    true,
    "PRD must document the decoupled subscription payment-method selector boundary",
  );
  assert.equal(
    techSource.includes("`@sdkwork/membership-pc-subscription` does not import `@sdkwork/payment-pc-payment` or `@sdkwork/payment-service`; payment-method UI choices are local order checkout inputs and payment execution remains behind `sdkwork-order` / `sdkwork-payment` ports."),
    true,
    "technical architecture must document the subscription-to-payment package decoupling",
  );
});

test("membership SDK generation preserves sdkgen ownership state", () => {
  const sharedGenerator = readRelative("scripts/generate-membership-sdk.mjs");
  const familyEntrypoints = [
    readRelative("sdks/sdkwork-membership-app-sdk/bin/generate-sdk.mjs"),
    readRelative("sdks/sdkwork-membership-backend-sdk/bin/generate-sdk.mjs"),
  ];
  const powershellEntrypoints = [
    readRelative("sdks/sdkwork-membership-app-sdk/bin/generate-sdk.ps1"),
    readRelative("sdks/sdkwork-membership-backend-sdk/bin/generate-sdk.ps1"),
  ];

  assert.match(sharedGenerator, /sdkwork-sdk-generator["),\s]+bin["),\s]+sdkgen\.js/u);
  assert.match(sharedGenerator, /--standard-profile["),\s]+sdkwork-v3/u);
  assert.doesNotMatch(sharedGenerator, /(?:rmSync|Remove-Item|generate-sdk\.sh)/u);

  for (const entrypoint of familyEntrypoints) {
    assert.match(entrypoint, /runMembershipSdkGeneration/u);
    assert.doesNotMatch(entrypoint, /(?:powershell|spawnSync|generate-sdk\.sh|Remove-Item)/u);
  }
  for (const entrypoint of powershellEntrypoints) {
    assert.match(entrypoint, /generate-sdk\.mjs/u);
    assert.doesNotMatch(entrypoint, /Remove-Item/u);
  }
});
