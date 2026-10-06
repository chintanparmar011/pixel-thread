import { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';

const BAR_HEIGHTS = [
  40, 65, 80, 50, 90, 70, 30, 85, 100, 60, 45, 95, 75, 55, 80, 60, 40, 70, 90, 50, 35, 60, 80, 45
];

export const AudioMessagePlayer = ({ src, duration = 0, isOutgoing = false }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration);

  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setTotalDuration(Math.round(audio.duration));
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [src]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {
        setIsPlaying(false);
      });
    }
  };

  const handleSeek = (index) => {
    if (!audioRef.current || !totalDuration) return;
    const seekTime = (index / BAR_HEIGHTS.length) * totalDuration;
    audioRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const formatTime = (timeInSec) => {
    const s = Math.floor(timeInSec || 0);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const playedPct = totalDuration > 0 ? (currentTime / totalDuration) : 0;
  const activeBarIdx = Math.floor(playedPct * BAR_HEIGHTS.length);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.35rem 0.1rem',
        minWidth: '220px',
        maxWidth: '300px',
      }}
    >
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play/Pause Circle Button */}
      <button
        type="button"
        onClick={togglePlay}
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          backgroundColor: isOutgoing ? '#ffffff' : '#8957e5',
          color: isOutgoing ? '#8957e5' : '#ffffff',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          transition: 'transform 0.15s ease',
        }}
        title={isPlaying ? 'Pause' : 'Play voice note'}
      >
        {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" style={{ marginLeft: '2px' }} />}
      </button>

      {/* Waveform Bars + Duration */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            height: '24px',
            cursor: 'pointer',
          }}
        >
          {BAR_HEIGHTS.map((heightPct, idx) => {
            const isFilled = idx <= activeBarIdx;
            const barBg = isOutgoing
              ? isFilled ? '#ffffff' : 'rgba(255, 255, 255, 0.4)'
              : isFilled ? '#a371f7' : 'rgba(255, 255, 255, 0.2)';

            return (
              <div
                key={idx}
                onClick={() => handleSeek(idx)}
                style={{
                  flex: 1,
                  height: `${heightPct}%`,
                  backgroundColor: barBg,
                  borderRadius: '2px',
                  transition: 'background-color 0.1s ease',
                }}
              />
            );
          })}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.7rem',
            color: isOutgoing ? 'rgba(255, 255, 255, 0.85)' : 'var(--text-secondary)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(totalDuration)}</span>
        </div>
      </div>
    </div>
  );
};
