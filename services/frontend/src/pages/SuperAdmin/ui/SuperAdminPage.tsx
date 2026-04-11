import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { PageLayout } from '../../../widgets/PageLayout';
import { companyApi } from '../../../entities/company/api';
import { userApi } from '../../../entities/user/api';
import { callApi } from '../../../entities/call/api';
import { teamApi } from '../../../entities/team/api';
import { scriptApi } from '../../../entities/script/api';
import { systemApi } from '../../../entities/system';
import type { QueueStatus } from '../../../entities/system';
import type { Company } from '../../../entities/company/types';
import type { User } from '../../../entities/user/types';
import type { Call } from '../../../entities/call/types';
import type { Team } from '../../../entities/team/types';
import type { Script } from '../../../entities/script/types';
import type { Integration } from '../../../entities/integration/types';
import Skeleton from '../../../shared/ui/Skeleton';
import Pagination from '../../../shared/ui/Pagination';
import { Leaderboard } from '../../../widgets/Leaderboard';

type TabType = 'companies' | 'users' | 'calls' | 'teams' | 'scripts' | 'redis' | 'system' | 'leadership' | 'subscriptions';

export const SuperAdminPage: React.FC = () => {
  const { t } = useTranslation();
  const { tab } = useParams<{ tab: string }>();
  const navigate = useNavigate();
  const activeTab = (tab as TabType) || 'companies';

  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [allCalls, setAllCalls] = useState<Call[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [redisKeys, setRedisKeys] = useState<{ key: string; type: string }[]>([]);
  const [systemStatus, setSystemStatus] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(false);

  // Pagination & Filters
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const limit = 20;

  const [selectedCompany, setSelectedCompany] = useState<{
    company: Company;
    users: User[];
    integrations: Integration[];
  } | null>(null);

  const [editingRedis, setEditingRedis] = useState<{ key: string; value: string } | null>(null);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  const fetchRedisKeys = async () => {
    try {
      const res = await systemApi.listRedisKeys();
      setRedisKeys(res.data.keys || []);
    } catch (err) {
      console.error('Failed to fetch redis keys', err);
    }
  };

  const handleEditRedis = async (key: string) => {
    try {
      const res = await systemApi.getRedisValue(key);
      setEditingRedis({ key, value: res.data.value });
    } catch (err) {
      console.error('Failed to get redis value', err);
    }
  };

  const handleUpdateRedis = async () => {
    if (!editingRedis) return;
    try {
      await systemApi.updateRedisValue(editingRedis.key, editingRedis.value);
      setEditingRedis(null);
    } catch (err) {
      console.error('Failed to update redis', err);
    }
  };

  const handleDeleteRedis = async (key: string) => {
    if (!window.confirm(`Delete key ${key}?`)) return;
    try {
      await systemApi.deleteRedisKey(key);
      setRedisKeys(redisKeys.filter(k => k.key !== key));
    } catch (err) {
      console.error('Failed to delete redis key', err);
    }
  };

  const handleViewCompany = async (id: string) => {
    setLoading(true);
    try {
      const res = await companyApi.getCompanyDetails(id);
      setSelectedCompany(res.data);
    } catch (err) {
      console.error('Failed to get company details', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany) return;
    try {
        await companyApi.updateCompanyGlobal(editingCompany.id, editingCompany);
        setCompanies(companies.map(c => c.id === editingCompany.id ? editingCompany : c));
        setEditingCompany(null);
    } catch (err) {
        console.error('Failed to update company', err);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
        await userApi.updateUserGlobal(editingUser.id, editingUser);
        setUsers(users.map(u => u.id === editingUser.id ? editingUser : u));
        setEditingUser(null);
    } catch (err) {
        console.error('Failed to update user', err);
    }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    try {
        await userApi.deleteGlobal(deletingUser.id);
        setUsers(users.filter(u => u.id !== deletingUser.id));
        setTotal(prev => prev - 1);
        setDeletingUser(null);
    } catch (err) {
        console.error('Failed to delete user', err);
    }
  };

  useEffect(() => {
    setPage(1);
    setSearch('');
  }, [activeTab]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = { page, limit, search, name: search };
        if (activeTab === 'companies') {
          const res = await companyApi.listAllCompanies(params);
          setCompanies(res.data.companies || []);
          setTotal(res.data.total || 0);
        } else if (activeTab === 'users') {
          const res = await userApi.listAllUsers(params);
          setUsers(res.data.users || []);
          setTotal(res.data.total || 0);
        } else if (activeTab === 'calls') {
          const res = await callApi.listAllCalls(params);
          setAllCalls(res.data.calls || []);
          setTotal(res.data.total || 0);
        } else if (activeTab === 'teams') {
          const res = await teamApi.listAllTeams(params);
          setTeams(res.data.teams || []);
          setTotal(res.data.total || 0);
        } else if (activeTab === 'scripts') {
          const res = await scriptApi.listAllScripts(params);
          setScripts(res.data.scripts || []);
          setTotal(res.data.total || 0);
        } else if (activeTab === 'redis') {
          await fetchRedisKeys();
        } else if (activeTab === 'system') {
          const res = await systemApi.getStatus();
          setSystemStatus(res.data);
        }
      } catch (error) {
        console.error(`Failed to fetch ${activeTab}`, error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [activeTab, page, search]);

  return (
    <PageLayout title={t('superadmin.title')}>
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Horizontal Navigation */}
        <nav className="flex space-x-8 overflow-x-auto bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-20 mb-8 border-b border-slate-200 dark:border-slate-800 scrollbar-hide">
          {[
            { id: 'companies', label: t('superadmin.companies'), icon: 'corporate_fare' },
            { id: 'users', label: t('superadmin.global_users'), icon: 'groups' },
            { id: 'calls', label: t('superadmin.global_calls'), icon: 'call' },
            { id: 'teams', label: t('nav.teams'), icon: 'hub' },
            { id: 'scripts', label: t('scripts.title'), icon: 'description' },
            { id: 'redis', label: t('superadmin.redis_manager'), icon: 'database' },
            { id: 'system', label: t('superadmin.system_health'), icon: 'health_and_safety' },
            { id: 'leadership', label: t('superadmin.global_rating'), icon: 'leaderboard' },
            { id: 'subscriptions', label: t('superadmin.subscriptions'), icon: 'payments' },
          ].map(tabItem => (
            <button
              key={tabItem.id}
              onClick={() => {
                navigate(`/super-admin/${tabItem.id}`);
                setSelectedCompany(null);
              }}
              className={`flex items-center gap-2 px-1 py-4 text-sm font-bold transition-all whitespace-nowrap border-b-2 ${
                activeTab === tabItem.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <span className="material-symbols-outlined text-xl">{tabItem.icon}</span>
              {tabItem.label}
            </button>
          ))}
        </nav>

        {/* Main Content */}
        <main className="min-w-0">
          {selectedCompany ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4 mb-2">
                <button
                  onClick={() => setSelectedCompany(null)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                  <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h2 className="text-2xl font-bold">{selectedCompany.company.name}</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800/50 shadow-sm">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">groups</span>
                    {t('superadmin.users')}
                  </h3>
                  <div className="space-y-3">
                    {selectedCompany.users.map(u => (
                      <div key={u.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800/50 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700/50">
                        <div>
                          <p className="font-bold text-sm">{u.email}</p>
                          <p className="text-xs text-slate-500 uppercase">{u.role}</p>
                        </div>
                        <span className={`w-2 h-2 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800/50 shadow-sm">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">settings_input_component</span>
                    {t('settings.integrations')}
                  </h3>
                  <div className="space-y-3">
                    {selectedCompany.integrations.map((i, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800/50 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700/50">
                        <div>
                          <p className="font-bold text-sm uppercase">{i.integration_type}</p>
                          <p className="text-xs text-slate-500">{t('settings.connected')}</p>
                        </div>
                        <span className="material-symbols-outlined text-emerald-500">check_circle</span>
                      </div>
                    ))}
                    {selectedCompany.integrations.length === 0 && (
                      <p className="text-sm text-slate-500 text-center py-4">{t('integrations.no_active')}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {activeTab === 'companies' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/50 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-border-light dark:border-slate-800 flex justify-between items-center">
                    <h3 className="text-xl font-bold">{t('superadmin.companies')}</h3>
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                        <input
                          type="text"
                          placeholder={t('common.search')}
                          className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary w-64"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  {loading ? (
                    <div className="p-8 space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
                  ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/50 dark:bg-slate-800/30 text-slate-500 text-xs font-bold uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">{t('superadmin.company_name')}</th>
                                    <th className="px-6 py-4">ID</th>
                                    <th className="px-6 py-4">{t('superadmin.created_at')}</th>
                                    <th className="px-6 py-4">{t('common.status')}</th>
                                    <th className="px-6 py-4 text-right">{t('common.actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-light dark:divide-slate-800">
                                {companies.map(c => (
                                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4">
                                      <div className="flex flex-col">
                                        <span className="font-bold text-slate-900 dark:text-white">{c.name}</span>
                                        <span className="text-xs text-slate-500">{c.industry || t('common.no_industry')}</span>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 text-xs font-mono text-slate-400">{c.id}</td>
                                    <td className="px-6 py-4 text-sm text-slate-500">{c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</td>
                                    <td className="px-6 py-4">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${c.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                        {c.is_active ? t('superadmin.active') : t('common.inactive')}
                                    </span>
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-4">
                                        <button
                                            onClick={() => setEditingCompany(c)}
                                            className="text-slate-500 font-bold text-sm hover:underline"
                                        >
                                            {t('common.edit')}
                                        </button>
                                        <button
                                            onClick={() => handleViewCompany(c.id)}
                                            className="text-primary font-bold text-sm hover:underline"
                                        >
                                            {t('superadmin.view_details')}
                                        </button>
                                    </td>
                                </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                  )}
                  <Pagination
                    currentPage={page}
                    totalPages={Math.ceil(total / limit)}
                    onPageChange={setPage}
                    totalResults={total}
                    limit={limit}
                  />
                </div>
              )}

              {activeTab === 'redis' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/50 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-border-light dark:border-slate-800 flex justify-between items-center">
                    <h3 className="text-xl font-bold">{t('superadmin.redis_keys')}</h3>
                    <button onClick={fetchRedisKeys} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                      <span className="material-symbols-outlined">refresh</span>
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/50 dark:bg-slate-800/30 text-slate-500 text-xs font-bold uppercase tracking-wider">
                        <tr>
                            <th className="px-6 py-4">Key</th>
                            <th className="px-6 py-4">Type</th>
                            <th className="px-6 py-4 text-right">{t('common.actions')}</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-border-light dark:divide-slate-800">
                        {redisKeys.map(k => (
                            <tr key={k.key} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors font-mono text-sm">
                            <td className="px-6 py-4 truncate max-w-xs" title={k.key}>{k.key}</td>
                            <td className="px-6 py-4 uppercase"><span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded">{k.type}</span></td>
                            <td className="px-6 py-4 text-right space-x-4">
                                <button onClick={() => handleEditRedis(k.key)} className="text-primary font-bold hover:underline">{t('common.edit')}</button>
                                <button onClick={() => handleDeleteRedis(k.key)} className="text-red-500 font-bold hover:underline">{t('common.delete')}</button>
                            </td>
                            </tr>
                        ))}
                        {redisKeys.length === 0 && (
                            <tr>
                                <td colSpan={3} className="px-6 py-12 text-center text-slate-500">No Redis keys found</td>
                            </tr>
                        )}
                        </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'users' && (
                 <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/50 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-border-light dark:border-slate-800 flex justify-between items-center">
                      <h3 className="text-xl font-bold">{t('superadmin.global_users')}</h3>
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                          <input
                            type="text"
                            placeholder={t('common.search')}
                            className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary w-64"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                        <thead className="bg-slate-50/50 dark:bg-slate-800/30 text-slate-500 text-xs font-bold uppercase tracking-wider">
                            <tr>
                            <th className="px-6 py-4">{t('common.email')}</th>
                            <th className="px-6 py-4">ID</th>
                            <th className="px-6 py-4">{t('superadmin.company_id')}</th>
                            <th className="px-6 py-4">{t('common.role')}</th>
                            <th className="px-6 py-4 text-right">{t('common.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-light dark:divide-slate-800">
                            {users.map(u => (
                            <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="px-6 py-4">
                                  <div className="flex flex-col">
                                    <span className="font-bold text-slate-900 dark:text-white">{u.email}</span>
                                    <span className="text-xs text-slate-500">{(u.first_name || u.last_name) ? `${u.first_name} ${u.last_name}` : t('common.no_name')}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-xs font-mono text-slate-400">{u.id}</td>
                                <td className="px-6 py-4 text-xs font-mono text-slate-400">{u.company_id}</td>
                                <td className="px-6 py-4 uppercase">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    u.role === 'super_admin' ? 'bg-purple-100 text-purple-800' :
                                    u.role === 'tenant_admin' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-800'
                                  }`}>
                                    {u.role}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-right space-x-4">
                                    <button onClick={() => setEditingUser(u)} className="text-primary font-bold text-sm hover:underline">{t('common.edit')}</button>
                                    <button onClick={() => setDeletingUser(u)} className="text-red-500 font-bold text-sm hover:underline">{t('common.delete')}</button>
                                </td>
                            </tr>
                            ))}
                        </tbody>
                        </table>
                    </div>
                    <Pagination
                      currentPage={page}
                      totalPages={Math.ceil(total / limit)}
                      onPageChange={setPage}
                      totalResults={total}
                      limit={limit}
                    />
                 </div>
              )}

              {activeTab === 'calls' && (
                 <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/50 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-border-light dark:border-slate-800">
                      <h3 className="text-xl font-bold">{t('superadmin.global_calls')}</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                        <thead className="bg-slate-50/50 dark:bg-slate-800/30 text-slate-500 text-xs font-bold uppercase tracking-wider">
                            <tr>
                            <th className="px-6 py-4">ID</th>
                            <th className="px-6 py-4">{t('superadmin.company_id')}</th>
                                    <th className="px-6 py-4">{t('nav.calls')}</th>
                            <th className="px-6 py-4">{t('common.status')}</th>
                            <th className="px-6 py-4">{t('sheet_calls.table.date')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-light dark:divide-slate-800 font-mono text-xs">
                            {allCalls.map(c => (
                            <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="px-6 py-4">{c.id}</td>
                                <td className="px-6 py-4 text-xs font-mono text-slate-400">{c.company_id}</td>
                                <td className="px-6 py-4">
                                  <div className="flex flex-col">
                                    <span className="font-bold text-slate-900 dark:text-white">{c.manager_name || t('common.no_manager')}</span>
                                    <span className="text-[10px] text-slate-500">{c.client_phone}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    c.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                                    c.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                                    c.status === 'error' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-800'
                                  }`}>
                                    {c.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4">{new Date(c.created_at).toLocaleString()}</td>
                            </tr>
                            ))}
                        </tbody>
                        </table>
                    </div>
                    <Pagination
                      currentPage={page}
                      totalPages={Math.ceil(total / limit)}
                      onPageChange={setPage}
                      totalResults={total}
                      limit={limit}
                    />
                 </div>
              )}

              {activeTab === 'teams' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/50 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-border-light dark:border-slate-800 flex justify-between items-center">
                    <h3 className="text-xl font-bold">{t('nav.teams')}</h3>
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                        <input
                          type="text"
                          placeholder={t('common.search')}
                          className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary w-64"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/50 dark:bg-slate-800/30 text-slate-500 text-xs font-bold uppercase tracking-wider">
                        <tr>
                            <th className="px-6 py-4">{t('common.name')}</th>
                            <th className="px-6 py-4">ID</th>
                            <th className="px-6 py-4">{t('superadmin.company_id')}</th>
                            <th className="px-6 py-4">{t('sheet_calls.table.date')}</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-border-light dark:divide-slate-800">
                        {teams.map(team => (
                            <tr key={team.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-6 py-4 font-bold">{team.name}</td>
                            <td className="px-6 py-4 text-xs font-mono text-slate-400">{team.id}</td>
                            <td className="px-6 py-4 text-xs font-mono text-slate-400">{team.company_id}</td>
                            <td className="px-6 py-4 text-sm text-slate-500">{team.created_at ? new Date(team.created_at).toLocaleDateString() : '—'}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                  </div>
                  <Pagination
                    currentPage={page}
                    totalPages={Math.ceil(total / limit)}
                    onPageChange={setPage}
                    totalResults={total}
                    limit={limit}
                  />
                </div>
              )}

              {activeTab === 'scripts' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/50 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-border-light dark:border-slate-800 flex justify-between items-center">
                    <h3 className="text-xl font-bold">{t('scripts.title')}</h3>
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                        <input
                          type="text"
                          placeholder={t('common.search')}
                          className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-primary w-64"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/50 dark:bg-slate-800/30 text-slate-500 text-xs font-bold uppercase tracking-wider">
                        <tr>
                            <th className="px-6 py-4">{t('common.name')}</th>
                            <th className="px-6 py-4">ID</th>
                            <th className="px-6 py-4">{t('superadmin.company_id')}</th>
                            <th className="px-6 py-4">{t('common.status')}</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-border-light dark:divide-slate-800">
                        {scripts.map(script => (
                            <tr key={script.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-6 py-4 font-bold">{script.name}</td>
                            <td className="px-6 py-4 text-xs font-mono text-slate-400">{script.id}</td>
                            <td className="px-6 py-4 text-xs font-mono text-slate-400">{script.company_id}</td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${script.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'}`}>
                                {script.is_active ? t('scripts.active') : t('common.inactive')}
                                </span>
                            </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                  </div>
                  <Pagination
                    currentPage={page}
                    totalPages={Math.ceil(total / limit)}
                    onPageChange={setPage}
                    totalResults={total}
                    limit={limit}
                  />
                </div>
              )}

              {activeTab === 'system' && systemStatus && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800/50 shadow-sm">
                    <h3 className="text-lg font-bold mb-4">{t('superadmin.queue_metrics')}</h3>
                    <div className="space-y-4">
                      {Object.entries(systemStatus.queues).map(([name, len]) => (
                        <div key={name} className="flex justify-between items-center p-4 bg-white dark:bg-slate-800/50 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700/50">
                          <span className="font-mono text-sm">{name}</span>
                          <span className="text-2xl font-bold text-primary">{len}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800/50 shadow-sm flex flex-col justify-center items-center">
                    <p className="text-slate-500 font-bold uppercase text-xs mb-2">{t('superadmin.overall_status')}</p>
                    <h2 className="text-4xl font-black text-emerald-500 uppercase">{systemStatus.status}</h2>
                  </div>
                </div>
              )}

              {activeTab === 'leadership' && <Leaderboard teamId="" />}

              {activeTab === 'subscriptions' && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/50 shadow-sm p-12 text-center text-slate-500">
                  <span className="material-symbols-outlined text-4xl mb-4">payments</span>
                  <p>{t('superadmin.sub_mgmt_soon')}</p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {editingRedis && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 w-full max-w-2xl shadow-2xl border border-border-light dark:border-slate-800">
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">edit</span>
              {t('superadmin.edit_redis_value')}
            </h3>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-500 uppercase mb-2">Key</label>
                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg font-mono text-sm select-all">
                  {editingRedis.key}
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-500 uppercase mb-2">{t('superadmin.key_json_or_string')}</label>
                <textarea
                  className="w-full h-64 border rounded-xl p-4 font-mono text-sm dark:bg-slate-800 dark:border-slate-700 focus:ring-2 focus:ring-primary outline-none transition-all"
                  value={editingRedis.value}
                  onChange={e => setEditingRedis({ ...editingRedis, value: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-3 mt-8">
                <button
                  onClick={() => setEditingRedis(null)}
                  className="px-6 py-2.5 font-bold text-slate-500 hover:text-slate-700 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleUpdateRedis}
                  className="px-8 py-2.5 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/30 hover:scale-[1.02] transition-all"
                >
                  {t('superadmin.update_key')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingCompany && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-900 rounded-xl p-8 w-full max-w-md shadow-2xl border border-border-light dark:border-slate-800">
                  <h3 className="text-xl font-bold mb-6">Edit Company</h3>
                  <form onSubmit={handleUpdateCompany} className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium mb-1">Name</label>
                          <input
                            className="w-full border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 outline-none focus:ring-2 focus:ring-primary"
                            value={editingCompany.name}
                            onChange={e => setEditingCompany({...editingCompany, name: e.target.value})}
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-medium mb-1">Managers Count</label>
                          <input
                            type="number"
                            className="w-full border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 outline-none focus:ring-2 focus:ring-primary"
                            value={editingCompany.managers_count || 0}
                            onChange={e => setEditingCompany({...editingCompany, managers_count: parseInt(e.target.value)})}
                          />
                      </div>
                      <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="company-active"
                            className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary"
                            checked={editingCompany.is_active}
                            onChange={e => setEditingCompany({...editingCompany, is_active: e.target.checked})}
                          />
                          <label htmlFor="company-active" className="text-sm font-medium">{t('superadmin.active')}</label>
                      </div>
                      <div className="flex justify-end gap-3 mt-8">
                          <button type="button" onClick={() => setEditingCompany(null)} className="px-4 py-2 border rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                          <button type="submit" className="px-6 py-2 bg-primary text-white rounded-lg font-bold">Save</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {deletingUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 w-full max-w-md shadow-2xl border border-border-light dark:border-slate-800">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6 mx-auto">
              <span className="material-symbols-outlined text-red-500 text-3xl">delete_forever</span>
            </div>
            <h3 className="text-xl font-bold mb-2 text-center">{t('common.delete_confirm')}</h3>
            <p className="text-slate-500 text-center mb-8">
              {t('superadmin.delete_user_warning', { email: deletingUser.email })}
              <br />
              <span className="text-xs font-bold text-red-500 uppercase mt-2 block">{t('common.irreversible')}</span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingUser(null)}
                className="flex-1 px-4 py-2.5 font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDeleteUser}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl font-bold shadow-lg shadow-red-500/30 hover:bg-red-600 transition-all"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingUser && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-900 rounded-xl p-8 w-full max-w-md shadow-2xl border border-border-light dark:border-slate-800">
                  <h3 className="text-xl font-bold mb-6">Edit User</h3>
                  <form onSubmit={handleUpdateUser} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">First Name</label>
                            <input
                                className="w-full border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700"
                                value={editingUser.first_name || ''}
                                onChange={e => setEditingUser({...editingUser, first_name: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Last Name</label>
                            <input
                                className="w-full border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700"
                                value={editingUser.last_name || ''}
                                onChange={e => setEditingUser({...editingUser, last_name: e.target.value})}
                            />
                        </div>
                      </div>
                      <div>
                          <label className="block text-sm font-medium mb-1">Role</label>
                          <select
                            className="w-full border rounded-lg p-2 dark:bg-slate-800 dark:border-slate-700 outline-none"
                            value={editingUser.role}
                            onChange={e => setEditingUser({...editingUser, role: e.target.value})}
                          >
                              <option value="sales_rep">Sales Rep</option>
                              <option value="tenant_admin">Tenant Admin</option>
                              <option value="super_admin">Super Admin</option>
                          </select>
                      </div>
                      <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="user-active"
                            className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary"
                            checked={editingUser.is_active}
                            onChange={e => setEditingUser({...editingUser, is_active: e.target.checked})}
                          />
                          <label htmlFor="user-active" className="text-sm font-medium">{t('superadmin.active')}</label>
                      </div>
                      <div className="flex justify-end gap-3 mt-8">
                          <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 border rounded-lg">Cancel</button>
                          <button type="submit" className="px-6 py-2 bg-primary text-white rounded-lg font-bold">Save</button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </PageLayout>
  );
};
