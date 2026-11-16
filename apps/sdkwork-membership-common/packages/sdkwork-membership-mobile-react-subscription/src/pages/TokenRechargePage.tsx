import { useTranslation } from "react-i18next";
import React, { useState } from "react";
import { PageLayout, showToast } from "@sdkwork/ui-mobile-react";
import { useLocation } from "react-router";
import { RechargeTabsHeader } from "../components/RechargeTabsHeader";
import { RechargeTabContent } from "../components/RechargeTabContent";
import type { TokenAmount } from "../components/RechargeTabContent";
import { PlanTabContent } from "../components/PlanTabContent";
import type { TokenPlan } from "../components/PlanTabContent";
import { CouponTabContent } from "../components/CouponTabContent";
import type { CouponItem } from "../components/CouponTabContent";
import { RechargeFooterBar } from "../components/RechargeFooterBar";

const TOKEN_AMOUNTS: TokenAmount[] = [
  { id: "t1", amount: 100, price: 10 },
  { id: "t2", amount: 500, price: 48, bonus: 50 },
  { id: "t3", amount: 1000, price: 95, bonus: 120 },
  { id: "t4", amount: 5000, price: 450, bonus: 800 },
];

const TOKEN_PLANS: TokenPlan[] = [
  {
    id: "p1",
    nameKey: "vip.plan_basic_name",
    name: "基础文本包",
    tokens: 10000,
    price: 80,
    descKey: "vip.plan_basic_desc",
    desc: "适合日常文字交流，有效期30天",
  },
  {
    id: "p2",
    nameKey: "vip.plan_multimodal_name",
    name: "进阶多模态包",
    tokens: 50000,
    price: 350,
    descKey: "vip.plan_multimodal_desc",
    desc: "包含图片和部分音视频解析体验",
  },
  {
    id: "p3",
    nameKey: "vip.plan_pro_name",
    name: "专业全能包",
    tokens: 200000,
    price: 1200,
    descKey: "vip.plan_pro_desc",
    desc: "重度使用者首选，无限制所有模型接入",
  },
];

const COUPONS: CouponItem[] = [
  {
    id: "c1",
    nameKey: "vip.coupon_new_user_name",
    name: "新用户满减券",
    discount: 10,
    minSpend: 50,
    validTo: "2026.06.30",
  },
  {
    id: "c2",
    nameKey: "vip.coupon_weekend_name",
    name: "周末特惠立减券",
    discount: 5,
    minSpend: 0,
    validTo: "2026.05.30",
  },
];

export const TokenRechargePage = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<"recharge" | "plan" | "coupon">(
    (location.state as any)?.tab || "recharge"
  );
  const [selectedSku, setSelectedSku] = useState("");

  const handlePay = (item: any, type: string) => {
    const action = type === "coupon"
      ? t("vip.pay_action_claim", "领取")
      : t("vip.pay_action_buy", "购买");
    const name = item.nameKey
      ? t(item.nameKey, item.name)
      : `${item.amount} Tokens`;
    showToast(t("vip.pay_redirect_tip", "正在前往支付：{{action}} {{name}}", { action, name }));
  };

  const selectedSkuItem = TOKEN_AMOUNTS.find(t => t.id === selectedSku);

  return (
    <PageLayout title={t("vip.recharge_title", "积分与Token超市")} bgClass="bg-[#F8F9FA] dark:bg-black">
      <RechargeTabsHeader activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "recharge" && (
          <RechargeTabContent
            tokenAmounts={TOKEN_AMOUNTS}
            selectedSku={selectedSku}
            onSelectSku={setSelectedSku}
          />
        )}

        {activeTab === "plan" && (
          <PlanTabContent plans={TOKEN_PLANS} onPay={handlePay} />
        )}

        {activeTab === "coupon" && (
          <CouponTabContent coupons={COUPONS} onPay={handlePay} />
        )}
      </div>
      
      {activeTab === "recharge" && selectedSku && (
        <RechargeFooterBar selectedSkuItem={selectedSkuItem} onPay={handlePay} />
      )}
    </PageLayout>
  );
};

