import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUserStore } from '../../../entities/user/model/store';
import LanguageSwitcher from '../../../shared/ui/LanguageSwitcher';

const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useUserStore();

  const getNavItems = () => {
    if (user?.role === 'super_admin') {
      return [
        { id: 'super-admin', icon: 'admin_panel_settings', label: 'Super Admin', path: '/super-admin' },
        { id: 'settings', icon: 'settings', label: t('nav.settings'), path: '/settings' },
      ];
    }

    if (user?.role === 'admin') {
      return [
        { id: 'dashboard', icon: 'dashboard', label: t('nav.dashboard'), path: '/dashboard' },
        { id: 'teams', icon: 'groups', label: t('nav.teams'), path: '/teams' },
        { id: 'calls', icon: 'call', label: t('nav.calls'), path: '/calls' },
        { id: 'leaderboard', icon: 'leaderboard', label: t('nav.leaderboard'), path: '/leaderboard' },
        { id: 'integrations', icon: 'hub', label: t('nav.integrations'), path: '/integrations' },
        { id: 'settings', icon: 'settings', label: t('nav.settings'), path: '/settings' },
      ];
    }

    // Default for 'user' role
    return [
      { id: 'user-dashboard', icon: 'dashboard', label: t('nav.dashboard'), path: '/user-dashboard' },
      { id: 'calls', icon: 'call', label: t('nav.calls'), path: '/calls' },
      { id: 'leaderboard', icon: 'leaderboard', label: t('nav.leaderboard'), path: '/leaderboard' },
    ];
  };

  const navItems = getNavItems();

  return (
    <aside className="w-64 bg-slate-900 flex-shrink-0 flex flex-col text-white transition-all duration-300">
      <div className="h-16 flex items-center px-6 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
            <span className="material-icons text-lg">insights</span>
          </div>
          <span className="font-bold text-lg tracking-tight">SalesAI</span>
        </div>
      </div>
      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.id}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium group transition-colors ${
                isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <span className="material-icons text-xl group-hover:text-primary-300">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-white/10">
        <LanguageSwitcher />
        <button className="flex items-center gap-3 w-full hover:bg-white/5 p-2 rounded-lg transition-colors text-left mt-4">
          <div className="w-9 h-9 rounded-full border-2 border-primary bg-primary/20 flex items-center justify-center text-primary font-bold">
            {user?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.full_name || user?.email || 'User'}</p>
            <p className="text-xs text-slate-400 truncate capitalize">{user?.role || 'Role'}</p>
          </div>
          <span className="material-icons text-slate-400 text-lg">more_vert</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
