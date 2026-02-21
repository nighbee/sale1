import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';
import type { LeaderboardEntry } from "@entities/analytics";

interface ComparisonChartProps {
  data: LeaderboardEntry[];
}

export const ComparisonChart: React.FC<ComparisonChartProps> = ({ data }) => {
  const [type, setType] = useState<'bar' | 'radar'>('bar');
  const topData = data.slice(0, 5);

  const barData = topData.map(m => ({
    name: m.manager_name.split(' ')[0],
    Quality: +m.avg_quality.toFixed(1),
    Script: +m.avg_script_match.toFixed(1),
    Errors: +m.avg_errors_free.toFixed(1),
  }));

  // Radar data needs specific format per dimension
  const radarData = [
    { subject: 'Quality', fullMark: 100 },
    { subject: 'Script Match', fullMark: 100 },
    { subject: 'Errors Free', fullMark: 100 },
    { subject: 'KPI', fullMark: 100 },
  ].map(base => {
    const entry: any = { ...base };
    const maxKpi = Math.max(...topData.map(m => m.avg_kpi), 1);
    topData.forEach(m => {
      const key = m.manager_name.split(' ')[0];
      if (base.subject === 'Quality') entry[key] = m.avg_quality;
      if (base.subject === 'Script Match') entry[key] = m.avg_script_match;
      if (base.subject === 'Errors Free') entry[key] = m.avg_errors_free;
      if (base.subject === 'KPI') entry[key] = (m.avg_kpi / maxKpi) * 100;
    });
    return entry;
  });

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#ec4899'];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-wider">Top 5 Comparison</h3>
          <p className="text-[10px] text-slate-400 font-bold mt-1">CROSS-METRIC ANALYTICS</p>
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          <button
            onClick={() => setType('bar')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${
              type === 'bar' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-500'
            }`}
          >
            Bar
          </button>
          <button
            onClick={() => setType('radar')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${
              type === 'radar' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-500'
            }`}
          >
            Radar
          </button>
        </div>
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {type === 'bar' ? (
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} domain={[0, 100]} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
              <Bar dataKey="Quality" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={12} />
              <Bar dataKey="Script" fill="#10b981" radius={[4, 4, 0, 0]} barSize={12} />
              <Bar dataKey="Errors" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={12} />
            </BarChart>
          ) : (
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fontWeight: 'bold' }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
              {topData.map((m, idx) => (
                <Radar
                  key={m.manager_id}
                  name={m.manager_name.split(' ')[0]}
                  dataKey={m.manager_name.split(' ')[0]}
                  stroke={COLORS[idx]}
                  fill={COLORS[idx]}
                  fillOpacity={0.1}
                />
              ))}
              <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
              <Tooltip />
            </RadarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};
