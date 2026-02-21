import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { PageLayout } from "@widgets/PageLayout";
import { Podium, AnalyticsTable, ComparisonChart } from "@widgets/Leaderboard";
import { LeaderboardFilters } from "@features/analytics/filter-leaderboard";
import {
  analyticsApi,
  type LeaderboardEntry,
  type Period,
  type Source,
  type SortKey
} from "@entities/analytics";
import { useUserStore } from "@entities/user/model/store";

const LeaderboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { currentTeamId } = useUserStore();

  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [period, setPeriod] = useState<Period>('30d');
  const [source, setSource] = useState<Source>('');
  const [sortBy, setSortBy] = useState<SortKey>('avg_kpi');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { sort_by: sortBy };
      if (currentTeamId) params.team_id = currentTeamId;
      if (period) params.period = period;
      if (source) params.source = source;

      const res = await analyticsApi.getLeaderboard(params);
      const responseData = res.data as { leaderboard?: LeaderboardEntry[] };
      setData(responseData.leaderboard || []);
    } catch (err) {
      console.error('Failed to fetch leaderboard', err);
    } finally {
      setLoading(false);
    }
  }, [currentTeamId, period, source, sortBy]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = async (format: string) => {
    try {
      const params: any = { sort_by: sortBy };
      if (currentTeamId) params.team_id = currentTeamId;
      if (period) params.period = period;
      if (source) params.source = source;

      const res = await analyticsApi.exportLeaderboard(format, params);
      const url = window.URL.createObjectURL(new Blob([res.data as BlobPart]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `leaderboard_${period || 'all'}.${format === 'excel' ? 'xlsx' : format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export failed', err);
    }
  };

  return (
    <PageLayout title={t('leaderboard.title')}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {t('leaderboard.title')}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1 uppercase tracking-wider">
              {t('leaderboard.subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative group">
              <button className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-200 dark:shadow-none hover:scale-105 transition-all">
                <span className="material-icons text-sm">download</span>
                Export
              </button>
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden hidden group-hover:block z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                {['csv', 'excel', 'pdf'].map(fmt => (
                  <button
                    key={fmt}
                    onClick={() => handleExport(fmt)}
                    className="w-full text-left px-5 py-4 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-3 text-slate-600 dark:text-slate-300"
                  >
                    <span className="material-icons text-slate-400 text-sm">
                      {fmt === 'pdf' ? 'picture_as_pdf' : fmt === 'csv' ? 'description' : 'table_view'}
                    </span>
                    {fmt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Filters Feature */}
        <LeaderboardFilters
          period={period}
          source={source}
          sortBy={sortBy}
          onPeriodChange={setPeriod}
          onSourceChange={setSource}
          onSortChange={setSortBy}
        />

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
            <div className="h-80 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse md:mt-[-20px]" />
            <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
          </div>
        ) : data.length === 0 ? (
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800 py-32 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
              <span className="material-icons text-4xl text-slate-300">leaderboard</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">No data found</h3>
            <p className="text-slate-500 max-w-xs mt-2 text-sm font-medium">
              We couldn't find any analyzed calls for the selected filters.
            </p>
          </div>
        ) : (
          <>
            {/* Podium Widget */}
            <Podium topManagers={data.slice(0, 3)} />

            {/* Analytics Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <AnalyticsTable data={data} />
              </div>
              <div className="space-y-8">
                <ComparisonChart data={data} />

                {/* Info Card */}
                <div className="bg-gradient-to-br from-primary to-indigo-700 rounded-3xl p-8 text-white shadow-xl shadow-primary/20">
                  <div className="bg-white/20 w-12 h-12 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-md">
                    <span className="material-icons">insights</span>
                  </div>
                  <h4 className="text-lg font-black uppercase tracking-tight leading-tight">
                    Performance Insight
                  </h4>
                  <p className="text-sm text-white/80 mt-3 font-medium leading-relaxed">
                    The average KPI has increased by <span className="text-white font-black">12.5%</span> this week. Top performers are showing consistent script adherence.
                  </p>
                  <button className="mt-8 bg-white text-primary px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-black/10 hover:bg-slate-50 transition-all">
                    View Full Analysis
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
};

export default LeaderboardPage;
