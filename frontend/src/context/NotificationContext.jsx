import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { notificationAPI } from '../services/api';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { AlertCircle, CheckCircle2, Sparkles, X } from 'lucide-react';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [toastNotification, setToastNotification] = useState(null);
  const [appToast, setAppToast] = useState(null);

  const showToast = useCallback((text, type = 'info') => {
    if (!text) return;
    setAppToast({ text, type, id: Date.now() });
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await notificationAPI.getNotifications(1, 30);
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      console.error('Failed to load notifications:', err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
      setToastNotification(null);
      setAppToast(null);
    }
  }, [user, fetchNotifications]);

  // Real-time socket listener
  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (notif) => {
      setNotifications((prev) => [notif, ...prev]);
      setUnreadCount((prev) => prev + 1);

      // Trigger toast popup banner
      setToastNotification(notif);
    };

    const handleAccountSuspended = (data) => {
      showToast(data?.message || 'Your account has been suspended by an administrator.', 'error');
    };

    socket.on('newNotification', handleNewNotification);
    socket.on('accountSuspended', handleAccountSuspended);

    return () => {
      socket.off('newNotification', handleNewNotification);
      socket.off('accountSuspended', handleAccountSuspended);
    };
  }, [socket, showToast]);

  // Auto-dismiss socket notification toast after 5s
  useEffect(() => {
    if (!toastNotification) return;
    const timer = setTimeout(() => {
      setToastNotification(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [toastNotification]);

  // Auto-dismiss general app toast after 4s
  useEffect(() => {
    if (!appToast) return;
    const timer = setTimeout(() => {
      setAppToast(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [appToast]);

  const markAsRead = async (id) => {
    try {
      const data = await notificationAPI.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount(data.unreadCount ?? Math.max(0, unreadCount - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err.message);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationAPI.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err.message);
    }
  };

  const deleteNotification = async (id) => {
    try {
      const data = await notificationAPI.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      setUnreadCount(data.unreadCount ?? 0);
    } catch (err) {
      console.error('Failed to delete notification:', err.message);
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.isRead) {
      await markAsRead(notif._id);
    }
    setToastNotification(null);

    if (notif.type === 'message') {
      const partnerId = notif.sender?._id || notif.sender;
      navigate(`/messages?userId=${partnerId}`);
    } else if (notif.type === 'follow') {
      const username = notif.sender?.username;
      if (username) navigate(`/profile/${username}`);
    } else if (notif.type === 'like' || notif.type === 'comment' || notif.type === 'reply' || notif.type === 'repost') {
      const targetPostId = notif.post?._id || notif.post;
      if (targetPostId) {
        navigate(`/post/${targetPostId}`);
      } else {
        navigate('/');
      }
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        handleNotificationClick,
        showToast,
      }}
    >
      {children}

      {/* Floating In-App Socket Notification Banner */}
      {toastNotification && (
        <div
          onClick={() => handleNotificationClick(toastNotification)}
          style={{
            position: 'fixed',
            top: '70px',
            right: '20px',
            zIndex: 9999,
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--accent-color)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.55)',
            borderRadius: '12px',
            padding: '0.8rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.8rem',
            cursor: 'pointer',
            maxWidth: '360px',
            animation: 'slideInRight 0.3s ease-out',
          }}
        >
          <Avatar src={toastNotification.sender?.profilePicture} size={36} />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#d2a8ff', marginBottom: '0.15rem' }}>
              Notification
            </div>
            <div style={{ fontSize: '0.83rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {toastNotification.type === 'like' && `@${toastNotification.sender?.username || 'Someone'} liked your post`}
              {toastNotification.type === 'message' && `@${toastNotification.sender?.username || 'Someone'} sent you a message`}
              {toastNotification.type === 'follow' && `@${toastNotification.sender?.username || 'Someone'} started following you`}
              {toastNotification.type === 'comment' && `@${toastNotification.sender?.username || 'Someone'} commented on your post`}
              {toastNotification.type === 'reply' && `@${toastNotification.sender?.username || 'Someone'} replied to your comment`}
              {toastNotification.type === 'repost' && `@${toastNotification.sender?.username || 'Someone'} reposted your post`}
              {!['like', 'message', 'follow', 'comment', 'reply', 'repost'].includes(toastNotification.type) && (toastNotification.message || 'New activity')}
            </div>
          </div>

          {toastNotification.post?.image && (
            <img
              src={toastNotification.post.image}
              alt="Post preview"
              style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }}
            />
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              setToastNotification(null);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '1.2rem',
              lineHeight: 1,
              padding: '0.2rem',
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* General Themed In-App Toast (Replaces Browser alert) */}
      {appToast && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 10000,
            backgroundColor: 'var(--bg-secondary)',
            border: `1px solid ${
              appToast.type === 'error'
                ? 'var(--danger)'
                : appToast.type === 'success'
                ? 'var(--success)'
                : 'var(--accent-color)'
            }`,
            boxShadow: '0 8px 28px rgba(0, 0, 0, 0.6)',
            borderRadius: '10px',
            padding: '0.75rem 1.1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            maxWidth: '380px',
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          {appToast.type === 'error' && <AlertCircle size={20} color="var(--danger)" style={{ flexShrink: 0 }} />}
          {appToast.type === 'success' && <CheckCircle2 size={20} color="var(--success)" style={{ flexShrink: 0 }} />}
          {appToast.type !== 'error' && appToast.type !== 'success' && <Sparkles size={20} color="#d2a8ff" style={{ flexShrink: 0 }} />}

          <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)', flex: 1, wordBreak: 'break-word' }}>
            {appToast.text}
          </span>

          <button
            onClick={() => setAppToast(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '0.2rem',
            }}
            title="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
