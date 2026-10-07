import { useState, useEffect, useRef } from 'react';
import { Avatar } from './Avatar';
import { 
  Phone, 
  PhoneOff, 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Loader2 
} from 'lucide-react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.services.mozilla.com' },
  ],
};

export const CallModal = ({
  callState,
  onEndCall,
  socket,
  currentUser,
}) => {
  const {
    isIncoming,
    incomingSignal,
    partnerUser,
    callType = 'video',
  } = callState;

  const targetUserId = (partnerUser?._id || partnerUser?.id)?.toString();
  const currentUserId = (currentUser?._id || currentUser?.id)?.toString();

  const [callAccepted, setCallAccepted] = useState(!isIncoming);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);
  const [statusText, setStatusText] = useState(isIncoming ? 'Incoming Call...' : 'Calling...');
  const [callDuration, setCallDuration] = useState(0);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const durationTimerRef = useRef(null);

  // Synthesize realistic telephone ring tone for incoming calls
  useEffect(() => {
    if (!isIncoming || callAccepted) return;
    let audioCtx = null;
    let ringInterval = null;

    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();

        const playRing = () => {
          if (!audioCtx || audioCtx.state === 'closed') return;
          if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
          }

          const osc1 = audioCtx.createOscillator();
          const osc2 = audioCtx.createOscillator();
          const gain = audioCtx.createGain();

          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(440, audioCtx.currentTime); // 440 Hz
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(480, audioCtx.currentTime); // 480 Hz

          gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.4);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(audioCtx.destination);

          osc1.start();
          osc2.start();
          osc1.stop(audioCtx.currentTime + 1.4);
          osc2.stop(audioCtx.currentTime + 1.4);
        };

        playRing();
        ringInterval = setInterval(playRing, 2800);
      }
    } catch (e) {
      console.warn('Ringtone AudioContext unavailable:', e);
    }

    return () => {
      if (ringInterval) clearInterval(ringInterval);
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {});
      }
    };
  }, [isIncoming, callAccepted]);

  // Call duration counter once connected
  useEffect(() => {
    if (callAccepted && statusText === 'Connected') {
      durationTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    };
  }, [callAccepted, statusText]);

  // Outgoing call timeout (45 seconds)
  useEffect(() => {
    if (!isIncoming && !callAccepted) {
      const timer = setTimeout(() => {
        setStatusText('No Answer');
        setTimeout(() => cleanupAndClose(), 2000);
      }, 45000);
      return () => clearTimeout(timer);
    }
  }, [isIncoming, callAccepted]);

  const flushPendingCandidates = async (pc) => {
    if (!pc || !pc.remoteDescription) return;
    while (pendingCandidatesRef.current.length > 0) {
      const cand = pendingCandidatesRef.current.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch (err) {
        console.warn('Failed to add buffered ICE candidate:', err);
      }
    }
  };

  // Initialize WebRTC
  useEffect(() => {
    let isMounted = true;

    const setupConnection = async () => {
      if (!targetUserId) {
        setStatusText('Recipient user ID missing');
        return;
      }

      try {
        // Step 1: Access media devices with fallback
        let stream = null;
        if (navigator.mediaDevices?.getUserMedia) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: callType === 'video',
              audio: true,
            });
          } catch (initialErr) {
            console.warn('Initial getUserMedia error:', initialErr.name, initialErr.message);
            if (callType === 'video') {
              // Attempt audio-only fallback if video is unavailable
              try {
                stream = await navigator.mediaDevices.getUserMedia({
                  video: false,
                  audio: true,
                });
                setStatusText('Camera unavailable, switched to voice');
              } catch (audioErr) {
                console.error('Audio fallback also failed:', audioErr);
              }
            }
          }
        }

        if (!isMounted) {
          if (stream) stream.getTracks().forEach((t) => t.stop());
          return;
        }

        if (!stream) {
          setStatusText('Camera/Mic permission needed. Please allow in browser.');
          return;
        }

        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Step 2: Create Peer Connection
        const pc = new RTCPeerConnection(ICE_SERVERS);
        peerConnectionRef.current = pc;

        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        pc.ontrack = (event) => {
          console.log('Remote stream received via ontrack');
          if (remoteVideoRef.current && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
            remoteVideoRef.current.play().catch((e) => console.warn('Remote video play warning:', e));
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate && targetUserId) {
            socket.emit('iceCandidate', {
              to: targetUserId,
              candidate: event.candidate,
            });
          }
        };

        pc.onconnectionstatechange = () => {
          console.log('RTCPeerConnection state:', pc.connectionState);
          if (pc.connectionState === 'connected') {
            setStatusText('Connected');
            setCallAccepted(true);
          } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
            setStatusText('Call Ended');
            setTimeout(() => cleanupAndClose(), 1500);
          }
        };

        // Step 3: Outgoing call initiation
        if (!isIncoming) {
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: callType === 'video',
          });
          await pc.setLocalDescription(offer);

          socket.emit('callUser', {
            userToCall: targetUserId,
            signalData: offer,
            from: currentUserId,
            callerName: currentUser?.name || currentUser?.username || 'User',
            callerAvatar: currentUser?.profilePicture || '',
            callType,
          });
          setStatusText('Ringing...');
        }
      } catch (err) {
        console.error('Error during WebRTC setup:', err);
        setStatusText('Could not connect call. Check camera/mic settings.');
      }
    };

    setupConnection();

    // Socket signaling listeners
    const handleCallAccepted = async ({ signal }) => {
      try {
        const pc = peerConnectionRef.current;
        if (pc && signal) {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          await flushPendingCandidates(pc);
          setCallAccepted(true);
          setStatusText('Connected');
        }
      } catch (err) {
        console.error('Error handling call acceptance:', err);
      }
    };

    const handleCallRejected = () => {
      setStatusText('Call Declined');
      setTimeout(() => cleanupAndClose(), 1500);
    };

    const handleCallEnded = () => {
      setStatusText('Call Ended');
      setTimeout(() => cleanupAndClose(), 1000);
    };

    const handleIceCandidate = async ({ candidate }) => {
      if (!candidate) return;
      const pc = peerConnectionRef.current;
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn('Error adding ICE candidate directly:', err);
        }
      } else {
        // Buffer candidate until remote description is set
        pendingCandidatesRef.current.push(candidate);
      }
    };

    socket.on('callAccepted', handleCallAccepted);
    socket.on('callRejected', handleCallRejected);
    socket.on('callEnded', handleCallEnded);
    socket.on('iceCandidate', handleIceCandidate);

    return () => {
      isMounted = false;
      socket.off('callAccepted', handleCallAccepted);
      socket.off('callRejected', handleCallRejected);
      socket.off('callEnded', handleCallEnded);
      socket.off('iceCandidate', handleIceCandidate);
      cleanupStreams();
    };
  }, []);

  const cleanupStreams = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  };

  const cleanupAndClose = () => {
    cleanupStreams();
    onEndCall();
  };

  const handleAcceptCall = async () => {
    try {
      const pc = peerConnectionRef.current;
      if (!pc) {
        console.error('Peer connection not ready yet');
        return;
      }

      if (incomingSignal) {
        await pc.setRemoteDescription(new RTCSessionDescription(incomingSignal));
        await flushPendingCandidates(pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('answerCall', {
          to: targetUserId,
          signal: answer,
        });

        setCallAccepted(true);
        setStatusText('Connected');
      }
    } catch (err) {
      console.error('Failed to answer call:', err);
      cleanupAndClose();
    }
  };

  const handleDeclineCall = () => {
    if (targetUserId) {
      socket.emit('rejectCall', { to: targetUserId });
    }
    cleanupAndClose();
  };

  const handleHangup = () => {
    if (targetUserId) {
      socket.emit('endCall', { to: targetUserId });
    }
    cleanupAndClose();
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted((prev) => !prev);
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoDisabled((prev) => !prev);
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        backgroundColor: 'rgba(28, 26, 24, 0.92)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '740px',
          height: '540px',
          backgroundColor: 'var(--bg-modal, #1C1A18)',
          borderRadius: '20px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          border: '1px solid var(--border-color, rgba(229, 221, 211, 0.2))',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.6), 0 0 36px rgba(136, 111, 71, 0.2)',
        }}
      >
        {/* Top Header */}
        <div
          style={{
            padding: '1rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-color, rgba(229, 221, 211, 0.15))',
            backgroundColor: 'var(--bg-card, #26231F)',
            backdropFilter: 'blur(8px)',
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <Avatar src={partnerUser?.profilePicture} size={42} />
            <div>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary, #FAF7F2)' }}>
                {partnerUser?.name || partnerUser?.username}
              </h4>
              <div style={{ fontSize: '0.76rem', color: statusText === 'Connected' ? '#3fb950' : '#8b949e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {statusText === 'Connected' && (
                  <span style={{
                    width: '6px',
                    height: '6px',
                    backgroundColor: '#3fb950',
                    borderRadius: '50%',
                    display: 'inline-block'
                  }} />
                )}
                <span>{statusText === 'Connected' ? formatDuration(callDuration) : statusText}</span>
              </div>
            </div>
          </div>

          <span 
            style={{ 
              textTransform: 'capitalize',
              backgroundColor: 'rgba(136, 111, 71, 0.15)',
              color: 'var(--accent-primary, #886F47)',
              border: '1px solid rgba(136, 111, 71, 0.35)',
              padding: '0.25rem 0.85rem',
              borderRadius: '9999px',
              fontSize: '0.78rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            {callType === 'video' ? <Video size={13} /> : <Phone size={13} />}
            {callType} Call
          </span>
        </div>

        {/* Video / Audio Canvas */}
        <div
          style={{
            flex: 1,
            position: 'relative',
            backgroundColor: '#141210',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {/* Remote Audio Track Player (Always present so audio always streams out) */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{
              position: callAccepted && callType === 'video' ? 'static' : 'absolute',
              width: callAccepted && callType === 'video' ? '100%' : '1px',
              height: callAccepted && callType === 'video' ? '100%' : '1px',
              objectFit: 'cover',
              opacity: callAccepted && callType === 'video' ? 1 : 0.01,
              pointerEvents: callAccepted && callType === 'video' ? 'auto' : 'none',
            }}
          />

          {/* Audio-only or Connecting State Visual Illustration */}
          {(!callAccepted || callType === 'audio') && (
            <div style={{ textAlign: 'center', color: '#94a3b8', zIndex: 2 }}>
              <div
                style={{
                  position: 'relative',
                  display: 'inline-block',
                  marginBottom: '1.25rem',
                }}
              >
                <div style={{
                  position: 'absolute',
                  inset: '-12px',
                  borderRadius: '50%',
                  background: isIncoming && !callAccepted
                    ? 'radial-gradient(circle, rgba(16, 185, 129, 0.3) 0%, transparent 70%)'
                    : 'radial-gradient(circle, rgba(136, 111, 71, 0.35) 0%, transparent 70%)',
                  animation: 'pulseDot 2s infinite ease-in-out',
                }} />
                <Avatar src={partnerUser?.profilePicture} size={104} style={{ position: 'relative', zIndex: 1 }} />
              </div>
              <h3 style={{ color: 'var(--text-primary, #FAF7F2)', margin: '0 0 0.35rem 0', fontSize: '1.2rem', fontWeight: 700 }}>
                {partnerUser?.name || partnerUser?.username}
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
                {statusText === 'Connected' ? formatDuration(callDuration) : statusText}
              </p>
            </div>
          )}

          {/* Local Video PiP Preview */}
          {callType === 'video' && !isVideoDisabled && (
            <div
              style={{
                position: 'absolute',
                bottom: '1rem',
                right: '1rem',
                width: '160px',
                height: '110px',
                borderRadius: '12px',
                overflow: 'hidden',
                border: '1px solid rgba(229, 221, 211, 0.2)',
                backgroundColor: '#26231F',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.7)',
                zIndex: 5,
              }}
            >
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: 'scaleX(-1)', // mirror preview
                }}
              />
            </div>
          )}
        </div>

        {/* Bottom Control Bar */}
        <div
          style={{
            padding: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1.5rem',
            backgroundColor: 'var(--bg-card, #26231F)',
            borderTop: '1px solid var(--border-color, rgba(229, 221, 211, 0.15))',
            zIndex: 10,
          }}
        >
          {isIncoming && !callAccepted ? (
            /* Incoming Call Response Buttons */
            <>
              <button
                onClick={handleAcceptCall}
                className="btn btn-sm"
                style={{
                  backgroundColor: '#10b981',
                  color: 'white',
                  borderRadius: '9999px',
                  padding: '0.8rem 2rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  boxShadow: '0 4px 16px rgba(16, 185, 129, 0.4)',
                }}
              >
                <Phone size={19} /> Accept
              </button>

              <button
                onClick={handleDeclineCall}
                className="btn btn-sm"
                style={{
                  backgroundColor: '#ef4444',
                  color: 'white',
                  borderRadius: '9999px',
                  padding: '0.8rem 2rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  boxShadow: '0 4px 16px rgba(239, 68, 68, 0.4)',
                }}
              >
                <PhoneOff size={19} /> Decline
              </button>
            </>
          ) : (
            /* Active Call Controls */
            <>
              {/* Mute Button */}
              <button
                onClick={toggleMute}
                className="btn btn-secondary"
                style={{
                  borderRadius: '50%',
                  width: '46px',
                  height: '46px',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isMuted ? '#ef4444' : 'rgba(255, 255, 255, 0.08)',
                  color: 'white',
                  border: isMuted ? 'none' : '1px solid rgba(240, 246, 252, 0.15)',
                  transition: 'all 0.2s',
                }}
                title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>

              {/* Video Camera Toggle Button */}
              {callType === 'video' && (
                <button
                  onClick={toggleVideo}
                  className="btn btn-secondary"
                  style={{
                    borderRadius: '50%',
                    width: '46px',
                    height: '46px',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isVideoDisabled ? '#ef4444' : 'rgba(255, 255, 255, 0.08)',
                    color: 'white',
                    border: isVideoDisabled ? 'none' : '1px solid rgba(240, 246, 252, 0.15)',
                    transition: 'all 0.2s',
                  }}
                  title={isVideoDisabled ? 'Turn video on' : 'Turn video off'}
                >
                  {isVideoDisabled ? <VideoOff size={20} /> : <Video size={20} />}
                </button>
              )}

              {/* Hangup / End Call Button */}
              <button
                onClick={handleHangup}
                className="btn"
                style={{
                  backgroundColor: '#ef4444',
                  color: 'white',
                  borderRadius: '50%',
                  width: '50px',
                  height: '50px',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 20px rgba(239, 68, 68, 0.5)',
                  transition: 'all 0.2s',
                }}
                title="End call"
              >
                <PhoneOff size={22} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
