import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageLayout } from '../../../widgets/PageLayout';
import { companyApi } from '../../../entities/company/api';
import { userApi } from '../../../entities/user/api';
import type { Company } from '../../../entities/company/types';
import type { User } from '../../../entities/user/types';
import Skeleton from '../../../shared/ui/Skeleton';

export const SuperAdminPage: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'companies' | 'users' | 'subscriptions'>('companies');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (activeTab === 'companies') {
          const res = await companyApi.listCompanies();
          setCompanies(res.data.companies || []);
        } else if (activeTab === 'users') {
          const res = await userApi.listUsers();
          setUsers(res.data.users || []);
        }
      } catch (error) {
        console.error('Failed to fetch superadmin data', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [activeTab]);

  return (
    <PageLayout title={t('superadmin.title')}>
      <div className="p-4 md:p-8">
        <div className="mb-8">
          <p className="text-slate-500 mt-2">{t('superadmin.subtitle')}</p>
        </div>

        <div className="flex border-b border-border-light dark:border-slate-800 mb-8 overflow-x-auto whitespace-nowrap">
          <button
            onClick={() => setActiveTab('companies')}
            className={`px-6 py-3 font-bold text-sm transition-colors border-b-2 ${activeTab === 'companies' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            {t('superadmin.companies')}
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-3 font-bold text-sm transition-colors border-b-2 ${activeTab === 'users' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            {t('superadmin.users')}
          </button>
          <button
            onClick={() => setActiveTab('subscriptions')}
            className={`px-6 py-3 font-bold text-sm transition-colors border-b-2 ${activeTab === 'subscriptions' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            {t('superadmin.subscriptions')}
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-border-light dark:border-slate-800 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              {activeTab === 'companies' && (
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4">{t('superadmin.company_name')}</th>
                      <th className="px-6 py-4">{t('superadmin.created_at')}</th>
                      <th className="px-6 py-4">{t('common.status')}</th>
                      <th className="px-6 py-4 text-right">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light dark:divide-slate-800">
                    {companies.map((company) => (
                      <tr key={company.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 font-semibold">{company.name}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">{new Date(company.created_at || Date.now()).toLocaleDateString()}</td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400">
                            {t('superadmin.active')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className="text-primary font-bold text-sm hover:underline">{t('common.edit')}</button>
                        </td>
                      </tr>
                    ))}
                    {companies.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-500">{t('superadmin.no_companies')}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

              {activeTab === 'users' && (
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4">{t('common.name')}</th>
                      <th className="px-6 py-4">{t('common.email')}</th>
                      <th className="px-6 py-4">{t('common.role')}</th>
                      <th className="px-6 py-4">{t('superadmin.company_id')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light dark:divide-slate-800">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 font-semibold">{user.full_name || 'N/A'}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">{user.email}</td>
                        <td className="px-6 py-4 text-sm font-bold uppercase">{user.role}</td>
                        <td className="px-6 py-4 text-sm text-slate-500">{user.company_id}</td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-slate-500">{t('superadmin.no_users')}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}

              {activeTab === 'subscriptions' && (
                <div className="p-12 text-center text-slate-500">
                  <span className="material-symbols-outlined text-4xl mb-4">payments</span>
                  <p>{t('superadmin.sub_mgmt_soon')}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
};
