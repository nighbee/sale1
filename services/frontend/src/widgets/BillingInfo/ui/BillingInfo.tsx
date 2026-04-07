import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { companyApi } from '../../../entities/company/api';
import type { Billing } from '../../../entities/company/types';
import Skeleton from '../../../shared/ui/Skeleton';

interface BillingInfoProps {
}

export const BillingInfo: React.FC<BillingInfoProps> = () => {
  const { t } = useTranslation();
  const [billing, setBilling] = useState<Billing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBilling = async () => {
      try {
        const res = await companyApi.getBilling();
        setBilling(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchBilling();
  }, []);

  if (loading) return <Skeleton className="h-48 w-full" />;
  if (!billing) return <div>{t('common.not_found')}</div>;

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
      <h3 className="text-lg font-semibold mb-4">{t('billing.title')}</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-slate-500">{t('billing.current_plan')}</p>
          <p className="font-medium">{t('billing.active')}</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">{t('billing.usage')}</p>
          <p className="font-medium">{Math.round((billing.tokens_used / billing.tokens_limit) * 100)}%</p>
        </div>
      </div>
    </div>
  );
};
