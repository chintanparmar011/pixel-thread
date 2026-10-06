import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Search, Loader2, UserCheck, UserPlus } from 'lucide-react';
import { socialAPI } from '../services/api';
import { Avatar } from './Avatar';
import { useNotifications } from '../context/NotificationContext';

export const FollowListModal = ({
  isOpen,
  onClose,
  userId,
  initialTab = 'followers',
  currentUserId,
  onFollowChange,
}) => {
  const { showToast } = useNotifications();
  const [activeTab, setActiveTab] = useState(initialTab); // 'followers' | 'following'
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState({});

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setSearchQuery('');
      loadData();
    }
  }, [isOpen, userId, initialTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [followersRes, followingRes] = await Promise.all([
        socialAPI.getFollowers(userId),
        socialAPI.getFollowing(userId),
      ]);
      setFollowers(followersRes.followers || []);
      setFollowing(followingRes.following || []);
    } catch (err) {
      console.error('Failed to load followers/following:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFollow = async (targetUser) => {
    const targetId = targetUser._id;
    const isCurrentlyFollowing = !!targetUser.isFollowing;
    setActionLoading((prev) => ({ ...prev, [targetId]: true }));

    try {
      if (isCurrentlyFollowing) {
        await socialAPI.unfollowUser(targetId);
      } else {
        await socialAPI.followUser(targetId);
      }

      // Update local state in both lists
      const updateList = (list) =>
        list.map((u) => (u._id === targetId ? { ...u, isFollowing: !isCurrentlyFollowing } : u));

      setFollowers((prev) => updateList(prev));
      setFollowing((prev) => updateList(prev));

      if (onFollowChange) {
        onFollowChange();
      }
    } catch (err) {
      showToast(err.message || 'Action failed', 'error');
    } finally {
      setActionLoading((prev) => ({ ...prev, [targetId]: false }));
    }
  };

  if (!isOpen) return null;

  const currentList = activeTab === 'followers' ? followers : following;
  const filteredList = currentList.filter(
    (u) =>
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '460px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header with Tabs and Close */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-color)',
            padding: '0.8rem 1rem',
          }}
        >
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setActiveTab('followers')}
              className={`btn ${activeTab === 'followers' ? '' : 'btn-secondary'} btn-sm`}
              style={{ borderRadius: '20px', fontSize: '0.85rem' }}
            >
              Followers ({followers.length})
            </button>
            <button
              onClick={() => setActiveTab('following')}
              className={`btn ${activeTab === 'following' ? '' : 'btn-secondary'} btn-sm`}
              style={{ borderRadius: '20px', fontSize: '0.85rem' }}
            >
              Following ({following.length})
            </button>
          </div>
          <button
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{ padding: '0.3rem', borderRadius: '50%' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Bar */}
        <div style={{ padding: '0.8rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ position: 'relative' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-secondary)',
              }}
            />
            <input
              type="text"
              className="text-input"
              style={{ paddingLeft: '2.4rem' }}
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Users List Stream */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 1rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>
              <Loader2 size={28} className="spin" style={{ margin: '0 auto 0.5rem' }} />
              <p style={{ fontSize: '0.85rem' }}>Loading {activeTab}...</p>
            </div>
          ) : filteredList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              {searchQuery ? 'No matching users found.' : `No ${activeTab} yet.`}
            </div>
          ) : (
            filteredList.map((user) => {
              const isSelf = user._id === currentUserId;
              const isBusy = !!actionLoading[user._id];

              return (
                <div
                  key={user._id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.7rem 0',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                  }}
                >
                  <Link
                    to={`/profile/${user.username}`}
                    onClick={onClose}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.8rem',
                      textDecoration: 'none',
                      color: 'inherit',
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <Avatar src={user.profilePicture} size={42} />
                    <div style={{ minWidth: 0, overflow: 'hidden' }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: '0.9rem',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                        }}
                      >
                        {user.name}
                      </div>
                      <div
                        style={{
                          fontSize: '0.8rem',
                          color: 'var(--text-secondary)',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                        }}
                      >
                        @{user.username}
                      </div>
                    </div>
                  </Link>

                  {!isSelf && (
                    <button
                      onClick={() => handleToggleFollow(user)}
                      disabled={isBusy}
                      className={`btn btn-sm ${user.isFollowing ? 'btn-secondary' : ''}`}
                      style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem', flexShrink: 0 }}
                    >
                      {isBusy ? (
                        <Loader2 size={14} className="spin" />
                      ) : user.isFollowing ? (
                        <>
                          <UserCheck size={14} /> Following
                        </>
                      ) : (
                        <>
                          <UserPlus size={14} /> Follow
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
