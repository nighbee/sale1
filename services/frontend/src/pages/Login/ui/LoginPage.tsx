import React from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { LoginForm } from "../../../features/auth/login";
import LanguageSwitcher from "../../../shared/ui/LanguageSwitcher";

const LoginPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white antialiased min-h-screen w-full flex flex-col">
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-8 sm:p-10">
            <div className="flex justify-center mb-6">
              <LanguageSwitcher />
            </div>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-white mb-4">
                <span className="material-icons text-2xl">insights</span>
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white uppercase">
                SalesAI
              </h1>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {t("auth.login_title")}
              </p>
            </div>

            <LoginForm />

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest">
                  <span className="px-2 bg-white dark:bg-slate-900 text-slate-400">
                    {t('auth.or_continue_with')}
                  </span>
                </div>
              </div>

              <div className="mt-6">
                <button
                  className="w-full flex items-center justify-center gap-3 py-2 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-1 focus:ring-primary transition-all duration-200"
                  type="button"
                >
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    ></path>
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    ></path>
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    ></path>
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    ></path>
                  </svg>
                  <span className="text-xs uppercase tracking-wider">{t('auth.continue_google')}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="px-8 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 text-center">
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {t("auth.no_account")}{" "}
              <Link
                className="text-primary hover:text-primary-hover"
                to="/register"
              >
                {t("auth.create_account")}
              </Link>
            </p>
          </div>
        </div>
      </main>

      <footer className="p-6 text-center">
        <div className="flex justify-center space-x-6 text-[10px] uppercase font-bold tracking-widest text-slate-400">
            <a className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors" href="#">{t('auth.privacy_policy')}</a>
            <a className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors" href="#">{t('auth.terms_service')}</a>
            <a className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors" href="#">{t('auth.help_center')}</a>
        </div>
      </footer>
    </div>
  );
};

export default LoginPage;
