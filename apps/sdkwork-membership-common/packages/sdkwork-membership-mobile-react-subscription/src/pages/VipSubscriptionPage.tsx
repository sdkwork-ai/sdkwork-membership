import { useTranslation } from "react-i18next";
import React, { useState } from "react";
import { PageLayout } from "@sdkwork/ui-mobile-react";
import { Star, Shield, Zap } from "lucide-react";
import { VipBanner } from "../components/VipBanner";
import { VipPlanSelector } from "../components/VipPlanSelector";
import type { VipPlan } from "../components/VipPlanSelector";
import { VipBenefitsGrid } from "../components/VipBenefitsGrid";
import type { VipBenefit } from "../components/VipBenefitsGrid";
import { VipFooter } from "../components/VipFooter";

const VIP_PLANS: VipPlan[] = [
  {
    id: "month",
    nameKey: "vip.plan_month_name",
    name: "连续包月",
    price: "19",
    originalPrice: "25",
    descKey: "vip.plan_month_desc",
    desc: "首月仅需9元",
  },
  {
    id: "quarter",
    nameKey: "vip.plan_quarter_name",
    name: "连续包季",
    price: "53",
    originalPrice: "75",
    descKey: "vip.plan_quarter_desc",
    desc: "折合每月17.6元",
    badgeKey: "vip.plan_badge_recommended",
    badge: "推荐",
  },
  {
    id: "year",
    nameKey: "vip.plan_year_name",
    name: "连续包年",
    price: "188",
    originalPrice: "300",
    descKey: "vip.plan_year_desc",
    desc: "折合每月15.6元",
    badgeKey: "vip.plan_badge_value",
    badge: "超值",
  }
];

const VIP_BENEFITS: VipBenefit[] = [
  {
    icon: Star,
    titleKey: "vip.benefit_identity_title",
    title: "专属标识",
    descKey: "vip.benefit_identity_desc",
    desc: "尊贵身份的外显标识",
  },
  {
    icon: Shield,
    titleKey: "vip.benefit_safety_title",
    title: "安全防护",
    descKey: "vip.benefit_safety_desc",
    desc: "高级别的账号找回与安全",
  },
  {
    icon: Zap,
    titleKey: "vip.benefit_priority_title",
    title: "优先体验",
    descKey: "vip.benefit_priority_desc",
    desc: "最新功能提前一周体验",
  },
];

export const VipSubscriptionPage = () => {
  const { t } = useTranslation();
  const [selectedPlan, setSelectedPlan] = useState("year");

  return (
    <PageLayout title={t("vip.title", "会员订阅")} bgClass="bg-[#F8F9FA] dark:bg-black">
      <div className="relative pt-6 pb-24 overflow-y-auto h-full">
        <VipBanner />

        <div className="relative z-10 mt-[100px] px-4 space-y-6">
          <VipPlanSelector
            plans={VIP_PLANS}
            selectedPlan={selectedPlan}
            onSelectPlan={setSelectedPlan}
          />

          <VipBenefitsGrid benefits={VIP_BENEFITS} />
        </div>
      </div>

      <VipFooter />
    </PageLayout>
  );
};

