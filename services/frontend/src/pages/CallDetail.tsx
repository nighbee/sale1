import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { callApi } from '../api/client';

const CallDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [call, setCall] = useState<any>(null);
  const [transcript, setTranscript] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const audioRef = useRef<HTMLAudioElement>(null);
  const activeSegmentRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (activeSegmentRef.current && isPlaying) {
      activeSegmentRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentTime, isPlaying]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const seek = (amount: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime += amount;
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        const [callRes, transRes, analRes] = await Promise.all([
          callApi.getCall(id),
          callApi.getTranscript(id),
          callApi.getAnalysis(id),
        ]);
        setCall(callRes.data);
        setTranscript(transRes.data);
        setAnalysis(analRes.data);
      } catch (err) {
        console.error('Failed to fetch call data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading) return <div className="p-8">Loading call details...</div>;
  if (!call) return <div className="p-8">Call not found.</div>;

  return (
    <div className="bg-background-light dark:bg-background-dark text-neutral-800 dark:text-neutral-100 font-display min-h-screen flex flex-col overflow-hidden">
      <header className="bg-surface-light dark:bg-surface-dark border-b border-neutral-200 dark:border-neutral-700 h-16 flex items-center px-6 shrink-0 z-20">
        <div className="flex items-center gap-4 w-full">
          <button onClick={() => window.history.back()} className="text-neutral-500 hover:text-primary dark:text-neutral-400 dark:hover:text-primary transition-colors flex items-center gap-1 text-sm font-medium">
            <span className="material-icons text-lg">arrow_back</span> Back
          </button>
          <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-700 mx-2"></div>
          <h1 className="text-lg font-bold text-neutral-900 dark:text-white">Call with {call.manager_name}</h1>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800 uppercase">
            {call.status}
          </span>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <aside className="w-72 bg-surface-light dark:bg-surface-dark border-r border-neutral-200 dark:border-neutral-700 flex flex-col shrink-0 overflow-y-auto hidden lg:flex">
          <div className="p-6 space-y-6">
            <div className="flex flex-col items-center p-6 rounded-xl bg-neutral-50 dark:bg-neutral-800/30 border border-neutral-100 dark:border-neutral-700">
              <div className="h-20 w-20 rounded-full overflow-hidden bg-primary/10 mb-3 border-4 border-white dark:border-neutral-700 shadow-sm flex items-center justify-center">
                 <span className="material-icons text-4xl text-primary">person</span>
              </div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">{call.manager_name}</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Sales Representative</p>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-4">Call Metadata</h4>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary"><span className="material-icons text-sm">event</span></div>
                  <div><p className="text-xs text-neutral-500">Date</p><p className="text-sm font-medium">{new Date(call.call_date).toLocaleDateString()}</p></div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary"><span className="material-icons text-sm">timer</span></div>
                  <div><p className="text-xs text-neutral-500">Duration</p><p className="text-sm font-medium">{Math.floor(call.duration / 60)}:{(call.duration % 60).toString().padStart(2, '0')}</p></div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <section className="flex-1 flex flex-col relative bg-background-light dark:bg-background-dark overflow-hidden">
          <audio
            ref={audioRef}
            src={call.audio_url || "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"}
            onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
            onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
            onEnded={() => setIsPlaying(false)}
          />
          <div className="shrink-0 bg-surface-light dark:bg-surface-dark border-b border-neutral-200 dark:border-neutral-700 p-6 z-10 shadow-sm">
            <div
              className="relative h-16 w-full mb-4 group cursor-pointer bg-neutral-100 dark:bg-neutral-800 rounded overflow-hidden"
              onClick={(e) => {
                if (audioRef.current) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const pct = x / rect.width;
                  audioRef.current.currentTime = pct * duration;
                }
              }}
            >
               {/* Simple progress bar instead of placeholder */}
               <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs z-0">
                 {Array.from({ length: 60 }).map((_, i) => (
                   <div
                     key={i}
                     className="w-1 mx-0.5 bg-primary/20 rounded-full"
                     style={{ height: `${20 + Math.random() * 60}%` }}
                   />
                 ))}
               </div>
               <div
                 className="absolute top-0 bottom-0 left-0 bg-primary/30 border-r-2 border-primary transition-all duration-100 ease-linear"
                 style={{ width: `${(currentTime / duration) * 100}%` }}
               />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  className="text-neutral-500 hover:text-primary transition-colors"
                  onClick={() => seek(-10)}
                >
                  <span className="material-icons">replay_10</span>
                </button>
                <button
                  className="h-10 w-10 bg-primary text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
                  onClick={togglePlay}
                >
                  <span className="material-icons">{isPlaying ? 'pause' : 'play_arrow'}</span>
                </button>
                <button
                  className="text-neutral-500 hover:text-primary transition-colors"
                  onClick={() => seek(10)}
                >
                  <span className="material-icons">forward_10</span>
                </button>
                <div className="text-sm font-mono font-medium text-neutral-600 dark:text-neutral-300 ml-2">
                   {formatTime(currentTime)} / {formatTime(duration)}
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 scroll-smooth">
            {transcript?.segments?.map((seg: any, i: number) => {
              const isActive = currentTime >= seg.start && currentTime <= seg.end;
              return (
                <div
                  key={i}
                  ref={isActive ? activeSegmentRef : null}
                  className={`group flex gap-4 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/30 p-3 rounded-xl transition-all duration-300 ${
                    isActive ? 'opacity-100 bg-primary/5 ring-1 ring-primary/20 shadow-sm' : 'opacity-60'
                  }`}
                  onClick={() => {
                    if (audioRef.current) {
                      audioRef.current.currentTime = seg.start;
                      if (!isPlaying) {
                        audioRef.current.play();
                        setIsPlaying(true);
                      }
                    }
                  }}
                >
                  <div className="w-16 shrink-0 text-right">
                    <span className={`text-xs font-mono mt-1 block ${isActive ? 'text-primary font-bold' : 'text-neutral-400'}`}>
                      {Math.floor(seg.start / 60)}:{(seg.start % 60).toFixed(0).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className={`font-semibold text-sm ${seg.speaker === 'SPEAKER_0' ? 'text-primary' : 'text-neutral-700'}`}>
                        {seg.speaker === 'SPEAKER_0' ? 'Agent' : 'Client'}
                      </span>
                    </div>
                    <p className={`text-neutral-800 dark:text-neutral-200 leading-relaxed ${isActive ? 'font-medium' : ''}`}>
                      {seg.text}
                    </p>
                  </div>
                </div>
              );
            })}
            {!transcript && <p className="text-center text-slate-500">Transcript being processed...</p>}
          </div>
        </section>

        <aside className="w-80 bg-surface-light dark:bg-surface-dark border-l border-neutral-200 dark:border-neutral-700 flex flex-col shrink-0 overflow-y-auto">
          <div className="p-6 space-y-8">
            <div>
              <h2 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2 mb-4">
                <span className="material-icons text-primary text-lg">analytics</span> AI Analysis
              </h2>
              {analysis ? (
                <div className="space-y-4">
                  <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-4 border border-neutral-100 dark:border-neutral-700 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-neutral-500">Quality Score</p>
                      <p className="text-2xl font-bold text-neutral-900 dark:text-white mt-1">{analysis.quality_score}<span className="text-sm text-neutral-400 font-normal">/100</span></p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-3 border border-neutral-100">
                      <p className="text-xs text-neutral-500 mb-1">Script Match</p>
                      <span className="text-xl font-bold">{analysis.script_match}%</span>
                    </div>
                    <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-xl p-3 border border-neutral-100">
                      <p className="text-xs text-neutral-500 mb-1">Errors Free</p>
                      <span className="text-xl font-bold">{analysis.errors_free}%</span>
                    </div>
                  </div>
                  <div className="bg-blue-50 dark:bg-primary/10 rounded-xl p-4 border border-blue-100">
                     <h3 className="text-xs font-bold uppercase mb-2">Recommendation</h3>
                     <p className="text-sm">{analysis.recommendation}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Analysis pending...</p>
              )}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default CallDetail;
