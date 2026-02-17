import React from 'react';
import { useTranslation } from 'react-i18next';
import { Sidebar } from '../../../widgets/Sidebar';
import { useUserStore } from '../../../entities/user/model/store';

export const ProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useUserStore();

  if (!user) return null;

  const profileFields = [
    { label: t('profile.full_name'), value: user.full_name || 'N/A', icon: 'person' },
    { label: t('profile.email'), value: user.email, icon: 'email' },
    { label: t('profile.role'), value: user.role, icon: 'badge', className: 'uppercase' },
    { label: t('profile.company'), value: user.company_id, icon: 'business' },
    { label: t('profile.joined'), value: new Date(user.created_at).toLocaleDateString(), icon: 'calendar_today' },
    { label: t('profile.status'), value: user.is_active ? t('superadmin.active') : 'Inactive', icon: 'check_circle', valueClassName: user.is_active ? 'text-emerald-600' : 'text-slate-400' },
  ];

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen flex font-display">
      <Sidebar />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-black tracking-tight">{t('profile.title')}</h1>
            <p className="text-slate-500 mt-2">{t('profile.personal_info')}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-border-light dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-border-light dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-6">
                <div className="h-24 w-24 rounded-full bg-primary/20 border-4 border-white dark:border-slate-700 shadow-sm flex items-center justify-center text-primary text-4xl font-black">
                  {user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{user.full_name || user.email.split('@')[0]}</h2>
                  <p className="text-slate-500 font-medium uppercase tracking-wider text-sm mt-1">{user.role}</p>
                </div>
              </div>
            </div>

            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {profileFields.map((field) => (
                  <div key={field.label} className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <span className="material-icons text-sm">{field.icon}</span>
                      {field.label}
                    </label>
                    <p className={`text-lg font-semibold ${field.className || ''} ${field.valueClassName || ''}`}>
                      {field.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
