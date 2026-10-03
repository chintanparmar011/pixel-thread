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

  const [callAccepted, setCallAccepted] = useState(!isIncoming);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);
  const [statusText, setStatusText] = useState(isIncoming ? 'Incoming Call...' : 'Calling...');

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);

  // Initialize WebRTC
  useEffect(() => {
    let isMounted = true;

    const setupConnection = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: callType === 'video',
          audio: true,
        });

        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        const pc = new RTCPeerConnection(ICE_SERVERS);
        peerConnectionRef.current = pc;

        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        pc.ontrack = (event) => {
          if (remoteVideoRef.current && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate && partnerUser?._id) {
            socket.emit('iceCandidate', {
              to: partnerUser._id,
              candidate: event.candidate,
            });
          }
        };

        // Outgoing call initiation
        if (!isIncoming) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          socket.emit('callUser', {
            userToCall: partnerUser._id,
            signalData: offer,
            from: currentUser.id,
            callerName: currentUser.name || currentUser.username,
            callerAvatar: currentUser.profilePicture,
            callType,
          });
        }
      } catch (err) {
        console.error('Failed to access media devices:', err);
        setStatusText('Permission denied or camera/mic not found');
      }
    };

    setupConnection();

    // Socket signaling listeners
    const handleCallAccepted = async ({ signal }) => {
      try {
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(signal)
          );
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
      try {
        if (peerConnectionRef.current && candidate) {
          await peerConnectionRef.current.addIceCandidate(
            new RTCIceCandidate(candidate)
          );
        }
      } catch (err) {
        console.error('Error adding ICE candidate:', err);
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
  };

  const cleanupAndClose = () => {
    cleanupStreams();
    onEndCall();
  };

  const handleAcceptCall = async () => {
    try {
      if (peerConnectionRef.current && incomingSignal) {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(incomingSignal)
        );
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);

        socket.emit('answerCall', {
          to: partnerUser._id,
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
    if (partnerUser?._id) {
      socket.emit('rejectCall', { to: partnerUser._id });
    }
    cleanupAndClose();
  };

  const handleHangup = () => {
    if (partnerUser?._id) {
      socket.emit('endCall', { to: partnerUser._id });
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

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '720px',
          height: '520px',
          backgroundColor: '#0f172a',
          borderRadius: '16px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          border: '1px solid var(--border-color)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
        }}
      >
        {/* Top Header */}
        <div
          style={{
            padding: '1rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundColor: 'rgba(30, 41, 59, 0.7)',
            backdropFilter: 'blur(8px)',
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <Avatar src={partnerUser?.profilePicture} size={42} />
            <div>
              <h4 style={{ margin: 0, fontSize: '1rem', color: 'white' }}>
                {partnerUser?.name || partnerUser?.username}
              </h4>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                {statusText}
              </span>
            </div>
          </div>
          <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>
            {callType} Call
          </span>
        </div>

        {/* Video / Audio Canvas */}
        <div
          style={{
            flex: 1,
            position: 'relative',
            backgroundColor: '#020617',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {/* Remote Video */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: callAccepted && callType === 'video' ? 'block' : 'none',
            }}
          />

          {/* Audio-only or Pre-connect placeholder */}
          {(!callAccepted || callType === 'audio') && (
            <div style={{ textAlign: 'center', color: '#94a3b8' }}>
              <div
                style={{
                  position: 'relative',
                  display: 'inline-block',
                  marginBottom: '1rem',
                }}
              >
                <Avatar src={partnerUser?.profilePicture} size={96} />
              </div>
              <h3 style={{ color: 'white', marginBottom: '0.3rem' }}>
                {partnerUser?.name || partnerUser?.username}
              </h3>
              <p style={{ fontSize: '0.9rem' }}>{statusText}</p>
            </div>
          )}

          {/* Local Video PiP Preview */}
          {callType === 'video' && (
            <div
              style={{
                position: 'absolute',
                bottom: '1rem',
                right: '1rem',
                width: '160px',
                height: '110px',
                borderRadius: '10px',
                overflow: 'hidden',
                border: '2px solid rgba(255, 255, 255, 0.2)',
                backgroundColor: '#1e293b',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
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
                  transform: 'scaleX(-1)', // mirror selfie video
                }}
              />
            </div>
          )}
        </div>

        {/* Bottom Control Bar */}
        <div
          style={{
            padding: '1.2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1.5rem',
            backgroundColor: 'rgba(30, 41, 59, 0.85)',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
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
                  padding: '0.8rem 1.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  fontSize: '0.95rem',
                }}
              >
                <Phone size={18} /> Accept
              </button>

              <button
                onClick={handleDeclineCall}
                className="btn btn-sm"
                style={{
                  backgroundColor: '#ef4444',
                  color: 'white',
                  borderRadius: '9999px',
                  padding: '0.8rem 1.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  fontSize: '0.95rem',
                }}
              >
                <PhoneOff size={18} /> Decline
              </button>
            </>
          ) : (
            /* Active Call Controls */
            <>
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
                  backgroundColor: isMuted ? '#ef4444' : 'var(--bg-hover)',
                  color: 'white',
                }}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>

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
                    backgroundColor: isVideoDisabled ? '#ef4444' : 'var(--bg-hover)',
                    color: 'white',
                  }}
                  title={isVideoDisabled ? 'Turn Video On' : 'Turn Video Off'}
                >
                  {isVideoDisabled ? <VideoOff size={20} /> : <Video size={20} />}
                </button>
              )}

              <button
                onClick={handleHangup}
                className="btn"
                style={{
                  backgroundColor: '#ef4444',
                  color: 'white',
                  borderRadius: '50%',
                  width: '48px',
                  height: '48px',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Hang Up"
              >
                <PhoneOff size={20} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
