import React, { useState, useEffect } from 'react';
import { Sidebar } from '../../../widgets/Sidebar';
import { integrationApi } from '../../../entities/integration/api';

const IntegrationsPage: React.FC = () => {
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIntegrations = async () => {
      try {
        const res = await integrationApi.list();
        const data = res.data as any;
        setIntegrations(data.integrations || []);
      } catch {
        console.error('Failed to fetch integrations');
      } finally {
        setLoading(false);
      }
    };
    fetchIntegrations();
  }, []);

  const available = [
    { id: 'google_sheets', name: 'Google Sheets', type: 'Reporting', icon: 'table_chart', color: 'green', desc: 'Export leads and analytics directly to spreadsheets.' },
    { id: 'telegram', name: 'Telegram', type: 'Notifications', icon: 'send', color: 'blue', desc: 'Receive instant mobile notifications for new leads.' },
    { id: 'slack', name: 'Slack', type: 'Communication', icon: 'chat_bubble', color: 'purple', desc: 'Sync sales activity to dedicated team channels.' },
  ];

  const isConnected = (type: string) => integrations.some(i => i.integration_type === type && i.is_active);

  if (loading) return <div className="p-8">Loading integrations...</div>;

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 min-h-screen flex font-display">
      <Sidebar />
      <main className="flex-1 max-w-[1200px] mx-auto w-full px-6 py-10 overflow-y-auto">
        <div className="flex flex-wrap items-center justify-between gap-6 mb-12">
          <div className="flex flex-col gap-2">
            <h1 className="text-slate-900 dark:text-white text-4xl font-black tracking-tight">Integrations</h1>
            <p className="text-slate-500 dark:text-slate-400 text-lg max-w-xl">Manage your data ecosystem and streamline lead workflows across platforms.</p>
          </div>
          <button className="bg-primary/10 text-primary hover:bg-primary/20 font-bold px-6 py-3 rounded-lg flex items-center gap-2">
            <span className="material-symbols-outlined">add_circle</span>
            Request Integration
          </button>
        </div>

        <section className="mb-16">
          <div className="flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-green-500">check_circle</span>
            <h2 className="text-slate-900 dark:text-white text-2xl font-bold tracking-tight">Connected Integrations</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {integrations.filter(i => i.is_active).map(i => (
              <div key={i.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-3">
                  <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">Active</span>
                </div>
                <div className="flex items-start gap-4 mb-6">
                  <div className="size-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary text-3xl">hub</span>
                  </div>
                  <div>
                    <h3 className="text-slate-900 dark:text-white font-bold text-lg">{i.integration_type}</h3>
                    <p className="text-slate-400 text-sm">CRM Connector</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button className="flex-1 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-semibold py-2 rounded-lg text-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-base">settings</span>
                    Configure
                  </button>
                </div>
              </div>
            ))}
            {integrations.filter(i => i.is_active).length === 0 && <p className="text-slate-500 col-span-full">No active integrations found.</p>}
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-primary">apps</span>
            <h2 className="text-slate-900 dark:text-white text-2xl font-bold tracking-tight">Available Integrations</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {available.map(app => (
              <div key={app.id} className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm transition-all flex flex-col ${isConnected(app.id) ? 'opacity-50 grayscale' : 'hover:border-primary/30'}`}>
                <div className="flex items-start gap-4 mb-4">
                  <div className={`size-12 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-center`}>
                    <span className={`material-symbols-outlined text-primary text-3xl`}>{app.icon}</span>
                  </div>
                  <div>
                    <h3 className="text-slate-900 dark:text-white font-bold text-lg">{app.name}</h3>
                    <p className="text-slate-400 text-sm">{app.type}</p>
                  </div>
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6 flex-1">{app.desc}</p>
                <button
                  disabled={isConnected(app.id)}
                  className="w-full bg-primary text-white hover:bg-primary/90 font-bold py-2.5 rounded-lg text-sm shadow-sm flex items-center justify-center gap-2 transition-all disabled:bg-slate-300"
                >
                  <span className="material-symbols-outlined text-base">add</span>
                  {isConnected(app.id) ? 'Connected' : 'Connect Now'}
                </button>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default IntegrationsPage;
