import React, { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../../../shared/api/base";
import { CallTranscript as CallTranscriptWidget } from "../../../widgets/CallTranscript";
import { CallAnalysis as CallAnalysisWidget } from "../../../widgets/CallAnalysis";
import { ReprocessButton } from "../../../features/reprocess-call/ui/ReprocessButton";
import { useCall } from "../../../entities/call/model/hooks";

const CallDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { call, transcript, analysis, loading } = useCall(id);

  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  // Waveform data should be stable and deterministic per call id.
  const waveformData = useRef<number[]>([]);

  const hashStringToSeed = (s: string) => {
    // FNV-1a 32-bit hash
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h;
  };

  const seededRandom = (seed: number) => {
    let state = seed >>> 0;
    return () => {
      // LCG parameters (Numerical Recipes)
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
  };

  const generateWaveform = (seedStr: string, len = 60) => {
    const seed = hashStringToSeed(seedStr || "default");
    const rnd = seededRandom(seed);
    return Array.from({ length: len }).map(() => 20 + Math.floor(rnd() * 60));
  };

  const generateWaveformFromUrl = async (url: string | undefined, len = 60) => {
    if (!url) return generateWaveform("fallback", len);
    try {
      const resp = await fetch(url);
      const arrayBuffer = await resp.arrayBuffer();
      const AudioCtx =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      // decodeAudioData may not return a promise in older browsers, but modern browsers support it
      const audioBuffer: AudioBuffer =
        await audioCtx.decodeAudioData(arrayBuffer);

      const channelData = [] as Float32Array[];
      for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
        channelData.push(audioBuffer.getChannelData(ch));
      }

      const samples = audioBuffer.length;
      const samplesPerBucket = Math.max(1, Math.floor(samples / len));
      const values: number[] = [];

      for (let i = 0; i < len; i++) {
        const start = i * samplesPerBucket;
        const end = Math.min(start + samplesPerBucket, samples);
        let sum = 0;
        let count = 0;
        for (let s = start; s < end; s++) {
          // combine channels
          let sampleSum = 0;
          for (let ch = 0; ch < channelData.length; ch++) {
            sampleSum += Math.abs(channelData[ch][s] || 0);
          }
          const sample = sampleSum / channelData.length;
          sum += sample * sample;
          count++;
        }
        const rms = count > 0 ? Math.sqrt(sum / count) : 0;
        values.push(rms);
      }

      // normalize to 20..80 range for visual
      const max = Math.max(...values, 1e-6);
      const scaled = values.map((v) => 20 + Math.floor((v / max) * 60));

      audioCtx.close();
      return scaled;
    } catch (err) {
      // fallback to deterministic pseudo-random waveform
      console.warn("waveform generation failed, falling back to seeded:", err);
      return generateWaveform("fallback", len);
    }
  };

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

  const handlePlaybackRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const downloadAudio = () => {
    if (!audioSrc) return;
    const link = document.createElement('a');
    link.href = audioSrc;
    link.download = `call-${call?.id || 'audio'}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const seek = (amount: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime += amount;
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleSegmentClick = (start: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = start;
      if (!isPlaying) {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  useEffect(() => {
    if (!call) return;
    const callData = call;
    // Determine audio source: prefer audio_url, otherwise fetch via API (/calls/:id/audio)
    (async () => {
      try {
        if (callData.audio_url) {
          setAudioSrc(callData.audio_url);
          const wf = await generateWaveformFromUrl(callData.audio_url);
          waveformData.current = wf;
        } else {
          // The backend may return either a JSON { presigned_url } (when presign is enabled)
          // or stream binary audio. Try to detect presigned URL first; if that fails,
          // fallback to fetching the audio blob.
          try {
            const presignResp = await api.get(
              `/calls/${callData.id}/audio`,
            );
            const presignData = presignResp?.data as
              | Record<string, unknown>
              | undefined;
            if (
              presignData &&
              typeof presignData.presigned_url === "string"
            ) {
              const presigned = presignData.presigned_url as string;
              setAudioSrc(presigned);
              const wf = await generateWaveformFromUrl(presigned);
              waveformData.current = wf;
            } else {
              // Not JSON with presigned_url; request blob explicitly
              const resp = await api.get<Blob>(
                `/calls/${callData.id}/audio`,
                {
                  responseType: "blob" as const,
                },
              );
              const blob = resp.data as unknown as Blob;
              const url = URL.createObjectURL(blob);
              // revoke previous blob URL if any
              if (blobUrlRef.current) {
                try {
                  URL.revokeObjectURL(blobUrlRef.current);
                } catch (e) {
                  console.warn("failed to revoke previous blob url", e);
                }
              }
              blobUrlRef.current = url;
              setAudioSrc(url);
              const wf = await generateWaveformFromUrl(url);
              waveformData.current = wf;
            }
          } catch (e) {
            // If the first request failed (e.g. because response wasn't JSON), try blob
            console.debug("presign check failed", e);
            try {
              const resp = await api.get<Blob>(
                `/calls/${callData.id}/audio`,
                {
                  responseType: "blob" as const,
                },
              );
              const blob = resp.data as unknown as Blob;
              const url = URL.createObjectURL(blob);
              if (blobUrlRef.current) {
                try {
                  URL.revokeObjectURL(blobUrlRef.current);
                } catch (e) {
                  console.warn("failed to revoke previous blob url", e);
                }
              }
              blobUrlRef.current = url;
              setAudioSrc(url);
              const wf = await generateWaveformFromUrl(url);
              waveformData.current = wf;
            } catch (err2) {
              console.warn(
                "failed to fetch audio for waveform, falling back",
                err2,
              );
              waveformData.current = generateWaveform(callData.id);
              setAudioSrc(null);
            }
          }
        }
      } catch (err) {
        console.warn(
          "failed to fetch audio for waveform, falling back",
          err,
        );
        waveformData.current = generateWaveform(callData.id);
        setAudioSrc(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        try {
          URL.revokeObjectURL(blobUrlRef.current);
        } catch (e) {
          console.warn("failed to revoke blob url on unmount", e);
        }
        blobUrlRef.current = null;
      }
    };
  }, []);

  if (loading) return <div className="p-8">{t("calls.loading")}</div>;

  if (!call || call.status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark text-neutral-800 dark:text-neutral-100">
        <div className="max-w-xl w-full p-8 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 shadow-lg text-center">
          <div className="flex items-center justify-center mb-4">
            <div className={`h-20 w-20 rounded-full ${call?.status === 'error' ? 'bg-red-50 text-red-500' : 'bg-primary/10 text-primary'} flex items-center justify-center text-4xl`}>
              <span className="material-icons">{call?.status === 'error' ? 'error_outline' : 'call'}</span>
            </div>
          </div>
          <h2 className={`text-2xl font-bold mb-2 ${call?.status === 'error' ? 'text-red-600' : ''}`}>
            {call?.status === 'error'
              ? t("calls.error_processing")
              : t("dashboard.processing")
            }
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
            {call?.status === 'error'
              ? t("calls.error_description")
              : t("calls.processing_description")
            }
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => window.history.back()}
              className="w-full sm:w-auto px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              {t("common.back")}
            </button>
            <Link
              to="/calls"
              className="w-full sm:w-auto px-4 py-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-sm font-medium hover:bg-neutral-200 dark:hover:bg-neutral-700"
            >
              {t("calls.view_calls")}
            </Link>
            {call?.id && <ReprocessButton callId={call.id} />}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background-light dark:bg-background-dark text-neutral-800 dark:text-neutral-100 font-display min-h-screen flex flex-col overflow-hidden">
      <header className="bg-surface-light dark:bg-surface-dark border-b border-neutral-200 dark:border-neutral-700 min-h-16 flex items-center px-4 sm:px-6 shrink-0 z-20">
        <div className="flex items-center gap-2 sm:gap-4 w-full overflow-hidden">
          <button
            onClick={() => window.history.back()}
            className="text-neutral-500 hover:text-primary dark:text-neutral-400 dark:hover:text-primary transition-colors flex items-center gap-1 text-xs sm:text-sm font-medium shrink-0"
          >
            <span className="material-icons text-base sm:text-lg">arrow_back</span>{" "}
            <span className="hidden xs:inline">{t("calls.back")}</span>
          </button>
          <div className="h-6 w-px bg-neutral-200 dark:bg-neutral-700 mx-1 sm:mx-2 shrink-0"></div>
          <h1 className="text-sm sm:text-base md:text-lg font-bold text-neutral-900 dark:text-white truncate flex-1 min-w-0">
            {t("calls.call_with")} {call.manager_name}
          </h1>
          <span className={`hidden md:inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-medium border uppercase shrink-0 ${
            call.status === 'completed'
              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800'
              : call.status === 'error'
              ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800'
              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800'
          }`}>
            {call.status}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {audioSrc && (
              <button
                onClick={downloadAudio}
                className="p-2 text-neutral-500 hover:text-primary transition-colors flex items-center gap-1 text-sm font-medium"
                title={t('common.download')}
              >
                <span className="material-icons text-lg">download</span>
                <span className="hidden sm:inline">{t('common.download')}</span>
              </button>
            )}
            <ReprocessButton callId={id!} />
            <button
              onClick={() => setShowAnalysis(!showAnalysis)}
              className="lg:hidden p-2 text-primary hover:bg-primary/10 rounded-lg"
            >
              <span className="material-icons">analytics</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <aside className="w-72 bg-surface-light dark:bg-surface-dark border-r border-neutral-200 dark:border-neutral-700 hidden lg:flex lg:flex-col shrink-0 overflow-y-auto">
          <div className="p-6 space-y-6">
            <div className="flex flex-col items-center p-6 rounded-xl bg-neutral-50 dark:bg-neutral-800/30 border border-neutral-100 dark:border-neutral-700">
              <div className="h-20 w-20 rounded-full overflow-hidden bg-primary/10 mb-3 border-4 border-white dark:border-neutral-700 shadow-sm flex items-center justify-center">
                <span className="material-icons text-4xl text-primary">
                  person
                </span>
              </div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                {call.manager_name}
              </h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {t("calls.representative")}
              </p>
            </div>
            <div>
              <h4 className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-4">
                {t("calls.metadata")}
              </h4>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <span className="material-icons text-sm">event</span>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">
                      {t("calls.date")}
                    </p>
                    <p className="text-sm font-medium">
                      {new Date(call.call_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <span className="material-icons text-sm">timer</span>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-500">
                      {t("calls.duration")}
                    </p>
                    <p className="text-sm font-medium">
                      {Math.floor(call.duration / 60)}:
                      {(call.duration % 60).toString().padStart(2, "0")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <section className="flex-1 flex flex-col relative bg-background-light dark:bg-background-dark overflow-hidden">
          {audioSrc ? (
            <audio
              ref={audioRef}
              src={audioSrc}
              onTimeUpdate={() =>
                setCurrentTime(audioRef.current?.currentTime || 0)
              }
              onLoadedMetadata={() =>
                setDuration(audioRef.current?.duration || 0)
              }
              onEnded={() => setIsPlaying(false)}
            />
          ) : null}
          <div className="shrink-0 bg-surface-light dark:bg-surface-dark border-b border-neutral-200 dark:border-neutral-700 p-4 sm:p-6 z-10 shadow-sm">
            <div
              className="relative h-12 sm:h-16 w-full mb-4 group rounded overflow-hidden"
              onClick={(e) => {
                if (!audioSrc || !audioRef.current) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const pct = x / rect.width;
                audioRef.current.currentTime = pct * duration;
              }}
              role={audioSrc ? "button" : undefined}
              aria-disabled={audioSrc ? undefined : true}
              style={{ cursor: audioSrc ? "pointer" : "default" }}
            >
              {/* Simple progress bar instead of placeholder */}
              <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs z-0">
                {waveformData.current.map((height, i) => (
                  <div
                    key={i}
                    className="w-0.5 sm:w-1 mx-0.5 bg-primary/20 rounded-full"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
              <div
                className="absolute top-0 bottom-0 left-0 bg-primary/30 border-r-2 border-primary transition-all duration-100 ease-linear"
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
            </div>
            <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-2 sm:gap-4 order-2 sm:order-1 w-full sm:w-auto justify-center sm:justify-start">
                <button
                  className="text-neutral-500 hover:text-primary transition-colors"
                  onClick={() => seek(-10)}
                >
                  <span className="material-icons text-xl sm:text-2xl">replay_10</span>
                </button>
                <button
                  className={`h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center shadow-lg transition-all ${audioSrc ? "bg-primary text-white hover:scale-105 active:scale-95" : "bg-neutral-200 text-neutral-400 cursor-not-allowed"}`}
                  onClick={() => {
                    if (!audioSrc) return;
                    togglePlay();
                  }}
                  aria-disabled={!audioSrc}
                >
                  <span className="material-icons text-xl sm:text-2xl">
                    {isPlaying ? "pause" : "play_arrow"}
                  </span>
                </button>
                <button
                  className="text-neutral-500 hover:text-primary transition-colors"
                  onClick={() => seek(10)}
                >
                  <span className="material-icons text-xl sm:text-2xl">forward_10</span>
                </button>
                <div className="text-[10px] sm:text-sm font-mono font-medium text-neutral-600 dark:text-neutral-300 ml-1 sm:ml-2">
                  {audioSrc ? (
                    <>
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </>
                  ) : (
                    <span className="text-xs text-neutral-500">
                      {t("calls.no_audio")}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 order-1 sm:order-2 ml-auto">
                <select
                  value={playbackRate}
                  onChange={(e) => handlePlaybackRateChange(parseFloat(e.target.value))}
                  className="bg-neutral-100 dark:bg-neutral-800 border-none rounded-lg px-1.5 py-0.5 sm:px-2 sm:py-1 text-[10px] sm:text-xs font-medium focus:ring-1 focus:ring-primary outline-none"
                  disabled={!audioSrc}
                >
                  <option value={0.5}>0.5x</option>
                  <option value={0.75}>0.75x</option>
                  <option value={1}>1.0x</option>
                  <option value={1.25}>1.25x</option>
                  <option value={1.5}>1.5x</option>
                  <option value={2}>2.0x</option>
                </select>
              </div>
            </div>
          </div>

          <CallTranscriptWidget
            segments={transcript?.segments}
            currentTime={currentTime}
            isPlaying={isPlaying}
            onSegmentClick={handleSegmentClick}
          />
        </section>

        {showAnalysis && (
          <div
            className="fixed inset-0 bg-black/50 z-20 lg:hidden"
            onClick={() => setShowAnalysis(false)}
          />
        )}
        <aside
          className={`fixed inset-y-0 right-0 z-30 w-80 bg-surface-light dark:bg-surface-dark border-l border-neutral-200 dark:border-neutral-700 flex flex-col shrink-0 overflow-y-auto transition-transform duration-300 transform lg:translate-x-0 lg:static ${showAnalysis ? "translate-x-0" : "translate-x-full"}`}
        >
          <CallAnalysisWidget analysis={analysis} className="p-6" />
        </aside>
      </main>
    </div>
  );
};

export default CallDetailPage;
