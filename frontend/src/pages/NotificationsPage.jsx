import { useState, useEffect } from 'react';
import { useNotifications } from '../context/NotificationContext';
import { userAPI, socialAPI } from '../services/api';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { timeAgo } from '../utils/timeAgo';
import { 
  Heart, 
  MessageSquare, 
  UserPlus, 
  UserCheck,
  MessageCircle, 
  CheckCheck, 
  Trash2, 
  BellOff, 
  Loader2,
  Repeat,
  CornerDownRight,
  Sparkles,
  Users
} from 'lucide-react';

export const NotificationsPage = () => {
  const {
    notifications,
    unreadCount,
    loading,
    markAllAsRead,
    deleteNotification,
    handleNotificationClick,
    showToast
  } = useNotifications();

  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    const fetchSuggested = async () => {
      try {
        setLoadingUsers(true);
        const data = await userAPI.getSuggested();
        setSuggestedUsers(data.users || []);
      } catch (err) {
        console.error('Failed to load suggested users in notifications:', err.message);
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchSuggested();
  }, []);

  const handleToggleFollow = async (targetUser) => {
    const isCurrentlyFollowing = targetUser.isFollowing;
    try {
      if (isCurrentlyFollowing) {
        await socialAPI.unfollowUser(targetUser._id);
      } else {
        await socialAPI.followUser(targetUser._id);
      }

      setSuggestedUsers((prev) =>
        prev.map((u) =>
          u._id === targetUser._id ? { ...u, isFollowing: !isCurrentlyFollowing } : u
        )
      );
      showToast(isCurrentlyFollowing ? `Unfollowed @${targetUser.username}` : `Followed @${targetUser.username}`, 'success');
    } catch (err) {
      showToast(err.message || 'Follow action failed', 'error');
    }
  };

  const filteredNotifications = activeTab === 'unread'
    ? notifications.filter((n) => !n.isRead)
    : notifications;

  const renderTypeIcon = (type) => {
    switch (type) {
      case 'like':
        return (
          <div className="notification-type-badge like">
            <Heart size={12} fill="currentColor" />
          </div>
        );
      case 'message':
        return (
          <div className="notification-type-badge message">
            <MessageSquare size={12} fill="currentColor" />
          </div>
        );
      case 'follow':
        return (
          <div className="notification-type-badge follow">
            <UserPlus size={12} />
          </div>
        );
      case 'comment':
        return (
          <div className="notification-type-badge comment">
            <MessageCircle size={12} fill="currentColor" />
          </div>
        );
      case 'reply':
        return (
          <div className="notification-type-badge comment">
            <CornerDownRight size={12} />
          </div>
        );
      case 'repost':
        return (
          <div className="notification-type-badge follow" style={{ backgroundColor: 'var(--repost-color)' }}>
            <Repeat size={12} />
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
            <strong>@{username}</strong> sent you a direct message
          </>
        );
      case 'follow':
        return (
          <>
            <strong>@{username}</strong> started following your profile
          </>
        );
      case 'comment':
        return (
          <>
            <strong>@{username}</strong> left a comment on your post
          </>
        );
      case 'reply':
        return (
          <>
            <strong>@{username}</strong> replied to your comment
          </>
        );
      case 'repost':
        return (
          <>
            <strong>@{username}</strong> reposted your post
          </>
        );
      default:
        return <><strong>@{username}</strong> sent an update</>;
    }
  };

  return (
    <div className="notifications-page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Notifications</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
            Keep track of your likes, messages, and followers
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <CheckCheck size={16} /> Mark all read
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <button
          onClick={() => setActiveTab('all')}
          className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
        >
          All ({notifications.length})
        </button>
        <button
          onClick={() => setActiveTab('unread')}
          className={`tab-btn ${activeTab === 'unread' ? 'active' : ''}`}
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          Unread
          {unreadCount > 0 && (
            <span className="badge badge-info" style={{ padding: '0.1rem 0.4rem', fontSize: '0.7rem' }}>
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* List */}
      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        {loading && notifications.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Loader2 size={32} className="spin" style={{ margin: '0 auto 0.8rem' }} />
            <p>Loading notifications...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div style={{ padding: '3.5rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <BellOff size={36} style={{ opacity: 0.4, margin: '0 auto 0.8rem' }} />
            <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
              {activeTab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </h4>
            <p style={{ fontSize: '0.85rem' }}>
              {activeTab === 'unread' ? 'You have read all recent notifications.' : 'When someone likes, messages, or follows you, you will see it here.'}
            </p>
          </div>
        ) : (
          filteredNotifications.map((notif) => (
            <div
              key={notif._id}
              className={`notification-item ${!notif.isRead ? 'unread' : ''}`}
              style={{ justifyContent: 'space-between' }}
            >
              <div
                onClick={() => handleNotificationClick(notif)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flex: 1, cursor: 'pointer' }}
              >
                <div className="notification-avatar-wrap">
                  <Avatar src={notif.sender?.profilePicture} size={42} />
                  {renderTypeIcon(notif.type)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.4 }}>
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
                    style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: '8px', flexShrink: 0, marginLeft: '0.5rem' }}
                  />
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                {!notif.isRead && <div className="notification-unread-dot" />}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNotification(notif._id);
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '0.35rem', color: 'var(--text-secondary)' }}
                  title="Delete notification"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Suggested People to Follow Section */}
      <div style={{ marginTop: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Sparkles size={18} color="var(--accent-primary)" /> People You May Know
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '0.15rem 0 0 0' }}>
              Connect with active creators in PixelThread
            </p>
          </div>
          <Link to="/search" style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}>
            Find More →
          </Link>
        </div>

        {loadingUsers ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
            <Loader2 size={24} className="spin" style={{ margin: '0 auto 0.5rem' }} />
            <p style={{ fontSize: '0.85rem' }}>Loading recommendations...</p>
          </div>
        ) : suggestedUsers.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)' }}>
            <p style={{ margin: 0 }}>You're all caught up with community members.</p>
          </div>
        ) : (
          <div className="user-grid">
            {suggestedUsers.slice(0, 6).map((u) => (
              <div key={u._id} className="user-card" style={{ padding: '1rem' }}>
                <Link to={`/profile/${u.username}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <Avatar src={u.profilePicture} size={44} style={{ margin: '0 auto 0.5rem' }} />
                  <h4 style={{ fontSize: '0.9rem', margin: 0, fontWeight: 600 }}>{u.name}</h4>
                  <span className="user-handle" style={{ fontSize: '0.78rem' }}>@{u.username}</span>
                </Link>

                <p className="user-bio" style={{ fontSize: '0.8rem', margin: '0.4rem 0 0.8rem', minHeight: '2.2em' }}>
                  {u.bio || 'PixelThread member.'}
                </p>

                <div style={{ display: 'flex', gap: '0.4rem', width: '100%', marginTop: 'auto' }}>
                  <button
                    onClick={() => handleToggleFollow(u)}
                    className={`btn btn-sm ${u.isFollowing ? 'btn-secondary' : ''}`}
                    style={{ flex: 1, justifyContent: 'center', fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
                  >
                    {u.isFollowing ? (
                      <>
                        <UserCheck size={14} /> Following
                      </>
                    ) : (
                      <>
                        <UserPlus size={14} /> Follow
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => navigate(`/messages?userId=${u._id}`)}
                    className="btn btn-secondary btn-sm"
                    title="Direct Message"
                    style={{ padding: '0.35rem 0.5rem' }}
                  >
                    <MessageSquare size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
