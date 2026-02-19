import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { userApi } from '../../../entities/user/api';
import Button from '../../../shared/ui/Button';

const InviteMembersPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [emails, setEmails] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const password = "SalesAI2026!";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const emailList = emails.split('\n').map(e => e.trim()).filter(e => e !== '');

    try {
      await userApi.invite({
        emails: emailList,
        temporary_password: password,
      });
      navigate('/dashboard');
    } catch (_err: unknown) {
      const apiError = _err as { response?: { data?: { error?: string } } };
      setError(apiError.response?.data?.error || t('setup.invite_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white min-h-screen flex flex-col">
      <header className="w-full px-6 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-surface-light dark:bg-surface-dark relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold">S</div>
          <span className="font-bold text-lg tracking-tight">SalesAI</span>
        </div>
        <div className="text-sm text-slate-500 dark:text-slate-400">
          {t('setup.team_setup')} (6/7)
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center p-6 relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl transform -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl transform translate-y-1/3"></div>
        </div>

        <div className="w-full max-w-2xl bg-surface-light dark:bg-surface-dark rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 relative z-10 overflow-hidden">
          <div className="w-full h-1 bg-slate-100 dark:bg-slate-800">
            <div className="h-full bg-primary w-[85%] rounded-r-full"></div>
          </div>
          <div className="p-8 md:p-12 space-y-8">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 text-primary mb-4">
                <span className="material-icons">group_add</span>
              </div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{t('setup.invite_title')}</h1>
              <p className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
                Enter team member emails to register them instantly. They will be able to log in with their email and the password shown below.
              </p>
            </div>

            {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="emails">
                  {t('setup.emails_label')} <span className="text-slate-400 font-normal ml-1">{t('setup.one_per_line')}</span>
                </label>
                <div className="relative">
                  <textarea
                    className="block w-full rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:border-primary focus:ring-primary sm:text-sm font-mono leading-relaxed p-4 resize-none"
                    id="emails"
                    placeholder="john.doe@company.com&#10;sarah.smith@company.com&#10;alex.chen@company.com"
                    rows={6}
                    value={emails}
                    onChange={(e) => setEmails(e.target.value)}
                  ></textarea>
                  <div className="absolute top-3 right-3">
                    <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">{t('setup.csv_paste')}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-500 flex items-center gap-1">
                  <span className="material-icons text-[14px]">info</span>
                  {t('setup.invite_limit_hint')}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('setup.temp_password_label')}</label>
                  <div className="flex rounded-lg shadow-sm">
                    <div className="relative flex-grow focus-within:z-10">
                      <input
                        className="block w-full rounded-l-lg border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 sm:text-sm font-mono tracking-wider focus:border-primary focus:ring-primary"
                        readOnly
                        type="text"
                        value={password}
                      />
                    </div>
                    <button
                      className="relative -ml-px inline-flex items-center space-x-2 rounded-r-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      title={t('setup.regenerate_password')}
                      type="button"
                    >
                      <span className="material-icons text-primary text-lg">autorenew</span>
                    </button>
                  </div>
                </div>
                <div className="bg-blue-50 dark:bg-primary/10 rounded-lg p-4 border border-blue-100 dark:border-primary/20 flex items-start gap-3">
                  <span className="material-icons text-primary text-xl mt-0.5">lock_open</span>
                  <div className="text-sm text-slate-600 dark:text-slate-300">
                    <p className="font-medium text-primary mb-1">Direct Registration</p>
                    Users are registered immediately. No email invitations are sent. Provide them with their password manually.
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-100 dark:border-slate-800">
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="w-full sm:w-auto"
                >
                  {t('common.skip')}
                </Button>
                <Button
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8"
                  type="submit"
                  isLoading={loading}
                  disabled={!emails.trim()}
                >
                  <span>{t('setup.send_invitations')}</span>
                  <span className="material-icons text-sm">send</span>
                </Button>
              </div>
            </form>
          </div>
        </div>

        <div className="absolute bottom-6 text-center w-full">
          <a className="text-sm text-slate-400 hover:text-primary transition-colors flex items-center justify-center gap-1" href="#">
            <span className="material-icons text-sm">help_outline</span> {t('setup.invite_help_prompt')}
          </a>
        </div>
      </main>
    </div>
  );
};

export default InviteMembersPage;
