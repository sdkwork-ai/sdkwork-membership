import { createContext, useContext, useMemo, type ComponentType, type ReactNode } from "react";

import type {
  SdkworkSubscriptionCatalogCheckoutModalProps,
  SdkworkSubscriptionCatalogTranslate,
} from "../subscription-catalog-host";
import type { SdkworkTeamSubscriptionPort } from "./team-subscription-port";

/** Notification sink shared by the shared catalog and the team surface. */
export type SdkworkTeamNotify = (
  message: string,
  tone: "error" | "info" | "success",
) => void;

/**
 * Runtime face the shared team surface needs from the page that mounted it.
 *
 * The page derives every value from its own props, so a host plugs the team
 * surface in once (`team={{ port }}`) instead of re-implementing the container,
 * the seat directory, or the payment hand-off.
 */
export interface SdkworkTeamSurfaceRuntime {
  /** Host implementation of the membership/IAM/order reads. */
  port: SdkworkTeamSubscriptionPort;
  /** Localized lookup: key plus default copy. */
  translate: SdkworkSubscriptionCatalogTranslate;
  /** Sends a signed-out visitor to the host sign-in surface. */
  onLoginRequired: () => void;
  /** Toast sink; the page falls back to `console.error` when the host omits it. */
  onNotify: SdkworkTeamNotify;
  /** Host checkout dialog the team seat payment reuses. */
  checkoutModal: ComponentType<SdkworkSubscriptionCatalogCheckoutModalProps>;
  /** BCP 47 tag used for date formatting; the runtime default when omitted. */
  locale?: string;
}

const SdkworkTeamSurfaceContext = createContext<SdkworkTeamSurfaceRuntime | null>(null);

export interface SdkworkTeamSurfaceProviderProps {
  children?: ReactNode;
  value: SdkworkTeamSurfaceRuntime;
}

/**
 * Publishes the page-owned runtime to the team surface components.
 *
 * @param props - the runtime value and the surface children.
 * @returns the provider element.
 */
export function SdkworkTeamSurfaceProvider({
  children,
  value,
}: SdkworkTeamSurfaceProviderProps) {
  const runtime = useMemo<SdkworkTeamSurfaceRuntime>(() => value, [
    value.checkoutModal,
    value.onLoginRequired,
    value.onNotify,
    value.port,
    value.translate,
  ]);
  return (
    <SdkworkTeamSurfaceContext.Provider value={runtime}>
      {children}
    </SdkworkTeamSurfaceContext.Provider>
  );
}

/**
 * Reads the page-owned team runtime.
 *
 * @returns the runtime published by {@link SdkworkTeamSurfaceProvider}.
 */
export function useSdkworkTeamSurfaceRuntime(): SdkworkTeamSurfaceRuntime {
  const runtime = useContext(SdkworkTeamSurfaceContext);
  if (runtime === null) {
    throw new Error(
      "Sdkwork team surface used outside SdkworkTeamSurfaceProvider: mount it through SdkworkSubscriptionCatalogPage team prop.",
    );
  }
  return runtime;
}

/**
 * Localized lookup for the team surface.
 *
 * @returns the copy lookup published by the page.
 */
export function useSdkworkTeamTranslate(): SdkworkSubscriptionCatalogTranslate {
  return useSdkworkTeamSurfaceRuntime().translate;
}

/**
 * Replaces `{{name}}` placeholders in one copy template.
 *
 * The catalog translate contract is `(key, defaultValue) => string`, so
 * interpolation happens here instead of depending on one host i18n library's
 * argument shape.
 *
 * @param template - the resolved copy, placeholders intact.
 * @param values - placeholder values keyed by name.
 * @returns the copy with every supplied placeholder replaced.
 */
export function formatSdkworkTeamCopy(
  template: string,
  values: Readonly<Record<string, number | string>>,
): string {
  return template.replaceAll(
    /\{\{(\w+)\}\}/gu,
    (match, name: string) => {
      const value = values[name];
      return value === undefined ? match : String(value);
    },
  );
}
