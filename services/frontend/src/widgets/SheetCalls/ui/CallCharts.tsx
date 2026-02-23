import React from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

interface CallChartsProps {
  qualityOverTime: any[];
  perManagerAvg: any[];
}

const CHART_COLORS = { quality: '#6366f1', script: '#10b981', errors: '#f59e0b' };

export const CallCharts: React.FC<CallChartsProps> = ({ qualityOverTime, perManagerAvg }) => {
  return (
    <div className="px-6 py-10 border-b border-slate-100 dark:border-slate-700 grid grid-cols-1 xl:grid-cols-2 gap-12 bg-white dark:bg-slate-800">
      {qualityOverTime.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500">
                <span className="material-icons text-lg">show_chart</span>
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest">Score Dynamics</h3>
                <p className="text-[10px] text-slate-400 font-medium">Performance trends over the selected period</p>
              </div>
            </div>
          </div>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={qualityOverTime} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                  dy={10}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '16px',
                    border: 'none',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    padding: '12px'
                  }}
                  cursor={{ stroke: '#e2e8f0', strokeWidth: 1 }}
                />
                <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', paddingTop: '20px' }} />
                <Line
                  type="monotone"
                  dataKey="quality"
                  name="Quality"
                  stroke={CHART_COLORS.quality}
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
                <Line type="monotone" dataKey="script"  name="Script"      stroke={CHART_COLORS.script}  strokeWidth={2} strokeDasharray="5 5" dot={false} />
                <Line type="monotone" dataKey="errors"  name="Errors Free" stroke={CHART_COLORS.errors}  strokeWidth={2} strokeDasharray="3 3" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {perManagerAvg.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500">
                <span className="material-icons text-lg">leaderboard</span>
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest">Manager Rankings</h3>
                <p className="text-[10px] text-slate-400 font-medium">Average performance by team member</p>
              </div>
            </div>
          </div>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={perManagerAvg} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="manager"
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                  dy={10}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '16px',
                    border: 'none',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    padding: '12px'
                  }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Legend iconType="circle" iconSize={6} wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', paddingTop: '20px' }} />
                <Bar dataKey="quality" name="Quality"     fill={CHART_COLORS.quality} radius={[6,6,0,0]} barSize={24} />
                <Bar dataKey="script"  name="Script"      fill={CHART_COLORS.script}  radius={[6,6,0,0]} barSize={24} />
                <Bar dataKey="errors"  name="Errors Free" fill={CHART_COLORS.errors}  radius={[6,6,0,0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
