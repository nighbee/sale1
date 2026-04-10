import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
import { Leaderboard } from '../../../widgets/Leaderboard';

type TabType = 'companies' | 'users' | 'calls' | 'teams' | 'scripts' | 'redis' | 'system' | 'leadership' | 'subscriptions';

export const SuperAdminPage: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('companies');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [allCalls, setAllCalls] = useState<Call[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [redisKeys, setRedisKeys] = useState<{ key: string; type: string }[]>([]);
  const [systemStatus, setSystemStatus] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const [selectedCompany, setSelectedCompany] = useState<{
    company: Company;
    users: User[];
    integrations: Integration[];
  } | null>(null);

  const [editingRedis, setEditingRedis] = useState<{ key: string; value: string } | null>(null);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);

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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (activeTab === 'companies') {
          const res = await companyApi.listAllCompanies();
          setCompanies(res.data.companies || []);
        } else if (activeTab === 'users') {
          const res = await userApi.listAllUsers();
          setUsers(res.data.users || []);
        } else if (activeTab === 'calls') {
          const res = await callApi.listAllCalls();
          setAllCalls(res.data.calls || []);
        } else if (activeTab === 'teams') {
          const res = await teamApi.listAllTeams();
          setTeams(res.data.teams || []);
        } else if (activeTab === 'scripts') {
          const res = await scriptApi.listAllScripts();
          setScripts(res.data.scripts || []);
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
  }, [activeTab]);

  return (
    <PageLayout title={t('superadmin.title')}>
      <div className="flex flex-col lg:flex-row gap-8 p-4 md:p-8">
        {/* Sidebar Navigation */}
        <aside className="w-full lg:w-64 flex-shrink-0">
          <nav className="bg-white dark:bg-slate-900 rounded-xl border border-border-light dark:border-slate-800 p-2 shadow-sm sticky top-24">
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
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as TabType);
                  setSelectedCompany(null);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all mb-1 ${
                  activeTab === tab.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <span className="material-symbols-outlined text-xl">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-grow min-w-0">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-border-light dark:border-slate-800 shadow-sm">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">groups</span>
                    {t('superadmin.users')}
                  </h3>
                  <div className="space-y-3">
                    {selectedCompany.users.map(u => (
                      <div key={u.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <div>
                          <p className="font-bold text-sm">{u.email}</p>
                          <p className="text-xs text-slate-500 uppercase">{u.role}</p>
                        </div>
                        <span className={`w-2 h-2 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-border-light dark:border-slate-800 shadow-sm">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">settings_input_component</span>
                    {t('settings.integrations')}
                  </h3>
                  <div className="space-y-3">
                    {selectedCompany.integrations.map((i, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
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
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-border-light dark:border-slate-800 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-border-light dark:border-slate-800">
                    <h3 className="text-xl font-bold">{t('superadmin.companies')}</h3>
                  </div>
                  {loading ? (
                    <div className="p-8 space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
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
                                {companies.map(c => (
                                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4 font-bold">{c.name}</td>
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
                </div>
              )}

              {activeTab === 'redis' && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-border-light dark:border-slate-800 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-border-light dark:border-slate-800 flex justify-between items-center">
                    <h3 className="text-xl font-bold">{t('superadmin.redis_keys')}</h3>
                    <button onClick={fetchRedisKeys} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                      <span className="material-symbols-outlined">refresh</span>
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs font-bold uppercase tracking-wider">
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
                 <div className="bg-white dark:bg-slate-900 rounded-xl border border-border-light dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                            <tr>
                            <th className="px-6 py-4">{t('common.email')}</th>
                            <th className="px-6 py-4">{t('superadmin.company_id')}</th>
                            <th className="px-6 py-4">{t('common.role')}</th>
                            <th className="px-6 py-4 text-right">{t('common.actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-light dark:divide-slate-800">
                            {users.map(u => (
                            <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="px-6 py-4 font-bold">{u.email}</td>
                                <td className="px-6 py-4 text-xs font-mono">{u.company_id}</td>
                                <td className="px-6 py-4 uppercase text-xs font-bold">{u.role}</td>
                                <td className="px-6 py-4 text-right">
                                    <button onClick={() => setEditingUser(u)} className="text-primary font-bold text-sm hover:underline">{t('common.edit')}</button>
                                </td>
                            </tr>
                            ))}
                        </tbody>
                        </table>
                    </div>
                 </div>
              )}

              {activeTab === 'calls' && (
                 <div className="bg-white dark:bg-slate-900 rounded-xl border border-border-light dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                            <tr>
                            <th className="px-6 py-4">ID</th>
                            <th className="px-6 py-4">{t('superadmin.company_id')}</th>
                            <th className="px-6 py-4">{t('common.status')}</th>
                            <th className="px-6 py-4">{t('sheet_calls.table.date')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-light dark:divide-slate-800 font-mono text-xs">
                            {allCalls.map(c => (
                            <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="px-6 py-4">{c.id}</td>
                                <td className="px-6 py-4">{c.company_id}</td>
                                <td className="px-6 py-4 uppercase">{c.status}</td>
                                <td className="px-6 py-4">{new Date(c.created_at).toLocaleString()}</td>
                            </tr>
                            ))}
                        </tbody>
                        </table>
                    </div>
                 </div>
              )}

              {activeTab === 'teams' && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-border-light dark:border-slate-800 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                        <tr>
                            <th className="px-6 py-4">{t('common.name')}</th>
                            <th className="px-6 py-4">{t('superadmin.company_id')}</th>
                            <th className="px-6 py-4">{t('sheet_calls.table.date')}</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-border-light dark:divide-slate-800">
                        {teams.map(team => (
                            <tr key={team.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-6 py-4 font-bold">{team.name}</td>
                            <td className="px-6 py-4 text-xs font-mono">{team.company_id}</td>
                            <td className="px-6 py-4 text-sm text-slate-500">{team.created_at ? new Date(team.created_at).toLocaleDateString() : '—'}</td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'scripts' && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-border-light dark:border-slate-800 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                        <tr>
                            <th className="px-6 py-4">{t('common.name')}</th>
                            <th className="px-6 py-4">{t('superadmin.company_id')}</th>
                            <th className="px-6 py-4">{t('common.status')}</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-border-light dark:divide-slate-800">
                        {scripts.map(script => (
                            <tr key={script.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-6 py-4 font-bold">{script.name}</td>
                            <td className="px-6 py-4 text-xs font-mono">{script.company_id}</td>
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
                </div>
              )}

              {activeTab === 'system' && systemStatus && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-border-light dark:border-slate-800 shadow-sm">
                    <h3 className="text-lg font-bold mb-4">{t('superadmin.queue_metrics')}</h3>
                    <div className="space-y-4">
                      {Object.entries(systemStatus.queues).map(([name, len]) => (
                        <div key={name} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                          <span className="font-mono text-sm">{name}</span>
                          <span className="text-2xl font-bold text-primary">{len}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-border-light dark:border-slate-800 shadow-sm flex flex-col justify-center items-center">
                    <p className="text-slate-500 font-bold uppercase text-xs mb-2">{t('superadmin.overall_status')}</p>
                    <h2 className="text-4xl font-black text-emerald-500 uppercase">{systemStatus.status}</h2>
                  </div>
                </div>
              )}

              {activeTab === 'leadership' && <Leaderboard teamId="" />}

              {activeTab === 'subscriptions' && (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-border-light dark:border-slate-800 shadow-sm p-12 text-center text-slate-500">
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
                            onChange={e => setEditingUser({...editingUser, role: e.target.value as any})}
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
