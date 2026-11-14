/**
 * Optional organization (team) capability of the shared subscription catalog
 * page.
 *
 * A host that supplies `team` gets the audience switch above the personal hero
 * plus the team seat surface; a host that omits it keeps the personal-only page.
 * The capability carries no transport: the host implements
 * {@link SdkworkTeamSubscriptionPort} with its own generated SDK clients.
 */

import type { SdkworkSubscriptionCatalogTranslate } from "./subscription-catalog-host";
import type {
  SdkworkSubscriptionAudienceLabels,
  SdkworkTeamSubscriptionPort,
} from "./team";

export interface SdkworkSubscriptionCatalogTeamProps {
  /** Host implementation of the membership/IAM/order team reads. */
  port: SdkworkTeamSubscriptionPort;
  /** Optional audience-tab copy overrides. */
  labels?: SdkworkSubscriptionAudienceLabels;
  /**
   * Copy lookup for the team surface. Defaults to the page's own translation
   * with the Chinese defaults the package ships.
   */
  translate?: SdkworkSubscriptionCatalogTranslate;
  /** BCP 47 tag used for billing-period dates; the runtime default if absent. */
  locale?: string;
}
