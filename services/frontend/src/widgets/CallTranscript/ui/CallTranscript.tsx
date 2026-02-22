import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TranscriptSegment } from '../../../entities/call/types';

interface CallTranscriptProps {
  segments?: TranscriptSegment[];
  currentTime: number;
  isPlaying: boolean;
  onSegmentClick: (start: number) => void;
}

export const CallTranscript: React.FC<CallTranscriptProps> = ({
  segments,
  currentTime,
  isPlaying,
  onSegmentClick,
}) => {
  const { t } = useTranslation();
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(-1);
  const activeSegmentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (segments) {
      const index = segments.findIndex(
        (seg) => currentTime >= seg.start && currentTime <= seg.end
      );
      if (index !== activeSegmentIndex && index !== -1) {
        setActiveSegmentIndex(index);
      }
    }
  }, [currentTime, segments, activeSegmentIndex]);

  useEffect(() => {
    if (activeSegmentRef.current && isPlaying) {
      activeSegmentRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeSegmentIndex, isPlaying]);

  if (!segments) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-slate-500">{t('calls.transcript_processing')}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4 scroll-smooth">
      {segments.map((seg, i) => {
        const isActive = i === activeSegmentIndex;
        return (
          <div
            key={i}
            ref={isActive ? activeSegmentRef : null}
            className={`group flex gap-4 cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800/30 p-3 rounded-xl transition-all duration-300 ${
              isActive ? 'opacity-100 bg-primary/5 ring-1 ring-primary/20 shadow-sm' : 'opacity-60'
            }`}
            onClick={() => onSegmentClick(seg.start)}
          >
            <div className="w-16 shrink-0 text-right">
              <span className={`text-xs font-mono mt-1 block ${isActive ? 'text-primary font-bold' : 'text-neutral-400'}`}>
                {Math.floor(seg.start / 60)}:{(seg.start % 60).toFixed(0).padStart(2, '0')}
              </span>
            </div>
            <div className="flex-1">
              <div className="flex items-baseline gap-2 mb-1">
                <span className={`font-semibold text-sm ${seg.speaker === 'SPEAKER_0' || seg.speaker === 'SPEAKER_00' ? 'text-primary' : 'text-neutral-700'}`}>
                  {seg.speaker === 'SPEAKER_0' || seg.speaker === 'SPEAKER_00' ? t('calls.agent') : t('calls.client')}
                </span>
              </div>
              <p className={`text-neutral-800 dark:text-neutral-200 leading-relaxed ${isActive ? 'font-medium' : ''}`}>
                {seg.text}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
