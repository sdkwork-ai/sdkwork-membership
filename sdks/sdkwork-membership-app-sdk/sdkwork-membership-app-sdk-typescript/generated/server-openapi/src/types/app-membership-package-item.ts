import type { MembershipAudience } from './membership-audience';
import type { MembershipCategory } from './membership-category';
import type { MembershipPriceUnit } from './membership-price-unit';

/** Membership package item. */
export interface AppMembershipPackageItem {
  id: string;
  name: string;
  description?: string;
  price: string;
  originalPrice?: string;
  audience: MembershipAudience;
  priceUnit: MembershipPriceUnit;
  pointAmount: string;
  durationDays: string;
  planName?: string;
  /** Storage id of the plan this package grants. */
  planId: string;
  /** Plan rank as served by `AppMembershipPlanItem.id`. */
  planRank: string;
  /** Billing recurrence of this package (`once` | `day` | `week` | `month` | `quarter` | `year`). */
  recurrenceCycle?: string | null;
  /** Minimum purchasable seat quantity for per-seat team packages. */
  seatMin: string;
  /** Maximum purchasable seat quantity for per-seat team packages. */
  seatMax: string;
  /** Membership points every assigned seat receives per billing period. */
  seatPointsAmount: string;
  sortWeight: string;
  recommended: boolean;
  tags: string[];
  category: MembershipCategory;
}
