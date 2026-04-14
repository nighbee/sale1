import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { RegisterForm } from "../../../features/auth/register";
import LanguageSwitcher from "../../../shared/ui/LanguageSwitcher";

const RegisterPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="bg-blue-50 dark:bg-background-dark min-h-screen font-display flex flex-col">
      <header className="w-full py-6 px-8 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-lg">
            S
          </div>
          <span className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Call Analyzer for Sales
          </span>
        </div>
        <div className="hidden sm:block text-sm font-medium text-slate-600 dark:text-slate-400">
          {t("auth.have_account")}{" "}
          <Link
            to="/login"
            className="text-primary hover:text-blue-700 dark:hover:text-blue-400 font-semibold transition-colors"
          >
            {t("auth.log_in")}
          </Link>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-slate-100 dark:bg-slate-800">
            <div className="h-full bg-primary w-2/3 transition-all duration-500 ease-out"></div>
          </div>
          <div className="p-8 sm:p-10">
            <div className="flex justify-center mb-6">
              <LanguageSwitcher />
            </div>
            <div className="flex items-center gap-2 mb-6">
              <span className="bg-primary/10 text-primary text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                {t('common.step', { current: 2, total: 3 })}
              </span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {t('auth.account_setup')}
              </span>
            </div>

            <div className="mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
                {t("auth.register_title")}
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                {t("auth.register_subtitle")}
              </p>
            </div>

            <RegisterForm />
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 px-8 py-4 text-center sm:hidden">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t("auth.have_account")}{" "}
              <Link
                className="font-medium text-primary hover:text-blue-500"
                to="/login"
              >
                {t("auth.log_in")}
              </Link>
            </p>
          </div>
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
        <p>{t('common.all_rights_reserved')}</p>
      </footer>
    </div>
  );
};

export default RegisterPage;
