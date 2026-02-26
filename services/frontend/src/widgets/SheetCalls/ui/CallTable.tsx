import React from 'react';
import type { Call } from '../../../entities/call/types';
import Skeleton from '../../../shared/ui/Skeleton';
import { ScoreBar } from '../../../shared/ui/ScoreBar';
import { ScoreBadge } from '../../../shared/ui/ScoreBadge';

interface CallTableProps {
  loading: boolean;
  calls: Call[];
  onRowClick: (call: Call) => void;
  hasActiveFilters: boolean;
}

const STATUS_PILL: Record<string, string> = {
  completed:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  error:      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  processing: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  pending:    'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
};

export const CallTable: React.FC<CallTableProps> = ({
  loading,
  calls,
  onRowClick,
  hasActiveFilters
}) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left border-collapse">
        <thead>
          <tr className="bg-slate-50/50 dark:bg-slate-800/50 text-[10px] uppercase font-bold tracking-widest text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-700">
            <th className="px-6 py-4 font-black">Date</th>
            <th className="px-6 py-4 font-black">Manager</th>
            <th className="px-6 py-4 font-black">Client</th>
            <th className="px-6 py-4 font-black">Duration</th>
            <th className="px-6 py-4 text-center font-black">Status</th>
            <th className="px-6 py-4 font-black">Quality</th>
            <th className="px-6 py-4 font-black">Script</th>
            <th className="px-6 py-4 font-black">Errors Free</th>
            <th className="px-6 py-4 w-10" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 9 }).map((__, j) => (
                    <td key={j} className="px-6 py-5"><Skeleton className="h-4 w-full" /></td>
                  ))}
                </tr>
              ))
            : calls.length === 0
              ? (
                <tr>
                  <td colSpan={9} className="px-6 py-24 text-center text-slate-500 dark:text-slate-400">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-700/50 flex items-center justify-center">
                        <span className="material-icons text-3xl opacity-20">cloud_off</span>
                      </div>
                      <div>
                        <p className="font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-sm">No calls found</p>
                        <p className="text-xs mt-1 max-w-xs mx-auto opacity-60">
                          {hasActiveFilters
                            ? 'Your current filters are too restrictive. Try adjusting them to see more results.'
                            : 'Wait for the next synchronization or click Sync Now to import new calls.'}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              )
              : calls.map(call => (
                <tr
                  key={call.id}
                  onClick={() => onRowClick(call)}
                  className="group hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-all cursor-pointer relative"
                >
                  <td className="px-6 py-5 text-slate-400 dark:text-slate-500 whitespace-nowrap text-xs font-bold">
                    {call.call_date ? new Date(call.call_date).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center text-xs font-black group-hover:bg-primary group-hover:text-white group-hover:shadow-lg group-hover:shadow-primary/20 transition-all">
                        {call.manager_name?.[0] || '?'}
                      </div>
                      <span className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-primary transition-colors">{call.manager_name || '—'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-slate-500 dark:text-slate-400 font-mono text-xs font-medium">{call.client_phone || '—'}</td>
                  <td className="px-6 py-5 text-slate-500 dark:text-slate-400 whitespace-nowrap text-xs font-medium">
                    <div className="flex items-center gap-1.5">
                      <span className="material-icons text-sm opacity-30">schedule</span>
                      {call.duration ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s` : '—'}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${STATUS_PILL[call.status] || STATUS_PILL.pending}`}>
                      {call.status}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <ScoreBadge
                      score={call.quality_score || 0}
                      className="scale-90 origin-left"
                    />
                  </td>
                  <td className="px-6 py-5">
                    <ScoreBar
                      value={call.script_match || 0}
                      barClassName="bg-indigo-400"
                      textClassName="text-slate-500 dark:text-slate-400 font-bold"
                    />
                  </td>
                  <td className="px-6 py-5">
                    <ScoreBar
                      value={call.errors_free || 0}
                      barClassName="bg-rose-400"
                      textClassName="text-slate-500 dark:text-slate-400 font-bold"
                    />
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 group-hover:text-primary group-hover:bg-primary/10 transition-all">
                      <span className="material-icons text-xl">chevron_right</span>
                    </div>
                  </td>
                </tr>
              ))
          }
        </tbody>
      </table>
    </div>
  );
};
