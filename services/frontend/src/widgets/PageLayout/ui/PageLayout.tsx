import React, { useState } from 'react';
import { Sidebar } from '../../Sidebar';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../../../entities/user/model/store';

interface PageLayoutProps {
  children: React.ReactNode;
  title?: string;
  showSearch?: boolean;
}

export const PageLayout: React.FC<PageLayoutProps> = ({ children, title, showSearch = true }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useUserStore();

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 flex h-screen overflow-hidden w-full font-display">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 flex-shrink-0 z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
            >
              <span className="material-icons">menu</span>
            </button>
            {title && <h1 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white truncate">{title}</h1>}
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            {showSearch && (
              <div className="relative hidden sm:block">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <span className="material-icons text-lg">search</span>
                </span>
                <input
                  className="pl-10 pr-4 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary w-40 lg:w-64 transition-all"
                  placeholder={t('common.search')}
                  type="text"
                />
              </div>
            )}

            <button className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
              <span className="material-icons">notifications</span>
            </button>

            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden md:block"></div>

            <button
              onClick={() => navigate('/profile')}
              className="flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 p-1 rounded-lg transition-colors"
            >
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs border border-primary/10">
                {user?.first_name?.charAt(0) || user?.email?.charAt(0) || 'U'}
              </div>
              <div className="text-left hidden lg:block">
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate max-w-[120px]">
                  {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : user?.email || 'User'}
                </p>
                <p className="text-[10px] text-slate-500 capitalize">{user?.role || 'Role'}</p>
              </div>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
