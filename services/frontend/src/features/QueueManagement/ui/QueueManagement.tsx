import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { callApi } from '../../../entities/call/api';

export const QueueManagement: React.FC = () => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<{ paused: boolean; length: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchStatus = async () => {
    try {
      const res = await callApi.getQueueStatus();
      setStatus(res.data);
    } catch (err) {
      console.error('Failed to fetch queue status', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleBulkReprocess = async () => {
    if (!dateFrom || !dateTo) return;
    setActionLoading(true);
    try {
      await callApi.bulkReprocess({ date_from: dateFrom, date_to: dateTo });
      fetchStatus();
      alert(t('calls.reprocess_range_success'));
    } catch (err) {
      alert('Error: Failed to reprocess calls');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClearQueue = async () => {
    if (!window.confirm(t('common.delete_confirm'))) return;
    setActionLoading(true);
    try {
      await callApi.clearQueue();
      fetchStatus();
    } finally {
      setActionLoading(false);
    }
  };

  const handleStopQueue = async () => {
    setActionLoading(true);
    try {
      await callApi.stopQueue();
      fetchStatus();
    } finally {
      setActionLoading(false);
    }
  };

  const handleResumeQueue = async () => {
    setActionLoading(true);
    try {
      await callApi.resumeQueue();
      fetchStatus();
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-icons text-primary">queue</span>
          <h3 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-xs">
            {t('calls.queue_management')}
          </h3>
        </div>
        {status?.paused && (
          <span className="px-2 py-0.5 rounded bg-red-100 text-red-600 text-[10px] font-bold uppercase">
            {t('common.inactive')}
          </span>
        )}
      </div>

      <div className="p-4 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
            <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">{t('calls.pending_count')}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{loading ? '...' : status?.length}</p>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
            <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">{t('common.status')}</p>
            <p className={`text-sm font-bold ${status?.paused ? 'text-red-500' : 'text-green-500'}`}>
              {status?.paused ? t('calls.stop_queue') : t('dashboard.processing')}
            </p>
          </div>
        </div>

        {/* Bulk Reprocess */}
        <div className="space-y-3">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight">
            {t('calls.bulk_reprocess')}
          </p>
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1">{t('calls.from_date')}</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-sm focus:ring-1 focus:ring-primary focus:border-primary transition-all"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1">{t('calls.to_date')}</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-sm focus:ring-1 focus:ring-primary focus:border-primary transition-all"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleBulkReprocess}
                disabled={actionLoading || !dateFrom || !dateTo}
                className="w-full md:w-auto px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold uppercase tracking-widest rounded-md transition-all disabled:opacity-50"
              >
                {t('calls.add_to_queue')}
              </button>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-3">
          <button
            onClick={handleClearQueue}
            disabled={actionLoading}
            className="px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold uppercase tracking-widest rounded-md transition-all disabled:opacity-50"
          >
            {t('calls.clear_queue')}
          </button>
          {status?.paused ? (
            <button
              onClick={handleResumeQueue}
              disabled={actionLoading}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold uppercase tracking-widest rounded-md transition-all disabled:opacity-50"
            >
              {t('common.continue')}
            </button>
          ) : (
            <button
              onClick={handleStopQueue}
              disabled={actionLoading}
              className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold uppercase tracking-widest rounded-md transition-all disabled:opacity-50"
            >
              {t('calls.stop_queue')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
