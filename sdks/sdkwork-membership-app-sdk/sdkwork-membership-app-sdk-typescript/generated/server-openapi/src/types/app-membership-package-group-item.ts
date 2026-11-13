import type { AppMembershipPackageItem } from './app-membership-package-item';
import type { MembershipAudience } from './membership-audience';
import type { MembershipCategory } from './membership-category';

/** Membership package group item. */
export interface AppMembershipPackageGroupItem {
  id: string;
  name: string;
  description?: string;
  audience: MembershipAudience;
  /** Billing cycle of this package group (`once` | `day` | `week` | `month` | `quarter` | `year`). */
  billingCycle?: string | null;
  /** Billing duration in days for this package group. */
  durationDays: string;
  sortWeight: string;
  packages: AppMembershipPackageItem[];
  category: MembershipCategory;
}
