import { createContext, useContext, useState, useEffect } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { CallModal } from '../components/CallModal';

const CallContext = createContext(null);

export const CallProvider = ({ children }) => {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [callState, setCallState] = useState(null);

  // Global socket listener for incoming calls across the entire app
  useEffect(() => {
    if (!socket) return;

    const handleIncomingCall = ({ signal, from, callerName, callerAvatar, callType }) => {
      console.log('Incoming call received via socket:', { from, callerName, callType });
      setCallState({
        isOpen: true,
        isIncoming: true,
        incomingSignal: signal,
        partnerUser: {
          id: from,
          _id: from,
          name: callerName || 'User',
          username: callerName || 'user',
          profilePicture: callerAvatar || '',
        },
        callType: callType || 'video',
      });
    };

    socket.on('incomingCall', handleIncomingCall);

    return () => {
      socket.off('incomingCall', handleIncomingCall);
    };
  }, [socket]);

  // Initiate an outgoing call (voice or video)
  const startCall = (targetUser, callType = 'video') => {
    if (!targetUser) return;
    const partnerId = targetUser._id || targetUser.id;
    if (!partnerId) {
      console.error('Cannot start call: target user has no ID', targetUser);
      return;
    }

    setCallState({
      isOpen: true,
      isIncoming: false,
      incomingSignal: null,
      partnerUser: {
        id: partnerId,
        _id: partnerId,
        name: targetUser.name || targetUser.username || 'User',
        username: targetUser.username || 'user',
        profilePicture: targetUser.profilePicture || '',
      },
      callType,
    });
  };

  const endCall = () => {
    setCallState(null);
  };

  return (
    <CallContext.Provider value={{ callState, startCall, endCall }}>
      {children}

      {/* Global Call Modal: rendered anywhere in the application */}
      {callState?.isOpen && (
        <CallModal
          callState={callState}
          onEndCall={endCall}
          socket={socket}
          currentUser={user}
        />
      )}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};
