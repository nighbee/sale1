import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { companyApi } from '../api/client';

const CompanySettings: React.FC = () => {
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchCompany = async () => {
      const companyId = localStorage.getItem('company_id');
      if (companyId) {
        try {
          const res = await companyApi.getCompany(companyId);
          setCompany(res.data);
        } catch (err) {
          console.error('Failed to fetch company');
        } finally {
          setLoading(false);
        }
      }
    };
    fetchCompany();
  }, []);

  const handleSave = async (stt: string, llm: string) => {
    setSaving(true);
    const companyId = localStorage.getItem('company_id');
    try {
      await companyApi.updateSettings(companyId!, {
        stt_model_preference: stt,
        llm_provider: llm,
      });
      setCompany({...company, stt_model_preference: stt, llm_provider: llm});
    } catch (err) {
      console.error('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-800 dark:text-slate-200 min-h-screen flex font-display antialiased">
      <Sidebar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 overflow-y-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Company Settings</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage your AI infrastructure, integrations, and billing preferences.</p>
          </div>
        </div>

        <div className="border-b border-border-light dark:border-border-dark mb-8 overflow-x-auto">
          <nav className="-mb-px flex space-x-8">
            <button className="border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">General</button>
            <button className="border-primary text-primary whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">AI Providers</button>
            <button className="border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">Integrations</button>
            <button className="border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm">Billing</button>
          </nav>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 space-y-10">
            <section>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Speech-to-Text (STT)</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Select the engine used to transcribe sales calls.</p>
                </div>
              </div>
              <div className="space-y-4">
                {[
                  { id: 'whisperx_local', name: 'WhisperX (Self-Hosted)', type: 'Free', details: ['Zero data egress', 'Lowest latency'], warning: ['Requires GPU', 'Higher maintenance'] },
                  { id: 'openai', name: 'OpenAI Whisper API', type: '$0.006 / min', details: ['Highest accuracy', 'Managed infra'], warning: ['Data leaves region'] },
                  { id: 'gemini', name: 'Google Gemini STT', type: '$0.004 / min', details: ['Strong multilingual', 'Native GCP'], warning: ['Lower jargon accuracy'] },
                ].map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleSave(p.id, company.llm_provider)}
                    className={`relative flex cursor-pointer rounded-lg border p-4 shadow-sm transition-all ${company.stt_model_preference === p.id ? 'border-2 border-primary bg-blue-50/20 dark:bg-blue-900/10' : 'border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark'}`}
                  >
                    <div className="flex h-5 items-center">
                      <input type="radio" checked={company.stt_model_preference === p.id} readOnly className="h-4 w-4 text-primary" />
                    </div>
                    <div className="ml-3 flex flex-col w-full">
                      <div className="flex justify-between items-start w-full">
                        <span className="block text-sm font-medium text-slate-900 dark:text-white">{p.name}</span>
                        <span className="inline-flex items-center rounded-md bg-slate-50 dark:bg-slate-800 px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 ring-1 ring-inset ring-slate-500/10">{p.type}</span>
                      </div>
                      <div className="mt-2 grid sm:grid-cols-2 gap-4 text-xs">
                        <ul className="list-disc pl-4 space-y-1 text-emerald-600 dark:text-emerald-400">
                          {p.details.map(d => <li key={d}>{d}</li>)}
                        </ul>
                        <ul className="list-disc pl-4 space-y-1 text-amber-600 dark:text-amber-500">
                          {p.warning.map(w => <li key={w}>{w}</li>)}
                        </ul>
                      </div>
                    </div>
                    {company.stt_model_preference === p.id && <div className="absolute top-4 right-4 text-primary"><span className="material-icons">check_circle</span></div>}
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">LLM Analysis</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Select the model for sentiment analysis and objection handling.</p>
                </div>
              </div>
              <div className="space-y-4">
                {[
                  { id: 'openai', name: 'OpenAI GPT-4 Turbo', type: '$10 / 1M tokens', details: ['SOTA reasoning', 'Excellent nuance'], warning: ['Highest cost', 'Latency ~2-3s'] },
                  { id: 'gemini', name: 'Google Gemini Pro 1.5', type: '$7 / 1M tokens', details: ['1M+ context window', 'Cost effective'], warning: ['Strict safety filters'] },
                ].map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleSave(company.stt_model_preference, p.id)}
                    className={`relative flex cursor-pointer rounded-lg border p-4 shadow-sm transition-all ${company.llm_provider === p.id ? 'border-2 border-primary bg-blue-50/20 dark:bg-blue-900/10' : 'border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark'}`}
                  >
                    <div className="flex h-5 items-center">
                      <input type="radio" checked={company.llm_provider === p.id} readOnly className="h-4 w-4 text-primary" />
                    </div>
                    <div className="ml-3 flex flex-col w-full">
                      <div className="flex justify-between items-start w-full">
                        <span className="block text-sm font-medium text-slate-900 dark:text-white">{p.name}</span>
                        <span className="inline-flex items-center rounded-md bg-slate-50 dark:bg-slate-800 px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 ring-1 ring-inset ring-slate-500/10">{p.type}</span>
                      </div>
                    </div>
                    {company.llm_provider === p.id && <div className="absolute top-4 right-4 text-primary"><span className="material-icons">check_circle</span></div>}
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="lg:col-span-4 sticky top-24 space-y-6">
            <div className="rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark shadow-sm overflow-hidden p-6">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-primary">payments</span>
                Cost Estimate
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600 dark:text-slate-300">Total Estimate</span>
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">$162/mo</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-primary h-full w-[63%]"></div>
                </div>
              </div>
              <button disabled={saving} className="w-full mt-6 py-3 px-4 bg-primary text-white font-bold rounded-lg hover:bg-primary-hover transition-all">
                {saving ? 'Saving...' : 'Save All Changes'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CompanySettings;
