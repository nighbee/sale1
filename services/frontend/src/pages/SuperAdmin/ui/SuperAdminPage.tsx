import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PageLayout } from '../../../widgets/PageLayout';
import { companyApi } from '../../../entities/company/api';
import { userApi } from '../../../entities/user/api';
import type { Company } from '../../../entities/company/types';
import type { User } from '../../../entities/user/types';
import Skeleton from '../../../shared/ui/Skeleton';
import { SheetCalls } from '../../../widgets/SheetCalls';
import { Leaderboard } from '../../../widgets/Leaderboard';

type TabType = 'companies' | 'users' | 'calls' | 'leadership' | 'subscriptions';

export const SuperAdminPage: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('companies');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (activeTab === 'companies') {
        setLoading(true);
        try {
          const res = await companyApi.listCompanies();
          setCompanies(res.data.companies || []);
        } catch (error) {
          console.error('Failed to fetch companies', error);
        } finally {
          setLoading(false);
        }
      } else if (activeTab === 'users') {
        setLoading(true);
        try {
          const res = await userApi.listUsers();
          setUsers(res.data.users || []);
        } catch (error) {
          console.error('Failed to fetch users', error);
        } finally {
          setLoading(false);
        }
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
          {[
            { id: 'companies', label: t('superadmin.companies') },
            { id: 'users', label: t('superadmin.users') },
            { id: 'calls', label: t('superadmin.call_list') },
            { id: 'leadership', label: t('superadmin.leadership') },
            { id: 'subscriptions', label: t('superadmin.subscriptions') },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`px-6 py-3 font-bold text-sm transition-colors border-b-2 ${activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="space-y-6">
          {activeTab === 'companies' && (
             <div className="bg-white dark:bg-slate-900 rounded-xl border border-border-light dark:border-slate-800 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-8 space-y-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
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
                    </div>
                )}
             </div>
          )}

          {activeTab === 'users' && (
             <div className="bg-white dark:bg-slate-900 rounded-xl border border-border-light dark:border-slate-800 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-8 space-y-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">{t('common.name')}</th>
                                    <th className="px-6 py-4">{t('common.email')}</th>
                                    <th className="px-6 py-4">{t('common.role')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-light dark:divide-slate-800">
                                {users.map((user) => (
                                    <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4 font-semibold">{user.full_name || t('common.not_available')}</td>
                                        <td className="px-6 py-4 text-sm text-slate-500">{user.email}</td>
                                        <td className="px-6 py-4 text-sm font-bold uppercase">{user.role}</td>
                                    </tr>
                                ))}
                                {users.length === 0 && (
                                  <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">{t('superadmin.no_users')}</td>
                                  </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
             </div>
          )}

          {activeTab === 'calls' && (
            <SheetCalls />
          )}

          {activeTab === 'leadership' && (
            <Leaderboard teamId="" />
          )}

          {activeTab === 'subscriptions' && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-border-light dark:border-slate-800 shadow-sm p-12 text-center text-slate-500">
              <span className="material-symbols-outlined text-4xl mb-4">payments</span>
              <p>{t('superadmin.sub_mgmt_soon')}</p>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
};
