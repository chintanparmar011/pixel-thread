import { Link } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import { Avatar } from './Avatar';
import { timeAgo } from '../utils/timeAgo';
import { Heart, MessageSquare, UserPlus, MessageCircle, CheckCheck, BellOff } from 'lucide-react';

export const NotificationDropdown = ({ onClose }) => {
  const { notifications, unreadCount, markAllAsRead, handleNotificationClick } = useNotifications();

  // Top 8 notifications for dropdown preview
  const recentNotifications = notifications.slice(0, 8);

  const renderTypeIcon = (type) => {
    switch (type) {
      case 'like':
        return (
          <div className="notification-type-badge like">
            <Heart size={10} fill="currentColor" />
          </div>
        );
      case 'message':
        return (
          <div className="notification-type-badge message">
            <MessageSquare size={10} fill="currentColor" />
          </div>
        );
      case 'follow':
        return (
          <div className="notification-type-badge follow">
            <UserPlus size={10} />
          </div>
        );
      case 'comment':
        return (
          <div className="notification-type-badge comment">
            <MessageCircle size={10} fill="currentColor" />
          </div>
        );
      default:
        return null;
    }
  };

  const renderText = (notif) => {
    const username = notif.sender?.username || 'Someone';
    switch (notif.type) {
      case 'like':
        return (
          <>
            <strong>@{username}</strong> liked your post
          </>
        );
      case 'message':
        return (
          <>
            <strong>@{username}</strong> sent you a message
          </>
        );
      case 'follow':
        return (
          <>
            <strong>@{username}</strong> started following you
          </>
        );
      case 'comment':
        return (
          <>
            <strong>@{username}</strong> commented on your post
          </>
        );
      default:
        return <><strong>@{username}</strong> interacted with you</>;
    }
  };

  return (
    <div className="notification-dropdown">
      <div className="notification-dropdown-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Notifications</span>
          {unreadCount > 0 && (
            <span className="badge badge-info" style={{ padding: '0.15rem 0.45rem', fontSize: '0.7rem' }}>
              {unreadCount} new
            </span>
          )}
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
          >
            <CheckCheck size={14} /> Mark all read
          </button>
        )}
      </div>

      <div className="notification-dropdown-body">
        {recentNotifications.length === 0 ? (
          <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <BellOff size={28} style={{ opacity: 0.5, marginBottom: '0.5rem' }} />
            <p style={{ fontSize: '0.85rem' }}>No notifications yet</p>
          </div>
        ) : (
          recentNotifications.map((notif) => (
            <div
              key={notif._id}
              className={`notification-item ${!notif.isRead ? 'unread' : ''}`}
              onClick={() => {
                handleNotificationClick(notif);
                onClose();
              }}
            >
              <div className="notification-avatar-wrap">
                <Avatar src={notif.sender?.profilePicture} size={38} />
                {renderTypeIcon(notif.type)}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.4 }}>
                  {renderText(notif)}
                </p>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.2rem' }}>
                  {timeAgo(notif.createdAt)}
                </span>
              </div>

              {notif.post?.image && (
                <img
                  src={notif.post.image}
                  alt="Post preview"
                  style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }}
                />
              )}

              {!notif.isRead && <div className="notification-unread-dot" />}
            </div>
          ))
        )}
      </div>

      <div className="notification-dropdown-footer">
        <Link
          to="/notifications"
          onClick={onClose}
          style={{
            fontSize: '0.82rem',
            color: 'var(--accent-color)',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          View all notifications
        </Link>
      </div>
    </div>
  );
};
