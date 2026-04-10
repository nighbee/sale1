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
import Skeleton from '../../../shared/ui/Skeleton';
import { Leaderboard } from '../../../widgets/Leaderboard';

type TabType = 'companies' | 'users' | 'calls' | 'teams' | 'scripts' | 'leadership' | 'system' | 'subscriptions';

export const SuperAdminPage: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('companies');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [allCalls, setAllCalls] = useState<Call[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [systemStatus, setSystemStatus] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);

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
      <div className="p-4 md:p-8">
        <div className="mb-8">
          <p className="text-slate-500 mt-2">{t('superadmin.subtitle')}</p>
        </div>

        <div className="flex border-b border-border-light dark:border-slate-800 mb-8 overflow-x-auto whitespace-nowrap">
          {[
            { id: 'companies', label: t('superadmin.companies') },
            { id: 'users', label: t('superadmin.users') },
            { id: 'calls', label: t('superadmin.call_list') },
            { id: 'teams', label: t('nav.teams') },
            { id: 'scripts', label: t('scripts.title') },
            { id: 'leadership', label: t('superadmin.leadership') },
            { id: 'system', label: t('common.system') },
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
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${company.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                                {company.is_active ? t('superadmin.active') : t('common.inactive')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                              onClick={() => setEditingCompany(company)}
                                              className="text-primary font-bold text-sm hover:underline"
                                            >
                                              {t('common.edit')}
                                            </button>
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
                                    <th className="px-6 py-4 text-right">{t('common.actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-light dark:divide-slate-800">
                                {users.map((user) => (
                                    <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4 font-semibold">{user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || t('common.not_available')}</td>
                                        <td className="px-6 py-4 text-sm text-slate-500">{user.email}</td>
                                        <td className="px-6 py-4 text-sm font-bold uppercase">{user.role}</td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                              onClick={() => setEditingUser(user)}
                                              className="text-primary font-bold text-sm hover:underline"
                                            >
                                              {t('common.edit')}
                                            </button>
                                        </td>
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
                                    <th className="px-6 py-4">ID</th>
                                    <th className="px-6 py-4">Company ID</th>
                                    <th className="px-6 py-4">Manager</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-light dark:divide-slate-800">
                                {allCalls.map((call) => (
                                    <tr key={call.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4 font-mono text-xs">{call.id}</td>
                                        <td className="px-6 py-4 font-mono text-xs">{call.company_id}</td>
                                        <td className="px-6 py-4">{call.manager_name}</td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800`}>
                                                {call.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-500">{new Date(call.created_at).toLocaleString()}</td>
                                    </tr>
                                ))}
                                {allCalls.length === 0 && (
                                  <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">No calls found</td>
                                  </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
          )}

          {activeTab === 'teams' && (
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
                                    <th className="px-6 py-4">Name</th>
                                    <th className="px-6 py-4">Company ID</th>
                                    <th className="px-6 py-4">Created At</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-light dark:divide-slate-800">
                                {teams.map((team) => (
                                    <tr key={team.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4 font-semibold">{team.name}</td>
                                        <td className="px-6 py-4 font-mono text-xs">{team.company_id}</td>
                                        <td className="px-6 py-4 text-sm text-slate-500">{team.created_at ? new Date(team.created_at).toLocaleDateString() : '—'}</td>
                                    </tr>
                                ))}
                                {teams.length === 0 && (
                                  <tr>
                                    <td colSpan={3} className="px-6 py-12 text-center text-slate-500">No teams found</td>
                                  </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
          )}

          {activeTab === 'scripts' && (
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
                                    <th className="px-6 py-4">Name</th>
                                    <th className="px-6 py-4">Company ID</th>
                                    <th className="px-6 py-4">Version</th>
                                    <th className="px-6 py-4">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-light dark:divide-slate-800">
                                {scripts.map((script) => (
                                    <tr key={script.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4 font-semibold">{script.name}</td>
                                        <td className="px-6 py-4 font-mono text-xs">{script.company_id}</td>
                                        <td className="px-6 py-4 text-sm">{script.version}</td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${script.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'}`}>
                                                {script.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {scripts.length === 0 && (
                                  <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">No scripts found</td>
                                  </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
          )}

          {activeTab === 'leadership' && (
            <Leaderboard teamId="" />
          )}

          {activeTab === 'system' && (
             <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-border-light dark:border-slate-800 shadow-sm">
                        <p className="text-sm font-medium text-slate-500 mb-1">Queue: Audio Processing</p>
                        <h3 className="text-3xl font-bold">{systemStatus?.queues.audio_processing ?? '—'}</h3>
                    </div>
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-border-light dark:border-slate-800 shadow-sm">
                        <p className="text-sm font-medium text-slate-500 mb-1">Overall Status</p>
                        <h3 className="text-3xl font-bold uppercase text-emerald-500">{systemStatus?.status ?? '—'}</h3>
                    </div>
                </div>
             </div>
          )}

          {activeTab === 'subscriptions' && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-border-light dark:border-slate-800 shadow-sm p-12 text-center text-slate-500">
              <span className="material-symbols-outlined text-4xl mb-4">payments</span>
              <p>{t('superadmin.sub_mgmt_soon')}</p>
            </div>
          )}
        </div>
      </div>

      {editingCompany && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 rounded-xl p-6 w-full max-w-md">
                  <h3 className="text-xl font-bold mb-4">Edit Company</h3>
                  <form onSubmit={handleUpdateCompany} className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium mb-1">Name</label>
                          <input
                            className="w-full border rounded p-2 dark:bg-slate-800"
                            value={editingCompany.name}
                            onChange={e => setEditingCompany({...editingCompany, name: e.target.value})}
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-medium mb-1">Managers Count</label>
                          <input
                            type="number"
                            className="w-full border rounded p-2 dark:bg-slate-800"
                            value={editingCompany.managers_count || 0}
                            onChange={e => setEditingCompany({...editingCompany, managers_count: parseInt(e.target.value)})}
                          />
                      </div>
                      <div>
                          <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={editingCompany.is_active}
                                onChange={e => setEditingCompany({...editingCompany, is_active: e.target.checked})}
                              />
                              Active
                          </label>
                      </div>
                      <div className="flex justify-end gap-2 mt-6">
                          <button type="button" onClick={() => setEditingCompany(null)} className="px-4 py-2 border rounded">Cancel</button>
                          <button type="submit" className="px-4 py-2 bg-primary text-white rounded font-bold">Save</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {editingUser && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 rounded-xl p-6 w-full max-w-md">
                  <h3 className="text-xl font-bold mb-4">Edit User</h3>
                  <form onSubmit={handleUpdateUser} className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium mb-1">First Name</label>
                          <input
                            className="w-full border rounded p-2 dark:bg-slate-800"
                            value={editingUser.first_name || ''}
                            onChange={e => setEditingUser({...editingUser, first_name: e.target.value})}
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-medium mb-1">Last Name</label>
                          <input
                            className="w-full border rounded p-2 dark:bg-slate-800"
                            value={editingUser.last_name || ''}
                            onChange={e => setEditingUser({...editingUser, last_name: e.target.value})}
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-medium mb-1">Role</label>
                          <select
                            className="w-full border rounded p-2 dark:bg-slate-800"
                            value={editingUser.role}
                            onChange={e => setEditingUser({...editingUser, role: e.target.value as any})}
                          >
                              <option value="sales_rep">Sales Rep</option>
                              <option value="tenant_admin">Tenant Admin</option>
                              <option value="super_admin">Super Admin</option>
                          </select>
                      </div>
                      <div>
                          <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={editingUser.is_active}
                                onChange={e => setEditingUser({...editingUser, is_active: e.target.checked})}
                              />
                              Active
                          </label>
                      </div>
                      <div className="flex justify-end gap-2 mt-6">
                          <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 border rounded">Cancel</button>
                          <button type="submit" className="px-4 py-2 bg-primary text-white rounded font-bold">Save</button>
                      </div>
                  </form>
              </div>
          </div>
      )}
    </PageLayout>
  );
};
