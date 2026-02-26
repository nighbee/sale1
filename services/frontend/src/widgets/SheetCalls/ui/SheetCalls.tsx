import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { callApi } from '../../../entities/call/api';
import type { Call, CallAnalysis } from '../../../entities/call/types';
import { integrationApi } from '../../../entities/integration/api';

// Sub-components
import { CallFilters } from './CallFilters';
import { CallStats } from './CallStats';
import { CallCharts } from './CallCharts';
import { CallTable } from './CallTable';
import { CallDetailsModal } from './CallDetailsModal';

const PAGE_SIZE = 10;

export const SheetCalls: React.FC = () => {
  const navigate = useNavigate();

  // State
  const [allSheetCalls, setAllSheetCalls] = useState<Call[]>([]);
  const [sheetLoading, setSheetLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter]   = useState('');
  const [managerFilter, setManagerFilter] = useState('');
  const [clientFilter, setClientFilter]   = useState('');
  const [dateFrom, setDateFrom]           = useState('');
  const [dateTo, setDateTo]               = useState('');

  // Table page
  const [tablePage, setTablePage] = useState(1);

  // Call detail modal
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [modalAnalysis, setModalAnalysis] = useState<CallAnalysis | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Data fetching
  const fetchSheetCalls = useCallback(async () => {
    setSheetLoading(true);
    try {
      const params: Record<string, unknown> = { source: 'google_sheets', limit: 500, page: 1 };
      if (statusFilter)  params.status       = statusFilter;
      if (managerFilter) params.manager_name = managerFilter;
      if (clientFilter)  params.client_phone = clientFilter;
      if (dateFrom)      params.date_from    = dateFrom;
      if (dateTo)        params.date_to      = dateTo;

      const res = await callApi.listCalls(params);
      setAllSheetCalls((res.data.calls || []) as Call[]);
    } catch {
      console.error('Failed to fetch sheet calls');
    } finally {
      setSheetLoading(false);
    }
  }, [statusFilter, managerFilter, clientFilter, dateFrom, dateTo]);

  useEffect(() => {
    setTablePage(1);
    fetchSheetCalls();
  }, [fetchSheetCalls]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await integrationApi.triggerSheetSync();
      toast.success('Sync triggered — results will appear shortly');
      setTimeout(fetchSheetCalls, 3000);
    } catch {
      toast.error('Failed to trigger sync');
    } finally {
      setSyncing(false);
    }
  };

  const openModal = async (call: Call) => {
    setSelectedCall(call);
    setModalAnalysis(null);
    if (call.status === 'completed') {
      setModalLoading(true);
      try {
        const res = await callApi.getAnalysis(call.id);
        setModalAnalysis(res.data as CallAnalysis);
      } catch {
        // analysis may not exist yet
      } finally {
        setModalLoading(false);
      }
    }
  };

  const closeModal = () => { setSelectedCall(null); setModalAnalysis(null); };

  // Derived data
  const uniqueManagers = useMemo(() =>
    [...new Set(allSheetCalls.map(c => c.manager_name).filter((name): name is string => Boolean(name)))].sort(),
    [allSheetCalls]
  );

  const totalPages = Math.ceil(allSheetCalls.length / PAGE_SIZE);
  const tableRows  = useMemo(() => {
    const start = (tablePage - 1) * PAGE_SIZE;
    return allSheetCalls.slice(start, start + PAGE_SIZE);
  }, [allSheetCalls, tablePage]);

  const qualityOverTime = useMemo(() =>
    allSheetCalls
      .filter(c => c.status === 'completed' && c.quality_score != null && c.call_date)
      .sort((a, b) => a.call_date.localeCompare(b.call_date))
      .map(c => ({
        date: new Date(c.call_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        quality: c.quality_score,
        script:  c.script_match,
        errors:  c.errors_free,
      })),
    [allSheetCalls]
  );

  const perManagerAvg = useMemo(() => {
    const map: Record<string, { quality: number[]; script: number[]; errors: number[] }> = {};
    for (const c of allSheetCalls) {
      if (c.status !== 'completed') continue;
      const name = c.manager_name || 'Unknown';
      if (!map[name]) map[name] = { quality: [], script: [], errors: [] };
      if (c.quality_score != null) map[name].quality.push(c.quality_score);
      if (c.script_match  != null) map[name].script.push(c.script_match);
      if (c.errors_free   != null) map[name].errors.push(c.errors_free);
    }
    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    return Object.entries(map).map(([manager, v]) => ({
      manager: manager.length > 12 ? manager.slice(0, 12) + '…' : manager,
      quality: avg(v.quality),
      script:  avg(v.script),
      errors:  avg(v.errors),
    }));
  }, [allSheetCalls]);

  const hasActiveFilters = !!(statusFilter || managerFilter || clientFilter || dateFrom || dateTo);

  // Export functions
  const buildExportRows = (calls: Call[]) => {
    return calls.map(c => ({
      Date: c.call_date ? new Date(c.call_date).toLocaleDateString() : '',
      Manager: c.manager_name || '',
      Client: c.client_phone || '',
      Duration: c.duration ? `${Math.floor(c.duration / 60)}m ${c.duration % 60}s` : '',
      Status: c.status,
      Quality: c.quality_score ?? '',
      'Script Match': c.script_match ?? '',
      'Errors Free': c.errors_free ?? '',
    }));
  };

  const exportCSV = (calls: Call[]) => {
    const rows = buildExportRows(calls);
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map(r =>
        headers.map(h => JSON.stringify((r as Record<string, unknown>)[h] ?? '')).join(',')
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sheet_calls_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportXlsx = (calls: Call[]) => {
    const rows = buildExportRows(calls);
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet Calls');
    XLSX.writeFile(wb, `sheet_calls_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-[32px] border border-slate-100 dark:border-slate-700 shadow-xl shadow-slate-200/50 dark:shadow-none overflow-hidden">
        {/* Header */}
        <div className="px-8 py-8 border-b border-slate-50 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 flex items-center justify-center">
              <span className="material-icons text-2xl">table_chart</span>
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Google Sheets Data</h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{allSheetCalls.length} processed calls</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center bg-slate-50 dark:bg-slate-900/50 p-1 rounded-xl border border-slate-100 dark:border-slate-700">
               <button
                  onClick={() => exportCSV(allSheetCalls)}
                  disabled={!allSheetCalls.length}
                  className="px-4 py-2 rounded-lg text-xs font-black text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 transition-all disabled:opacity-30"
                >
                  CSV
                </button>
                <button
                  onClick={() => exportXlsx(allSheetCalls)}
                  disabled={!allSheetCalls.length}
                  className="px-4 py-2 rounded-lg text-xs font-black text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-white dark:hover:bg-slate-800 transition-all disabled:opacity-30"
                >
                  EXCEL
                </button>
            </div>

            <button
              onClick={handleSync}
              disabled={syncing}
              className="group flex items-center gap-2 px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-black shadow-lg shadow-slate-900/10 dark:shadow-none transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              <span className={`material-icons text-lg ${syncing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`}>
                {syncing ? 'sync' : 'cloud_sync'}
              </span>
              {syncing ? 'Syncing…' : 'Sync Sheets'}
            </button>
          </div>
        </div>

        {/* New Stats Row */}
        <CallStats calls={allSheetCalls} loading={sheetLoading} />

        {/* Filter bar */}
        <CallFilters
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          managerFilter={managerFilter}
          setManagerFilter={setManagerFilter}
          clientFilter={clientFilter}
          setClientFilter={setClientFilter}
          dateFrom={dateFrom}
          setDateFrom={setDateFrom}
          dateTo={dateTo}
          setDateTo={setDateTo}
          uniqueManagers={uniqueManagers}
          onClear={() => {
            setStatusFilter(''); setManagerFilter(''); setClientFilter('');
            setDateFrom(''); setDateTo(''); setTablePage(1);
          }}
          hasActiveFilters={hasActiveFilters}
        />

        {/* Charts */}
        {!sheetLoading && (qualityOverTime.length > 0 || perManagerAvg.length > 0) && (
          <CallCharts qualityOverTime={qualityOverTime} perManagerAvg={perManagerAvg} />
        )}

        {/* Table */}
        <CallTable
          loading={sheetLoading}
          calls={tableRows}
          onRowClick={openModal}
          hasActiveFilters={hasActiveFilters}
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-8 py-6 border-t border-slate-50 dark:border-slate-700 flex items-center justify-between bg-slate-50/30 dark:bg-slate-800/30">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Showing {((tablePage - 1) * PAGE_SIZE) + 1}–{Math.min(tablePage * PAGE_SIZE, allSheetCalls.length)} of {allSheetCalls.length} calls
            </span>
            <div className="flex gap-2">
              <button
                disabled={tablePage === 1}
                onClick={() => setTablePage(p => p - 1)}
                className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-primary transition-all disabled:opacity-30"
              >
                <span className="material-icons">chevron_left</span>
              </button>

              <div className="flex gap-1">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pg = i + 1;
                  if (totalPages > 5 && tablePage > 3) {
                    pg = tablePage - 2 + i;
                    if (pg > totalPages) pg = totalPages - (4 - i);
                  }

                  return (
                    <button
                      key={pg}
                      onClick={() => setTablePage(pg)}
                      className={`w-10 h-10 rounded-xl text-xs font-black transition-all ${
                        tablePage === pg
                          ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg'
                          : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      {pg}
                    </button>
                  );
                })}
              </div>

              <button
                disabled={tablePage === totalPages}
                onClick={() => setTablePage(p => p + 1)}
                className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 hover:text-primary transition-all disabled:opacity-30"
              >
                <span className="material-icons">chevron_right</span>
              </button>
            </div>
          </div>
        )}

      {/* ── Call detail modal ─────────────────────────────────────────── */}
      {selectedCall && (
        <CallDetailsModal
          call={selectedCall}
          analysis={modalAnalysis}
          loading={modalLoading}
          onClose={closeModal}
          onViewFull={() => navigate(`/calls/${selectedCall.id}`)}
        />
      )}
    </div>
  );
};
