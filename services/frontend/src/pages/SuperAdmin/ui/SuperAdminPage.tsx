import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import Input from '../../../shared/ui/Input';
import Select from '../../../shared/ui/Select';
import Checkbox from '../../../shared/ui/Checkbox';
import { Leaderboard } from '../../../widgets/Leaderboard';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';

type TabType = 'companies' | 'users' | 'calls' | 'teams' | 'scripts' | 'redis' | 'system' | 'leadership' | 'subscriptions';

const companySchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  managers_count: z.number().min(0),
  is_active: z.boolean(),
});

const userSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  role: z.string().min(1, 'Role is required'),
  is_active: z.boolean(),
});

type CompanyFormValues = z.infer<typeof companySchema>;
type UserFormValues = z.infer<typeof userSchema>;

export const SuperAdminPage: React.FC = () => {
  const { t } = useTranslation();
  const { tab } = useParams<{ tab: string }>();
  const navigate = useNavigate();
  const activeTab = (tab as TabType) || 'companies';

  const {
    register: registerCompany,
    handleSubmit: handleCompanySubmit,
    reset: resetCompanyForm,
    formState: { errors: companyErrors },
  } = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
  });

  const {
    register: registerUser,
    handleSubmit: handleUserSubmit,
    reset: resetUserForm,
    formState: { errors: userErrors },
  } = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
  });

  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [allCalls, setAllCalls] = useState<Call[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [redisKeys, setRedisKeys] = useState<{ key: string; type: string }[]>([]);
  const [systemStatus, setSystemStatus] = useState<QueueStatus | null>(null);
  const [expandedQueue, setExpandedQueue] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
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

  const handleClearQueue = async (queue: string, all: boolean = false) => {
    if (!window.confirm(all ? 'Clear all queues?' : `Clear queue ${queue}?`)) return;
    try {
      await systemApi.clearQueue(queue, all);
      const res = await systemApi.getStatus();
      setSystemStatus(res.data);
    } catch (err) {
      console.error('Failed to clear queue', err);
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

  const onUpdateCompany = async (data: CompanyFormValues) => {
    if (!editingCompany) return;
    try {
        await companyApi.updateCompanyGlobal(editingCompany.id, { ...editingCompany, ...data });
        setCompanies(companies.map(c => c.id === editingCompany.id ? { ...c, ...data } : c));
        setEditingCompany(null);
    } catch (err) {
        console.error('Failed to update company', err);
    }
  };

  const onUpdateUser = async (data: UserFormValues) => {
    if (!editingUser) return;
    try {
        await userApi.updateUserGlobal(editingUser.id, { ...editingUser, ...data });
        setUsers(users.map(u => u.id === editingUser.id ? { ...u, ...data } : u));
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
    if (editingCompany) {
      resetCompanyForm({
        name: editingCompany.name,
        managers_count: editingCompany.managers_count || 0,
        is_active: editingCompany.is_active,
      });
    }
  }, [editingCompany, resetCompanyForm]);

  useEffect(() => {
    if (editingUser) {
      resetUserForm({
        first_name: editingUser.first_name || '',
        last_name: editingUser.last_name || '',
        role: editingUser.role,
        is_active: editingUser.is_active,
      });
    }
  }, [editingUser, resetUserForm]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = { page, limit, search };
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
          const [statusRes, metricsRes, logsRes] = await Promise.all([
            systemApi.getStatus(),
            systemApi.getMetrics(),
            systemApi.getLogs(50)
          ]);
          setSystemStatus(statusRes.data);
          setMetrics(metricsRes.data);
          setLogs(logsRes.data?.logs?.data?.result || []);
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
    <PageLayout title={t('superadmin.title')} showSearch={false}>
      <div className="max-w-[1600px] mx-auto w-full p-8 space-y-8">
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
                            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
                                <tr>
                                    <th className="px-8 py-5">{t('superadmin.company_name')}</th>
                                    <th className="px-8 py-5">ID</th>
                                    <th className="px-8 py-5">{t('superadmin.created_at')}</th>
                                    <th className="px-8 py-5">{t('common.status')}</th>
                                    <th className="px-8 py-5 text-right">{t('common.actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                {companies.map(c => (
                                <tr key={c.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all duration-300">
                                    <td className="px-8 py-6">
                                      <div className="flex flex-col">
                                        <span className="font-black text-slate-900 dark:text-white group-hover:text-primary transition-colors">{c.name}</span>
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{c.industry || t('common.no_industry')}</span>
                                      </div>
                                    </td>
                                    <td className="px-8 py-6">
                                      <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg text-[10px] font-mono border border-slate-200 dark:border-slate-700">
                                        {c.id.split('-')[0]}...
                                      </span>
                                    </td>
                                    <td className="px-8 py-6 text-sm text-slate-500 font-medium">{c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</td>
                                    <td className="px-8 py-6">
                                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                        c.is_active ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'
                                      }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${c.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                        {c.is_active ? t('superadmin.active') : t('common.inactive')}
                                      </div>
                                    </td>
                                    <td className="px-8 py-6 text-right space-x-2">
                                        <button
                                            onClick={() => setEditingCompany(c)}
                                            className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                                            title={t('common.edit')}
                                        >
                                            <span className="material-symbols-outlined text-xl">edit</span>
                                        </button>
                                        <button
                                            onClick={() => handleViewCompany(c.id)}
                                            className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-xl transition-all"
                                            title={t('superadmin.view_details')}
                                        >
                                            <span className="material-symbols-outlined text-xl">visibility</span>
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
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800/50 shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
                    <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/30 dark:bg-slate-800/10">
                      <h3 className="text-xl font-black uppercase italic tracking-tight flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                          <span className="material-symbols-outlined">queue</span>
                        </span>
                        {t('superadmin.active_queues')}
                      </h3>
                      <button
                        onClick={() => handleClearQueue('', true)}
                        className="px-6 py-2.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-red-500/20 shadow-lg shadow-red-500/10"
                      >
                        <span className="material-symbols-outlined text-sm">delete_sweep</span>
                        {t('superadmin.clear_all_queues')}
                      </button>
                    </div>
                    <div className="p-8">
                      {systemStatus ? (
                        <div className="space-y-4">
                          {Object.entries(systemStatus.queues).map(([name, len]) => (
                            <div key={name} className="bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-slate-700/50 overflow-hidden transition-all duration-300">
                              <div className="p-6 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${len > 0 ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                    <span className="material-symbols-outlined">{len > 0 ? 'pending_actions' : 'check_circle'}</span>
                                  </div>
                                  <div>
                                    <p className="font-mono text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{name}</p>
                                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mt-0.5">{t('superadmin.messages_pending', { count: len })}</p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setExpandedQueue(expandedQueue === name ? null : name)}
                                    className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold hover:border-primary hover:text-primary transition-all flex items-center gap-2 shadow-sm"
                                  >
                                    <span className="material-symbols-outlined text-sm">{expandedQueue === name ? 'expand_less' : 'expand_more'}</span>
                                    {expandedQueue === name ? t('superadmin.hide_metadata') : t('superadmin.view_metadata')}
                                  </button>
                                  <button
                                    onClick={() => handleClearQueue(name)}
                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                                    title="Clear this queue"
                                  >
                                    <span className="material-symbols-outlined">delete_outline</span>
                                  </button>
                                </div>
                              </div>

                              {expandedQueue === name && (
                                <div className="px-8 pb-8 pt-2 border-t border-slate-100 dark:border-slate-700/50 bg-white/50 dark:bg-slate-900/30">
                                  <div className="space-y-4">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                      <span className="material-symbols-outlined text-sm">database</span>
                                      {t('superadmin.recent_payloads')}
                                    </h4>
                                    <div className="space-y-3">
                                      {(systemStatus as any).metadata?.[name]?.length > 0 ? (
                                        (systemStatus as any).metadata[name].map((item: any, idx: number) => (
                                          <div key={idx} className="bg-slate-950 rounded-2xl p-5 border border-white/5 font-mono text-[11px] overflow-x-auto shadow-inner">
                                            <div className="flex justify-between items-center mb-3 opacity-50">
                                              <span className="text-primary uppercase font-bold tracking-tighter">{t('superadmin.payload')} #{idx + 1}</span>
                                              <span className="text-[10px]">{typeof item === 'object' ? t('superadmin.json_object') : t('superadmin.raw_string')}</span>
                                            </div>
                                            <pre className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                                              {JSON.stringify(item, null, 2)}
                                            </pre>
                                          </div>
                                        ))
                                      ) : (
                                        <div className="py-8 text-center bg-slate-100/50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                                          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest italic">{t('superadmin.queue_empty')}</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12 text-slate-500">
                          <button onClick={() => navigate('/super-admin/system')} className="text-primary font-bold hover:underline">
                            {t('superadmin.load_system_status')}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/50 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-border-light dark:border-slate-800 flex justify-between items-center bg-slate-50/30 dark:bg-slate-800/20">
                      <h3 className="text-xl font-bold flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">database</span>
                        {t('superadmin.redis_keys')}
                      </h3>
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
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
                            <tr>
                            <th className="px-8 py-5">{t('common.email')}</th>
                            <th className="px-8 py-5">ID</th>
                            <th className="px-8 py-5">{t('superadmin.company_id')}</th>
                            <th className="px-8 py-5">{t('common.role')}</th>
                            <th className="px-8 py-5 text-right">{t('common.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {users.map(u => (
                            <tr key={u.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all duration-300">
                                <td className="px-8 py-6">
                                  <div className="flex flex-col">
                                    <span className="font-black text-slate-900 dark:text-white group-hover:text-primary transition-colors">{u.email}</span>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{(u.first_name || u.last_name) ? `${u.first_name} ${u.last_name}` : t('common.no_name')}</span>
                                  </div>
                                </td>
                                <td className="px-8 py-6">
                                  <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg text-[10px] font-mono border border-slate-200 dark:border-slate-700">
                                    {u.id.split('-')[0]}...
                                  </span>
                                </td>
                                <td className="px-8 py-6">
                                  <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg text-[10px] font-mono border border-slate-200 dark:border-slate-700">
                                    {u.company_id.split('-')[0]}...
                                  </span>
                                </td>
                                <td className="px-8 py-6 uppercase">
                                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                    u.role === 'super_admin' ? 'bg-purple-500/10 text-purple-500 border border-purple-500/20' :
                                    u.role === 'tenant_admin' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'
                                  }`}>
                                    {u.role}
                                  </span>
                                </td>
                                <td className="px-8 py-6 text-right space-x-2">
                                    <button
                                      onClick={() => setEditingUser(u)}
                                      className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                                      title={t('common.edit')}
                                    >
                                      <span className="material-symbols-outlined text-xl">edit</span>
                                    </button>
                                    <button
                                      onClick={() => setDeletingUser(u)}
                                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                                      title={t('common.delete')}
                                    >
                                      <span className="material-symbols-outlined text-xl">delete</span>
                                    </button>
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
                    <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/30 dark:bg-slate-800/10">
                      <h3 className="text-xl font-black uppercase italic tracking-tight">{t('superadmin.global_calls')}</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
                            <tr>
                            <th className="px-8 py-5">ID</th>
                            <th className="px-8 py-5">{t('superadmin.company_id')}</th>
                                    <th className="px-8 py-5">{t('nav.calls')}</th>
                            <th className="px-8 py-5">{t('common.status')}</th>
                            <th className="px-8 py-5">{t('sheet_calls.table.date')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 font-mono text-xs">
                            {allCalls.map(c => (
                            <tr key={c.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all duration-300">
                                <td className="px-8 py-6">
                                  <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg text-[10px] font-mono border border-slate-200 dark:border-slate-700">
                                    {c.id.split('-')[0]}...
                                  </span>
                                </td>
                                <td className="px-8 py-6">
                                  <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg text-[10px] font-mono border border-slate-200 dark:border-slate-700">
                                    {c.company_id.split('-')[0]}...
                                  </span>
                                </td>
                                <td className="px-8 py-6">
                                  <div className="flex flex-col font-sans">
                                    <span className="font-black text-slate-900 dark:text-white group-hover:text-primary transition-colors">{c.manager_name || t('common.no_manager')}</span>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{c.client_phone}</span>
                                  </div>
                                </td>
                                <td className="px-8 py-6">
                                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                    c.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                                    c.status === 'processing' ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' :
                                    c.status === 'error' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'
                                  }`}>
                                    {c.status}
                                  </span>
                                </td>
                                <td className="px-8 py-6 text-slate-500 font-medium font-sans">{new Date(c.created_at).toLocaleString()}</td>
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
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs font-black uppercase tracking-[0.2em]">
                        <tr>
                            <th className="px-8 py-5">{t('common.name')}</th>
                            <th className="px-8 py-5">ID</th>
                            <th className="px-8 py-5">{t('superadmin.company_id')}</th>
                            <th className="px-8 py-5">{t('sheet_calls.table.date')}</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                        {teams.map(team => (
                            <tr key={team.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all duration-300">
                            <td className="px-8 py-6">
                              <span className="font-black text-slate-900 dark:text-white group-hover:text-primary transition-colors">{team.name}</span>
                            </td>
                            <td className="px-8 py-6">
                              <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg text-[10px] font-mono border border-slate-200 dark:border-slate-700">
                                {team.id.split('-')[0]}...
                              </span>
                            </td>
                            <td className="px-8 py-6">
                              <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg text-[10px] font-mono border border-slate-200 dark:border-slate-700">
                                {team.company_id?.split('-')[0] || '—'}
                              </span>
                            </td>
                            <td className="px-8 py-6 text-sm text-slate-500 font-medium">{team.created_at ? new Date(team.created_at).toLocaleDateString() : '—'}</td>
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
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs font-black uppercase tracking-[0.2em]">
                        <tr>
                            <th className="px-8 py-5">{t('common.name')}</th>
                            <th className="px-8 py-5">ID</th>
                            <th className="px-8 py-5">{t('superadmin.company_id')}</th>
                            <th className="px-8 py-5">{t('common.status')}</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                        {scripts.map(script => (
                            <tr key={script.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-all duration-300">
                            <td className="px-8 py-6">
                              <span className="font-black text-slate-900 dark:text-white group-hover:text-primary transition-colors">{script.name}</span>
                            </td>
                            <td className="px-8 py-6">
                              <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg text-[10px] font-mono border border-slate-200 dark:border-slate-700">
                                {script.id.split('-')[0]}...
                              </span>
                            </td>
                            <td className="px-8 py-6">
                              <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg text-[10px] font-mono border border-slate-200 dark:border-slate-700">
                                {script.company_id?.split('-')[0] || '—'}
                              </span>
                            </td>
                            <td className="px-8 py-6">
                                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                                  script.is_active ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${script.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                  {script.is_active ? t('scripts.active') : t('common.inactive')}
                                </div>
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

              {activeTab === 'system' && (
                <div className="space-y-8">
                  {/* Status & Quick Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800/50 shadow-sm flex flex-col items-center justify-center">
                      <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mb-2">{t('superadmin.overall_status')}</p>
                      <h2 className={`text-2xl font-black uppercase ${systemStatus?.status === 'healthy' ? 'text-emerald-500' : 'text-red-500'}`}>
                        {systemStatus?.status || 'Unknown'}
                      </h2>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800/50 shadow-sm">
                        <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mb-2">{t('superadmin.total_queues')}</p>
                      <h2 className="text-2xl font-black text-primary">{systemStatus ? Object.keys(systemStatus.queues).length : 0}</h2>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800/50 shadow-sm">
                      <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mb-2">{t('superadmin.pending_tasks')}</p>
                      <h2 className="text-2xl font-black text-amber-500">
                        {systemStatus ? Object.values(systemStatus.queues).reduce((a: number, b: number) => a + b, 0) : 0}
                      </h2>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800/50 shadow-sm">
                        <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mb-2">{t('superadmin.observability')}</p>
                        <h2 className="text-2xl font-black text-slate-400">Loki + Prom</h2>
                    </div>
                  </div>

                  {/* Hardware Metrics with Recharts */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800/50 shadow-sm">
                      <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">analytics</span>
                        CPU Usage by Container (%)
                      </h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={metrics?.cpu?.data?.result?.map((r: any) => ({
                            name: r.metric.container || 'host',
                            cpu: parseFloat(r.value[1]) * 100
                          })) || []}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                            <YAxis fontSize={10} axisLine={false} tickLine={false} />
                            <Tooltip
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                              cursor={{ fill: 'transparent' }}
                            />
                            <Bar dataKey="cpu" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                        {!metrics?.cpu && <p className="text-center text-slate-400 text-sm italic py-20">Fetching metrics from Prometheus...</p>}
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800/50 shadow-sm">
                      <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">memory</span>
                        Memory Usage (MB)
                      </h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={metrics?.memory?.data?.result?.map((r: any) => ({
                            name: r.metric.container || 'host',
                            mem: parseFloat(r.value[1]) / (1024 * 1024)
                          })) || []}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                            <YAxis fontSize={10} axisLine={false} tickLine={false} />
                            <Tooltip
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            />
                            <Area type="monotone" dataKey="mem" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.1} />
                          </AreaChart>
                        </ResponsiveContainer>
                        {!metrics?.memory && <p className="text-center text-slate-400 text-sm italic py-20">Fetching metrics from Prometheus...</p>}
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800/50 shadow-sm">
                      <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">terminal</span>
                        Live System Logs (Loki)
                      </h3>
                      <div className="bg-slate-950 rounded-xl p-4 font-mono text-[10px] h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
                        {logs && logs.length > 0 ? logs.map((stream, i) => (
                           <div key={i} className="mb-2">
                              {stream.values.map((v: any, j: number) => (
                                <p key={j} className="text-slate-300 hover:text-white transition-colors">
                                  <span className="text-slate-500">[{new Date(parseInt(v[0])/1000000).toLocaleTimeString()}]</span> {v[1]}
                                </p>
                              ))}
                           </div>
                        )) : (
                          <p className="text-slate-500 italic text-center py-20">Waiting for logs...</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Queue Detail List */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/50 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-border-light dark:border-slate-800">
                      <h3 className="text-lg font-bold">{t('superadmin.queue_metrics')}</h3>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {systemStatus && Object.entries(systemStatus.queues).map(([name, len]) => (
                        <div key={name} className="flex justify-between items-center p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <div>
                            <p className="font-mono text-sm font-bold">{name}</p>
                            <p className="text-[10px] text-slate-500">BullMQ / Redis Stream</p>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className={`text-xl font-black ${len > 0 ? 'text-amber-500' : 'text-slate-300'}`}>{len}</span>
                            <button onClick={() => handleClearQueue(name)} className="p-2 text-slate-400 hover:text-red-500">
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
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
                  <h3 className="text-xl font-bold mb-6">{t('superadmin.edit_company')}</h3>
                  <form onSubmit={handleCompanySubmit(onUpdateCompany)} className="space-y-6">
                      <Input
                        label={t('common.name')}
                        error={companyErrors.name?.message}
                        {...registerCompany('name')}
                      />
                      <Input
                        label={t('settings.managers_count')}
                        type="number"
                        error={companyErrors.managers_count?.message}
                        {...registerCompany('managers_count', { valueAsNumber: true })}
                      />
                      <Checkbox
                        label={t('superadmin.active')}
                        {...registerCompany('is_active')}
                      />
                      <div className="flex justify-end gap-3 mt-8">
                          <button
                            type="button"
                            onClick={() => setEditingCompany(null)}
                            className="px-6 py-2.5 font-bold text-slate-500 hover:text-slate-700 transition-colors"
                          >
                            {t('common.cancel')}
                          </button>
                          <button
                            type="submit"
                            className="px-8 py-2.5 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/30 hover:scale-[1.02] transition-all"
                          >
                            {t('common.save')}
                          </button>
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
                  <h3 className="text-xl font-bold mb-6">{t('users.edit_user')}</h3>
                  <form onSubmit={handleUserSubmit(onUpdateUser)} className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <Input
                          label={t('common.first_name')}
                          error={userErrors.first_name?.message}
                          {...registerUser('first_name')}
                        />
                        <Input
                          label={t('common.last_name')}
                          error={userErrors.last_name?.message}
                          {...registerUser('last_name')}
                        />
                      </div>
                      <Select
                        label={t('common.role')}
                        error={userErrors.role?.message}
                        options={[
                          { value: 'sales_rep', label: t('roles.sales_rep') },
                          { value: 'tenant_admin', label: t('roles.tenant_admin') },
                          { value: 'super_admin', label: t('roles.super_admin') },
                        ]}
                        {...registerUser('role')}
                      />
                      <Checkbox
                        label={t('superadmin.active')}
                        {...registerUser('is_active')}
                      />
                      <div className="flex justify-end gap-3 mt-8">
                          <button
                            type="button"
                            onClick={() => setEditingUser(null)}
                            className="px-6 py-2.5 font-bold text-slate-500 hover:text-slate-700 transition-colors"
                          >
                            {t('common.cancel')}
                          </button>
                          <button
                            type="submit"
                            className="px-8 py-2.5 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/30 hover:scale-[1.02] transition-all"
                          >
                            {t('common.save')}
                          </button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </PageLayout>
  );
};
