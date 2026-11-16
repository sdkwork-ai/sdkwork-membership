import React from "react";
import { useTranslation } from "react-i18next";
import type { TokenAmount } from "./RechargeTabContent";

interface RechargeFooterBarProps {
  selectedSkuItem?: TokenAmount;
  onPay: (item: TokenAmount, type: string) => void;
}

export const RechargeFooterBar: React.FC<RechargeFooterBarProps> = ({
  selectedSkuItem,
  onPay,
}) => {
  const { t } = useTranslation();
  if (!selectedSkuItem) return null;

  return (
    <div className="absolute bottom-0 inset-x-0 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] bg-white dark:bg-[#1A1A1A] border-t border-border-color shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-30">
      <button 
        className="w-full h-[48px] bg-primary-blue text-white font-bold text-[16px] rounded-full active:opacity-80 transition-opacity flex items-center justify-center gap-2"
        onClick={() => onPay(selectedSkuItem, 'recharge')}
      >
        {t("vip.confirm_pay", "确认支付 ¥{{price}}", { price: selectedSkuItem.price })}
      </button>
    </div>
  );
};
