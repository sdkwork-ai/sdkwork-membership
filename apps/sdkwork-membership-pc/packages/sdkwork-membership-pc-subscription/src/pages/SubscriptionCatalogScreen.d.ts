/**
 * A self-contained subscription catalog screen that can be mounted with zero
 * props.  It wires default host components, notification UI, and no-op
 * callbacks internally, so external hosts (e.g. CloudRouter) can embed it
 * with a single `<SdkworkSubscriptionCatalogScreen />`.
 *
 * The component automatically:
 * - Bootstraps the catalog from the configured SDK service provider
 * - Shows loading and error states with retry
 * - Displays plan cards, tier comparison, and billing cycle tabs
 * - Handles checkout via a built-in confirmation modal
 */
export declare function SdkworkSubscriptionCatalogScreen(): import("react").JSX.Element;
//# sourceMappingURL=SubscriptionCatalogScreen.d.ts.map