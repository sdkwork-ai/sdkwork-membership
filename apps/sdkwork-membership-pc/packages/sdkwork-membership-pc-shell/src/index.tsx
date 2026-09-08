import { lazy, Suspense, useMemo } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import { SdkworkThemeProvider } from "@sdkwork/ui-pc-react/theme";
import { resolveBaseUrl } from "@sdkwork/sdk-common";
import { bootstrapSdkworkMembershipAppService } from "@sdkwork/membership-service";
import { sdkworkMembershipPcRuntimeIdentity } from "@sdkwork/membership-pc-core";

const DEFAULT_MEMBERSHIP_APP_API_BASE_URL = "http://127.0.0.1:18096";
const env = (import.meta as ImportMeta & { env?: Record<string, boolean | string | undefined> }).env;
const SdkworkMembershipPage = lazy(async () => {
  const module = await import("@sdkwork/membership-pc-membership");
  return { default: module.SdkworkMembershipPage };
});
const SdkworkSubscriptionCatalogScreen = lazy(async () => {
  const module = await import("@sdkwork/membership-pc-subscription");
  return { default: module.SdkworkSubscriptionCatalogScreen };
});
const SdkworkSubscriptionPage = lazy(async () => {
  const module = await import("@sdkwork/membership-pc-subscription");
  return { default: module.SdkworkSubscriptionPage };
});

function readBrowserEnvString(key: string): string | undefined {
  const value = env?.[key];
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized || undefined;
}

function isDevelopmentRuntime(): boolean {
  const dev = env?.DEV;
  if (typeof dev === "boolean") {
    return dev;
  }
  return readBrowserEnvString("MODE") !== "production";
}

function resolveRequiredAppApiBaseUrl(key: string, developmentDefault: string): string {
  const configured = readBrowserEnvString(key);
  if (configured) {
    return configured;
  }
  if (isDevelopmentRuntime()) {
    return developmentDefault;
  }
  throw new Error(`Missing ${key}; configure the explicit app-api base URL before SDK bootstrap.`);
}

function resolveMembershipApiBaseUrl(): string {
  // Single shared base-url key (`SDKWORK_API_BASE_URL`) resolved through
  // `@sdkwork/sdk-common`: candidates may be comma/semicolon separated and the
  // matching API host is chosen from the current page's environment+brand.
  // The membership App SDK expects a bare origin (it appends /app/v3/api
  // itself), so path preservation stays off. Legacy per-app env keys and the
  // development default stay as fallbacks.
  const shared = resolveBaseUrl({ envKey: "SDKWORK_API_BASE_URL" });
  if (shared.reason !== "empty" && shared.url) {
    return shared.url;
  }
  return resolveRequiredAppApiBaseUrl(
    "VITE_SDKWORK_MEMBERSHIP_PC_APP_API_BASE_URL",
    DEFAULT_MEMBERSHIP_APP_API_BASE_URL,
  );
}

function MembershipRoutes() {
  const navigate = useNavigate();

  return (
    <Routes>
      <Route
        path="/"
        element={(
          <Navigate replace to="/membership" />
        )}
      />
      <Route
        path="/membership"
        element={(
          <SdkworkMembershipPage
            checkoutBasePath="/subscription/checkout"
            onNavigate={(route) => navigate(route)}
          />
        )}
      />
      <Route
        path="/subscription/catalog"
        element={<SdkworkSubscriptionCatalogScreen />}
      />
      <Route
        path="/subscription/checkout"
        element={<SdkworkSubscriptionPage />}
      />
      <Route
        path="*"
        element={(
          <Navigate replace to="/membership" />
        )}
      />
    </Routes>
  );
}

export function MembershipAppShell() {
  /**
   * Bootstrap SDK service providers synchronously during the first render,
   * BEFORE any child route components mount.  React fires effects
   * bottom-up (children first), so a useEffect-based bootstrap would let
   * child pages call getSdkworkMembershipService() before the provider is
   * configured.  Using useMemo with an empty dependency array guarantees
   * the SDK is ready before children render.
   */
  useMemo(() => {
    const membershipBaseUrl = resolveMembershipApiBaseUrl();
    bootstrapSdkworkMembershipAppService({ baseUrl: membershipBaseUrl });
  }, []);

  return (
    <SdkworkThemeProvider defaultTheme="light">
      <BrowserRouter>
        <div className="min-h-screen bg-[var(--sdk-color-surface-base)] text-[var(--sdk-color-text-primary)]">
          <header className="border-b border-[var(--sdk-color-border-subtle)] bg-[var(--sdk-color-surface-panel)] px-6 py-4">
            <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sdk-color-text-muted)]">
                  SDKWork Membership
                </div>
                <h1 className="mt-1 text-lg font-semibold">
                  {sdkworkMembershipPcRuntimeIdentity.appKey}
                </h1>
              </div>
              <nav className="flex items-center gap-3 text-sm">
                <Link className="text-[var(--sdk-color-text-secondary)] hover:text-[var(--sdk-color-text-primary)]" to="/membership">
                  Membership
                </Link>
                <Link className="text-[var(--sdk-color-text-secondary)] hover:text-[var(--sdk-color-text-primary)]" to="/subscription/catalog">
                  Catalog
                </Link>
                <Link className="text-[var(--sdk-color-text-secondary)] hover:text-[var(--sdk-color-text-primary)]" to="/subscription/checkout">
                  Checkout
                </Link>
              </nav>
            </div>
          </header>
          <main className="min-h-[calc(100vh-5rem)]">
            <Suspense fallback={null}>
              <MembershipRoutes />
            </Suspense>
          </main>
        </div>
      </BrowserRouter>
    </SdkworkThemeProvider>
  );
}
