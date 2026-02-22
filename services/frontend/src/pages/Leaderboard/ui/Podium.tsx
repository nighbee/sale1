import React from "react";
import { ScoreBar } from "../../../shared/ui/ScoreBar";

interface LeaderboardEntry {
  manager_id: string;
  manager_name: string;
  total_calls: number;
  avg_quality: number;
  avg_script_match: number;
  avg_errors_free: number;
  avg_overall_rating: number;
  avg_kpi: number;
  total_duration_minutes: number;
}

interface PodiumProps {
  data: LeaderboardEntry[];
}

const MEDAL_BG = ["bg-amber-400", "bg-slate-400", "bg-orange-400"];
const MEDAL_LABELS = ["🥇", "🥈", "🥉"];
const BAR_COLOR = {
  quality: "bg-indigo-500",
  script: "bg-emerald-500",
  errors: "bg-amber-400",
};
const TEXT_COLOR = {
  quality: "text-indigo-500",
  script: "text-emerald-500",
  errors: "text-amber-500",
};

export const Podium: React.FC<PodiumProps> = ({ data }) => {
  const topThree = data.slice(0, 3);
  if (topThree.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-end">
      {/* 2nd */}
      {topThree[1] ? (
        <div className="order-2 md:order-1">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center">
            <div className="relative mb-3">
              <div
                className={`h-16 w-16 rounded-full flex items-center justify-center text-white font-bold text-xl ${MEDAL_BG[1]}`}
              >
                {topThree[1].manager_name?.[0]?.toUpperCase()}
              </div>
              <div className="absolute -bottom-1 -right-1 text-lg">
                {MEDAL_LABELS[1]}
              </div>
            </div>
            <p className="font-bold text-slate-900 dark:text-white">
              {topThree[1].manager_name}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {topThree[1].total_calls} calls
            </p>
            <div className="mt-4 w-full space-y-2">
              <ScoreBar
                value={topThree[1].avg_quality}
                barClassName={BAR_COLOR.quality}
                textClassName={TEXT_COLOR.quality}
              />
              <ScoreBar
                value={topThree[1].avg_script_match}
                barClassName={BAR_COLOR.script}
                textClassName={TEXT_COLOR.script}
              />
              <ScoreBar
                value={topThree[1].avg_errors_free}
                barClassName={BAR_COLOR.errors}
                textClassName={TEXT_COLOR.errors}
              />
            </div>
            <div className="mt-4 bg-slate-50 dark:bg-slate-800 rounded-lg px-4 py-2 w-full">
              <div className="text-2xl font-bold text-primary">
                {topThree[1].avg_kpi.toFixed(1)}
              </div>
              <div className="text-xs text-slate-500">KPI Score</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="order-2 md:order-1" />
      )}

      {/* 1st */}
      <div className="order-1 md:order-2 md:-mt-6 relative">
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-yellow-400 animate-bounce">
          <span className="material-icons text-4xl">emoji_events</span>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-lg border-2 border-primary/20 flex flex-col items-center text-center">
          <div className="relative mb-4">
            <div
              className={`h-20 w-20 rounded-full ring-4 ring-yellow-400/30 flex items-center justify-center text-white font-black text-2xl ${MEDAL_BG[0]}`}
            >
              {topThree[0].manager_name?.[0]?.toUpperCase()}
            </div>
            <div className="absolute -bottom-1 -right-1 text-xl">
              {MEDAL_LABELS[0]}
            </div>
          </div>
          <p className="font-bold text-lg text-slate-900 dark:text-white">
            {topThree[0].manager_name}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {topThree[0].total_calls} calls ·{" "}
            {topThree[0].total_duration_minutes.toFixed(0)} min
          </p>
          <div className="mt-5 w-full space-y-2">
            <ScoreBar
              value={topThree[0].avg_quality}
              barClassName={BAR_COLOR.quality}
              textClassName={TEXT_COLOR.quality}
            />
            <ScoreBar
              value={topThree[0].avg_script_match}
              barClassName={BAR_COLOR.script}
              textClassName={TEXT_COLOR.script}
            />
            <ScoreBar
              value={topThree[0].avg_errors_free}
              barClassName={BAR_COLOR.errors}
              textClassName={TEXT_COLOR.errors}
            />
          </div>
          <div className="mt-5 bg-primary/5 border border-primary/10 rounded-lg px-4 py-3 w-full">
            <div className="text-4xl font-black text-primary tracking-tight">
              {topThree[0].avg_kpi.toFixed(1)}
            </div>
            <div className="text-sm text-slate-500 font-medium">KPI Score</div>
          </div>
        </div>
      </div>

      {/* 3rd */}
      {topThree[2] ? (
        <div className="order-3 md:order-3">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 shadow border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center">
            <div className="relative mb-3">
              <div
                className={`h-16 w-16 rounded-full flex items-center justify-center text-white font-bold text-xl ${MEDAL_BG[2]}`}
              >
                {topThree[2].manager_name?.[0]?.toUpperCase()}
              </div>
              <div className="absolute -bottom-1 -right-1 text-lg">
                {MEDAL_LABELS[2]}
              </div>
            </div>
            <p className="font-bold text-slate-900 dark:text-white">
              {topThree[2].manager_name}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {topThree[2].total_calls} calls
            </p>
            <div className="mt-4 w-full space-y-2">
              <ScoreBar
                value={topThree[2].avg_quality}
                barClassName={BAR_COLOR.quality}
                textClassName={TEXT_COLOR.quality}
              />
              <ScoreBar
                value={topThree[2].avg_script_match}
                barClassName={BAR_COLOR.script}
                textClassName={TEXT_COLOR.script}
              />
              <ScoreBar
                value={topThree[2].avg_errors_free}
                barClassName={BAR_COLOR.errors}
                textClassName={TEXT_COLOR.errors}
              />
            </div>
            <div className="mt-4 bg-slate-50 dark:bg-slate-800 rounded-lg px-4 py-2 w-full">
              <div className="text-2xl font-bold text-primary">
                {topThree[2].avg_kpi.toFixed(1)}
              </div>
              <div className="text-xs text-slate-500">KPI Score</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="order-3 md:order-3" />
      )}
    </div>
  );
};
