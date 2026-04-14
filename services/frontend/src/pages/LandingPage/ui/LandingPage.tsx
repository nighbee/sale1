import React from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { Link } from 'react-router-dom';
import LanguageSwitcher from '@shared/ui/LanguageSwitcher';

const LandingPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-sans overflow-x-hidden min-h-screen">
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-white">
              <span className="material-symbols-outlined text-xl">analytics</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Call Analyzer for Sales</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a className="text-sm font-medium text-slate-600 hover:text-primary dark:text-slate-300 dark:hover:text-white transition-colors" href="#features">{t('landing.nav.features')}</a>
            <a className="text-sm font-medium text-slate-600 hover:text-primary dark:text-slate-300 dark:hover:text-white transition-colors" href="#pricing">{t('landing.nav.pricing')}</a>
            <a className="text-sm font-medium text-slate-600 hover:text-primary dark:text-slate-300 dark:hover:text-white transition-colors" href="#tech">{t('landing.nav.tech')}</a>
          </nav>
          <div className="flex items-center gap-4">
            <LanguageSwitcher className="mb-0 mx-0 bg-slate-100 dark:bg-slate-800" />
            <Link className="hidden text-sm font-medium text-slate-600 hover:text-primary dark:text-slate-300 dark:hover:text-white sm:block" to="/login">{t('landing.nav.login')}</Link>
            <Link className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-slate-900" to="/register">
              {t('landing.nav.get_started')}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-16 pb-20 lg:pt-24 lg:pb-28">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-100 via-background-light to-background-light dark:from-blue-900/20 dark:via-background-dark dark:to-background-dark"></div>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-8 items-center">
              <div className="flex flex-col justify-center text-center lg:text-left">
                <div className="mb-6 inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-medium text-primary dark:border-blue-900 dark:bg-blue-900/30 dark:text-blue-300 mx-auto lg:mx-0 w-fit">
                  <span className="mr-2 flex h-2 w-2 rounded-full bg-primary"></span>
                  {t('landing.hero.badge')}
                </div>
                <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white sm:text-5xl md:text-6xl lg:leading-[1.1]">
                  {t('landing.hero.title')} <span className="text-primary bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent-blue">{t('landing.hero.title_highlight')}</span>
                </h1>
                <p className="mt-6 text-lg leading-8 text-slate-600 dark:text-slate-400 max-w-2xl mx-auto lg:mx-0">
                  {t('landing.hero.subtitle')}
                </p>
                <div className="mt-8 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                  <Link className="w-full sm:w-auto inline-flex h-12 items-center justify-center rounded-lg bg-primary px-6 text-base font-semibold text-white shadow-sm hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-all hover:shadow-lg hover:shadow-primary/25" to="/register">
                    {t('landing.hero.cta_trial')}
                  </Link>
                  <a className="w-full sm:w-auto inline-flex h-12 items-center justify-center rounded-lg border border-slate-200 bg-white px-6 text-base font-semibold text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700 transition-colors" href="#">
                    <span className="material-symbols-outlined mr-2 text-xl">play_circle</span>
                    {t('landing.hero.cta_demo')}
                  </a>
                </div>
                <div className="mt-10 flex items-center justify-center lg:justify-start gap-x-6">
                  <div className="flex -space-x-2 overflow-hidden">
                    <img alt="User avatar" className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-slate-900" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBjOvRrTcuNWYnjsvIdCUE_IgztVKcjnurjXhscRBRWv2WgrCGkOj9LT48JZ0-igcojUl40SQmId0ymgXIwzEE08FPXbyIlwcooUAzs4zQQ5xH44EL1mmZyffT194CJREkH2gBJzzMqnoAwb7Kkdg9qdhRUI52U7baW-MLSLBv8IPv0jzJDNA6I9vrxLARkla19bczd1b5DYktrNbaNSfkdEuppJh7JZuaI8VPn92-LcD1mxjvdxd7PJ38QnLWe_6PjmbwVHjwkgTE" />
                    <img alt="User avatar" className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-slate-900" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAISZXnKGZOa63uRHoIerRhVw4fTL3kNrLmvfwe3gHYzSNfLHjfCcuymIVd9grNm84Pey7-iWiaqF3dPa8TgpiKfYXu_AFkcqkWtbsRH9uOexnbkfrMcDoBlE10gw6PJoMotVv5sBDrO4WY7VxM_5wG8oqj27L9ScvrRybcHvBIjt7ST_OLApPK_dO4HjiDugzbgs1YsgqRtshdbKHh7MFVFQfJV5Bgs-nVvd5aIb7SwYximYs_GDPrneHCfZswkTy0r7fLq6wFjfQ" />
                    <img alt="User avatar" className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-slate-900" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCHjAXpgNDH8B_xVhk7Gma6LJbYN9yvNxXigxLCfjzJ99se4dVtvjFZk2Fi75fGzqXXY6gLdlHTJe7zT0wfwV4pLLEc6ErGK3fon4Yf4aeIIzo4wWMCIbBbVozbzTy85PrzpgQhcUPiRyP_n-8qmny3LQcBxnTNncGp8nBR-F-8TP10oaVrynk4OmFgvP0cYxrXQncf8RNAEpoBxd1wy9s1SVq90-UwmkB-2VMFcadlj69LPEdtDQEWERoQcNdHpZBwwEMtGwe5_ls" />
                  </div>
                  <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    <Trans
                      i18nKey="landing.hero.trusted"
                      components={{
                        highlight: <span className="text-primary dark:text-blue-400 font-bold" />
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="relative lg:ml-auto w-full max-w-lg lg:max-w-none">
                <div className="relative rounded-2xl bg-slate-900/5 p-2 ring-1 ring-inset ring-slate-900/10 dark:bg-white/5 dark:ring-white/10 lg:-m-4 lg:rounded-2xl lg:p-4 shadow-2xl backdrop-blur-sm">
                  <div className="aspect-[16/10] overflow-hidden rounded-lg bg-white dark:bg-slate-800 shadow-inner">
                    <div className="h-full w-full bg-slate-50 dark:bg-slate-900 p-6 flex flex-col gap-4">
                      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-4">
                        <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                        <div className="flex gap-2">
                          <div className="h-8 w-20 bg-primary/10 rounded"></div>
                          <div className="h-8 w-8 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="h-24 bg-white dark:bg-slate-800 rounded border border-slate-100 dark:border-slate-700 p-3 shadow-sm flex flex-col justify-between">
                          <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded"></div>
                          <div className="h-8 w-12 bg-green-100 dark:bg-green-900/30 rounded self-end"></div>
                        </div>
                        <div className="h-24 bg-white dark:bg-slate-800 rounded border border-slate-100 dark:border-slate-700 p-3 shadow-sm flex flex-col justify-between">
                          <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded"></div>
                          <div className="h-8 w-12 bg-blue-100 dark:bg-blue-900/30 rounded self-end"></div>
                        </div>
                        <div className="h-24 bg-white dark:bg-slate-800 rounded border border-slate-100 dark:border-slate-700 p-3 shadow-sm flex flex-col justify-between">
                          <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded"></div>
                          <div className="h-8 w-12 bg-purple-100 dark:bg-purple-900/30 rounded self-end"></div>
                        </div>
                      </div>
                      <div className="flex-1 bg-white dark:bg-slate-800 rounded border border-slate-100 dark:border-slate-700 p-4 shadow-sm flex gap-4">
                        <div className="w-2/3 space-y-3">
                          <div className="h-4 w-full bg-slate-100 dark:bg-slate-700 rounded"></div>
                          <div className="h-4 w-5/6 bg-slate-100 dark:bg-slate-700 rounded"></div>
                          <div className="h-4 w-4/6 bg-slate-100 dark:bg-slate-700 rounded"></div>
                        </div>
                        <div className="w-1/3 flex items-center justify-center">
                          <div className="h-20 w-20 rounded-full border-4 border-primary/20 border-t-primary"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Social Proof */}
        <section className="border-y border-slate-200 bg-white py-12 dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <p className="text-center text-sm font-semibold text-slate-500 dark:text-slate-400 mb-8 uppercase tracking-wider">{t('landing.social.trusted')}</p>
            <div className="grid grid-cols-2 gap-8 md:grid-cols-5 items-center opacity-70 grayscale hover:grayscale-0 transition-all duration-500">
              <div className="flex justify-center items-center h-12">
                <span className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2"><span className="material-symbols-outlined">diamond</span> AcmeCorp</span>
              </div>
              <div className="flex justify-center items-center h-12">
                <span className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2"><span className="material-symbols-outlined">rocket_launch</span> BlastOff</span>
              </div>
              <div className="flex justify-center items-center h-12">
                <span className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2"><span className="material-symbols-outlined">water_drop</span> Hydra</span>
              </div>
              <div className="flex justify-center items-center h-12">
                <span className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2"><span className="material-symbols-outlined">bolt</span> EnergyInc</span>
              </div>
              <div className="flex justify-center items-center h-12">
                <span className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2"><span className="material-symbols-outlined">language</span> GlobalTech</span>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-24 bg-background-light dark:bg-background-dark" id="features">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center mb-16">
              <h2 className="text-base font-semibold leading-7 text-primary">{t('landing.features.badge')}</h2>
              <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">{t('landing.features.title')}</p>
              <p className="mt-6 text-lg leading-8 text-slate-600 dark:text-slate-400">
                {t('landing.features.subtitle')}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-all hover:shadow-md hover:border-primary/50 dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-primary dark:bg-blue-900/20 dark:text-blue-300 group-hover:bg-primary group-hover:text-white transition-colors">
                  <span className="material-symbols-outlined">mic</span>
                </div>
                <h3 className="mb-3 text-xl font-bold text-slate-900 dark:text-white">{t('landing.features.transcription.title')}</h3>
                <p className="text-slate-600 dark:text-slate-400">
                  {t('landing.features.transcription.desc')}
                </p>
              </div>
              <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-all hover:shadow-md hover:border-primary/50 dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-primary dark:bg-blue-900/20 dark:text-blue-300 group-hover:bg-primary group-hover:text-white transition-colors">
                  <span className="material-symbols-outlined">bar_chart</span>
                </div>
                <h3 className="mb-3 text-xl font-bold text-slate-900 dark:text-white">{t('landing.features.scoring.title')}</h3>
                <p className="text-slate-600 dark:text-slate-400">
                  {t('landing.features.scoring.desc')}
                </p>
              </div>
              <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 shadow-sm transition-all hover:shadow-md hover:border-primary/50 dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-primary dark:bg-blue-900/20 dark:text-blue-300 group-hover:bg-primary group-hover:text-white transition-colors">
                  <span className="material-symbols-outlined">sync_alt</span>
                </div>
                <h3 className="mb-3 text-xl font-bold text-slate-900 dark:text-white">{t('landing.features.crm.title')}</h3>
                <p className="text-slate-600 dark:text-slate-400">
                  {t('landing.features.crm.desc')}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-24 bg-white dark:bg-slate-900 relative overflow-hidden">
          <div className="absolute right-0 top-0 -mt-20 -mr-20 h-full w-1/2 bg-gradient-to-b from-blue-50 to-transparent opacity-50 dark:from-slate-800/30 dark:to-transparent blur-3xl rounded-full"></div>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="mb-16 md:text-center">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">{t('landing.how_it_works.title')}</h2>
              <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">{t('landing.how_it_works.subtitle')}</p>
            </div>
            <div className="relative">
              <div className="absolute top-12 left-0 hidden w-full md:block">
                <div className="h-0.5 w-full bg-slate-200 dark:bg-slate-800"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                <div className="relative flex flex-col items-center text-center">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white border-4 border-blue-50 text-primary shadow-lg dark:bg-slate-800 dark:border-slate-700 z-10 mb-6">
                    <span className="material-symbols-outlined text-4xl">cable</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('landing.how_it_works.step_1.title')}</h3>
                  <p className="mt-2 text-slate-600 dark:text-slate-400">{t('landing.how_it_works.step_1.desc')}</p>
                </div>
                <div className="relative flex flex-col items-center text-center">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white border-4 border-blue-50 text-primary shadow-lg dark:bg-slate-800 dark:border-slate-700 z-10 mb-6">
                    <span className="material-symbols-outlined text-4xl">psychology</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('landing.how_it_works.step_2.title')}</h3>
                  <p className="mt-2 text-slate-600 dark:text-slate-400">{t('landing.how_it_works.step_2.desc')}</p>
                </div>
                <div className="relative flex flex-col items-center text-center">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white border-4 border-blue-50 text-primary shadow-lg dark:bg-slate-800 dark:border-slate-700 z-10 mb-6">
                    <span className="material-symbols-outlined text-4xl">trending_up</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('landing.how_it_works.step_3.title')}</h3>
                  <p className="mt-2 text-slate-600 dark:text-slate-400">{t('landing.how_it_works.step_3.desc')}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Tech Specs Section */}
        <section className="py-20 bg-slate-900 text-white relative" id="tech">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="flex flex-col md:flex-row items-center justify-between gap-10">
              <div className="flex-1">
                <h2 className="text-3xl font-bold tracking-tight mb-6">{t('landing.tech.title')}</h2>
                <p className="text-slate-300 mb-8 text-lg">{t('landing.tech.desc')}</p>
                <ul className="space-y-4">
                  <li className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary-light">check_circle</span>
                    <Trans
                      i18nKey="landing.tech.feat_1"
                      components={{
                        strong: <strong />
                      }}
                    />
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary-light">check_circle</span>
                    <span>{t('landing.tech.feat_2')}</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary-light">check_circle</span>
                    <span>{t('landing.tech.feat_3')}</span>
                  </li>
                </ul>
              </div>
              <div className="flex-1 flex justify-center">
                <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 w-full max-w-md shadow-2xl">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-3 w-3 rounded-full bg-red-500"></div>
                    <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                    <div className="h-3 w-3 rounded-full bg-green-500"></div>
                  </div>
                  <code className="text-sm font-mono text-blue-300 block mb-2">// Call Analyzer for Sales Integration Example</code>
                  <pre className="font-mono text-xs text-slate-300 overflow-x-auto">
{`const salesAI = require('@call-analyzer/sdk');

const client = new salesAI.Client({
  apiKey: process.env.SALESAI_KEY,
  region: 'us-east-1'
});

await client.analyzeCall({
  audioUrl: 'https://api.twilio.com/Rec...',
  model: 'whisper-x-large'
});

console.log('Analysis complete. 🚀');`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 bg-primary relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-primary to-blue-900"></div>
          <div className="absolute top-0 left-0 -ml-20 -mt-20 h-64 w-64 rounded-full bg-white opacity-5 blur-3xl"></div>
          <div className="absolute bottom-0 right-0 -mr-20 -mb-20 h-64 w-64 rounded-full bg-white opacity-5 blur-3xl"></div>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl mb-6">{t('landing.cta.title')}</h2>
            <p className="text-blue-100 text-lg mb-10 max-w-2xl mx-auto">{t('landing.cta.subtitle')}</p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link className="bg-white text-primary hover:bg-slate-100 font-bold py-3 px-8 rounded-lg shadow-lg transition-colors leading-normal inline-block" to="/register">
                {t('landing.cta.btn_free')}
              </Link>
              <button className="bg-primary-dark border border-blue-400/30 text-white hover:bg-blue-900 font-bold py-3 px-8 rounded-lg transition-colors">
                {t('landing.cta.btn_demo')}
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pt-16 pb-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 mb-12">
            <div className="col-span-2 lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex size-6 items-center justify-center rounded bg-primary text-white">
                  <span className="material-symbols-outlined text-sm">analytics</span>
                </div>
                <span className="text-lg font-bold text-slate-900 dark:text-white">Call Analyzer for Sales</span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs mb-6">
                {t('landing.footer.desc')}
              </p>
              <div className="flex gap-4">
                <a className="text-slate-400 hover:text-primary transition-colors" href="#"><span className="sr-only">Twitter</span><svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84"></path></svg></a>
                <a className="text-slate-400 hover:text-primary transition-colors" href="#"><span className="sr-only">GitHub</span><svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" fillRule="evenodd"></path></svg></a>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">{t('landing.footer.product')}</h3>
              <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                <li><a className="hover:text-primary transition-colors" href="#">{t('landing.nav.features')}</a></li>
                <li><a className="hover:text-primary transition-colors" href="#">{t('landing.footer.integrations')}</a></li>
                <li><a className="hover:text-primary transition-colors" href="#">{t('landing.nav.pricing')}</a></li>
                <li><a className="hover:text-primary transition-colors" href="#">{t('landing.footer.changelog')}</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">{t('landing.footer.company')}</h3>
              <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                <li><a className="hover:text-primary transition-colors" href="#">{t('landing.footer.about')}</a></li>
                <li><a className="hover:text-primary transition-colors" href="#">{t('landing.footer.careers')}</a></li>
                <li><a className="hover:text-primary transition-colors" href="#">{t('landing.footer.blog')}</a></li>
                <li><a className="hover:text-primary transition-colors" href="#">{t('landing.footer.contact')}</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">{t('landing.footer.legal')}</h3>
              <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                <li><a className="hover:text-primary transition-colors" href="#">{t('landing.footer.privacy')}</a></li>
                <li><a className="hover:text-primary transition-colors" href="#">{t('landing.footer.terms')}</a></li>
                <li><a className="hover:text-primary transition-colors" href="#">{t('landing.footer.cookie')}</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-200 dark:border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-slate-500 text-center md:text-left">{t('landing.footer.copyright')}</p>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              {t('landing.footer.status')}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
