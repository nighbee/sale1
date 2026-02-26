import React from 'react';
import type { Call, CallAnalysis } from '../../../entities/call/types';

interface CallDetailsModalProps {
  call: Call;
  analysis: CallAnalysis | null;
  loading: boolean;
  onClose: () => void;
  onViewFull: () => void;
}

const STATUS_PILL: Record<string, string> = {
  completed:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  error:      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  processing: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  pending:    'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
};

const SCORE_COLORS = {
  indigo: {
    bg: 'bg-indigo-50/50 dark:bg-indigo-900/10',
    border: 'border-indigo-100/50 dark:border-indigo-900/20',
    text: 'text-indigo-600 dark:text-indigo-400',
    label: 'text-indigo-600/70',
    accent: 'text-indigo-600/50'
  },
  emerald: {
    bg: 'bg-emerald-50/50 dark:bg-emerald-900/10',
    border: 'border-emerald-100/50 dark:border-emerald-900/20',
    text: 'text-emerald-600 dark:text-emerald-400',
    label: 'text-emerald-600/70',
    accent: 'text-emerald-600/50'
  },
  rose: {
    bg: 'bg-rose-50/50 dark:bg-rose-900/10',
    border: 'border-rose-100/50 dark:border-rose-900/20',
    text: 'text-rose-600 dark:text-rose-400',
    label: 'text-rose-600/70',
    accent: 'text-rose-600/50'
  }
} as const;

export const CallDetailsModal: React.FC<CallDetailsModalProps> = ({
  call,
  analysis,
  loading,
  onClose,
  onViewFull
}) => {
  const scores = [
    { label: 'Quality', value: call.quality_score, icon: 'analytics', color: SCORE_COLORS.indigo },
    { label: 'Script Match', value: call.script_match, icon: 'task_alt', color: SCORE_COLORS.emerald },
    { label: 'Errors Free', value: call.errors_free, icon: 'security', color: SCORE_COLORS.rose },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 dark:border-slate-700 shrink-0 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
              {call.manager_name?.[0] || '?'}
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">{call.manager_name || '—'}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                <span className="material-icons text-[14px]">phone</span> {call.client_phone || '—'}
                <span className="opacity-30">|</span>
                <span className="material-icons text-[14px]">calendar_today</span> {call.call_date ? new Date(call.call_date).toLocaleDateString() : '—'}
                <span className="opacity-30">|</span>
                <span className="material-icons text-[14px]">schedule</span> {call.duration ? `${Math.floor(call.duration / 60)}m ${call.duration % 60}s` : '—'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${STATUS_PILL[call.status] || STATUS_PILL.pending}`}>
              {call.status}
            </span>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700 shadow-sm transition-all"
            >
              <span className="material-icons">close</span>
            </button>
          </div>
        </div>

        {/* Modal body */}
        <div className="overflow-y-auto flex-1 px-8 py-8 space-y-8">
          {/* Score cards */}
          <div className="grid grid-cols-3 gap-4">
            {scores.map(s => (
              <div key={s.label} className={`rounded-2xl p-5 ${s.color.bg} border ${s.color.border} text-center relative overflow-hidden group`}>
                <span className={`material-icons absolute -right-2 -bottom-2 text-4xl opacity-5 ${s.color.text}`}>{s.icon}</span>
                <p className={`text-[10px] font-bold uppercase tracking-widest ${s.color.label} mb-2`}>{s.label}</p>
                <div className="flex items-baseline justify-center gap-0.5">
                  <p className={`text-3xl font-black ${s.color.text}`}>{s.value != null ? s.value : '—'}</p>
                  {s.value != null && <p className={`text-xs font-bold ${s.color.accent}`}>%</p>}
                </div>
              </div>
            ))}
          </div>

          {call.status !== 'completed' && (
            <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
              <span className="material-icons text-5xl text-slate-300 mb-4 animate-pulse">hourglass_top</span>
              <p className="text-slate-500 font-medium">Analysis is being prepared</p>
              <p className="text-xs text-slate-400 mt-1">This call is currently <strong>{call.status}</strong></p>
            </div>
          )}

          {call.status === 'completed' && loading && (
            <div className="space-y-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="space-y-2">
                  <div className="h-4 w-32 bg-slate-100 dark:bg-slate-700 rounded animate-pulse" />
                  <div className="h-20 bg-slate-50 dark:bg-slate-700/50 rounded-2xl animate-pulse" />
                </div>
              ))}
            </div>
          )}

          {!loading && analysis && (
            <div className="space-y-6">
              {/* Brief */}
              {analysis.brief && (
                <div className="group">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 group-hover:text-primary transition-colors">
                      <span className="material-icons text-[18px]">summarize</span>
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Call Summary</h3>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/30 rounded-2xl p-5 border border-slate-100 dark:border-slate-700/50 group-hover:border-primary/20 transition-all">
                    <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed italic">"{analysis.brief}"</p>
                  </div>
                </div>
              )}

              {/* Recommendation */}
              {analysis.recommendation && (
                <div className="group">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-500">
                      <span className="material-icons text-[18px]">psychology</span>
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-blue-600/70 dark:text-blue-400/70">Coaching Insight</h3>
                  </div>
                  <div className="bg-blue-50/30 dark:bg-blue-900/10 rounded-2xl p-5 border border-blue-100 dark:border-blue-900/20">
                    <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{analysis.recommendation}</p>
                  </div>
                </div>
              )}

              {/* Next steps */}
              {analysis.next_best_action && (
                <div className="group">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500">
                      <span className="material-icons text-[18px]">rocket_launch</span>
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-600/70 dark:text-emerald-400/70">Next Steps</h3>
                  </div>
                  <div className="bg-emerald-50/30 dark:bg-emerald-900/10 rounded-2xl p-5 border border-emerald-100 dark:border-emerald-900/20">
                    <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line font-medium">{analysis.next_best_action}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal footer */}
        <div className="px-8 py-6 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center shrink-0 bg-slate-50/30 dark:bg-slate-800/30">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            Dismiss
          </button>
          <button
            onClick={onViewFull}
            className="flex items-center gap-2 px-8 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-sm font-bold shadow-xl shadow-slate-900/10 dark:shadow-none hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <span className="material-icons text-[18px]">open_in_full</span>
            Deep Analysis
          </button>
        </div>
      </div>
    </div>
  );
};
