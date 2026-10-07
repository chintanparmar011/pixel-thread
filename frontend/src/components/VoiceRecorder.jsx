import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Trash2, Send, Loader2 } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';

export const VoiceRecorder = ({ onSendVoice, disabled = false }) => {
  const { showToast } = useNotifications();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    if (disabled || isRecording) return;

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('Audio recording is not supported in this browser', 'error');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
        else if (MediaRecorder.isTypeSupported('audio/ogg')) mimeType = 'audio/ogg';
        else mimeType = '';
      }

      const options = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(stream, options);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        // Stop all audio tracks to release microphone
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start(100); // 100ms slice
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);
      startTimeRef.current = Date.now();

      timerIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setRecordingTime(elapsed);
      }, 500);
    } catch (err) {
      showToast('Microphone access denied or unavailable', 'error');
    }
  };

  const cancelRecording = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingTime(0);
  };

  const finishAndSend = async () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    const duration = recordingTime;
    if (duration < 1) {
      showToast('Voice note too short', 'info');
      cancelRecording();
      return;
    }

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setIsUploading(true);

    mediaRecorderRef.current.onstop = async () => {
      try {
        const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

        if (audioBlob.size === 0) {
          showToast('Failed to record audio', 'error');
          return;
        }

        await onSendVoice(audioBlob, duration);
      } catch (err) {
        showToast('Failed to send voice note', 'error');
      } finally {
        setIsUploading(false);
        setIsRecording(false);
        setRecordingTime(0);
        audioChunksRef.current = [];
      }
    };

    mediaRecorderRef.current.stop();
  };

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (isRecording) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '9999px',
          padding: '0.35rem 0.85rem',
          animation: 'fadeIn 0.2s ease',
        }}
      >
        {/* Pulsing Red Dot */}
        <div
          style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: '#ef4444',
            boxShadow: '0 0 8px #ef4444',
            animation: 'pulse 1.2s infinite',
          }}
        />

        {/* Timer */}
        <span
          style={{
            fontSize: '0.85rem',
            color: '#f87171',
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatTimer(recordingTime)}
        </span>

        {/* Discard / Cancel Button */}
        <button
          type="button"
          onClick={cancelRecording}
          disabled={isUploading}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Cancel recording"
        >
          <Trash2 size={16} />
        </button>

        {/* Send Recording Button */}
        <button
          type="button"
          onClick={finishAndSend}
          disabled={isUploading}
          style={{
            backgroundColor: 'var(--btn-primary-bg)',
            border: 'none',
            borderRadius: '50%',
            width: '28px',
            height: '28px',
            color: 'var(--btn-primary-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          title="Send voice note"
        >
          {isUploading ? <Loader2 size={14} className="spin" /> : <Send size={13} />}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={startRecording}
      disabled={disabled}
      style={{
        background: 'transparent',
        border: 'none',
        color: 'var(--text-secondary)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        padding: '8px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'color 0.2s, background-color 0.2s',
      }}
      className="mic-action-btn"
      title="Record voice note"
    >
      <Mic size={18} />
    </button>
  );
};
