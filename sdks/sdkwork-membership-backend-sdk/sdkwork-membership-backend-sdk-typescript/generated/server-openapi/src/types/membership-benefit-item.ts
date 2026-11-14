export interface MembershipBenefitItem {
  id: string;
  name: string;
  benefitKey?: string | null;
  type?: string | null;
  description?: string | null;
  icon?: string | null;
  claimed: boolean;
  usageLimit?: string;
  usedCount?: string;
}
