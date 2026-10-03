import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { notificationAPI } from '../services/api';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../components/Avatar';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [toastNotification, setToastNotification] = useState(null);

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

    socket.on('newNotification', handleNewNotification);

    return () => {
      socket.off('newNotification', handleNewNotification);
    };
  }, [socket]);

  // Auto-dismiss toast alert after 5 seconds
  useEffect(() => {
    if (!toastNotification) return;
    const timer = setTimeout(() => {
      setToastNotification(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [toastNotification]);

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
    } else if (notif.type === 'like' || notif.type === 'comment') {
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
      }}
    >
      {children}

      {/* Floating In-App Toast Alert Popup */}
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
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
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
            <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#818cf8', marginBottom: '0.15rem' }}>
              New Notification
            </div>
            <div style={{ fontSize: '0.83rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {toastNotification.type === 'like' && `@${toastNotification.sender?.username || 'Someone'} liked your post`}
              {toastNotification.type === 'message' && `@${toastNotification.sender?.username || 'Someone'} sent you a message`}
              {toastNotification.type === 'follow' && `@${toastNotification.sender?.username || 'Someone'} started following you`}
              {toastNotification.type === 'comment' && `@${toastNotification.sender?.username || 'Someone'} commented on your post`}
              {!['like', 'message', 'follow', 'comment'].includes(toastNotification.type) && (toastNotification.message || 'New activity')}
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
