import React from "react";
import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react";

export interface VipBenefit {
  icon: LucideIcon;
  titleKey?: string;
  title: string;
  descKey?: string;
  desc: string;
}

interface VipBenefitsGridProps {
  benefits: VipBenefit[];
}

export const VipBenefitsGrid: React.FC<VipBenefitsGridProps> = ({ benefits }) => {
  const { t } = useTranslation();

  return (
    <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl p-5 shadow-sm border border-[#EBEBEB] dark:border-[#333]">
      <h3 className="text-[16px] font-bold text-text-main mb-4">
        {t("vip.benefits_title", "VIP 专属特权")}
      </h3>
      <div className="grid grid-cols-3 gap-y-6">
        {benefits.map((benefit, i) => {
          const Icon = benefit.icon;
          return (
            <div key={i} className="flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 bg-[#FDFBF2] dark:bg-[#2A2410] rounded-full flex items-center justify-center text-[#D4AF37]">
                <Icon strokeWidth={1.5} className="w-6 h-6" />
              </div>
              <span className="text-[13px] font-medium text-text-main">{t(benefit.titleKey ?? "", benefit.title)}</span>
              <span className="text-[10px] text-text-sub px-1">{t(benefit.descKey ?? "", benefit.desc)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
