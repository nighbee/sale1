import React from 'react';

interface CallFiltersProps {
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  managerFilter: string;
  setManagerFilter: (m: string) => void;
  clientFilter: string;
  setClientFilter: (c: string) => void;
  dateFrom: string;
  setDateFrom: (d: string) => void;
  dateTo: string;
  setDateTo: (d: string) => void;
  uniqueManagers: string[];
  onClear: () => void;
  hasActiveFilters: boolean;
}

export const CallFilters: React.FC<CallFiltersProps> = ({
  statusFilter, setStatusFilter,
  managerFilter, setManagerFilter,
  clientFilter, setClientFilter,
  dateFrom, setDateFrom,
  dateTo, setDateTo,
  uniqueManagers,
  onClear,
  hasActiveFilters
}) => {
  return (
    <div className="px-6 py-6 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {/* Status Filter */}
        <div className="space-y-2 col-span-1 md:col-span-2 xl:col-span-1">
          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Status</label>
          <div className="flex gap-1.5 flex-wrap">
            {['', 'completed', 'error', 'processing', 'pending'].map(s => (
              <button
                key={s || 'all'}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  statusFilter === s
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg shadow-slate-900/10'
                    : 'bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
              </button>
            ))}
          </div>
        </div>

        {/* Manager Filter */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Manager</label>
          <select
            value={managerFilter}
            title="Filter by manager"
            onChange={e => setManagerFilter(e.target.value)}
            className="w-full px-4 py-2 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all appearance-none"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1rem' }}
          >
            <option value="">All managers</option>
            {uniqueManagers.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        {/* Client Phone */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Client Phone</label>
          <div className="relative">
            <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
            <input
              type="text"
              value={clientFilter}
              onChange={e => setClientFilter(e.target.value)}
              placeholder="Search..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-200 text-sm font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
            />
          </div>
        </div>

        {/* Date Filters */}
        <div className="space-y-2 col-span-1 md:col-span-2 xl:col-span-2">
          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Date Range</label>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <input
                type="date"
                value={dateFrom}
                title="Start date"
                onChange={e => setDateFrom(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
              />
            </div>
            <div className="relative flex-1">
              <input
                type="date"
                value={dateTo}
                title="End date"
                onChange={e => setDateTo(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex justify-end">
          <button
            onClick={onClear}
            className="flex items-center gap-2 px-4 py-2 text-xs font-black text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 rounded-xl transition-all uppercase tracking-widest"
          >
            <span className="material-icons text-sm">backspace</span>
            Reset Filters
          </button>
        </div>
      )}
    </div>
  );
};
