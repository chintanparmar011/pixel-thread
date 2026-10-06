import { useState, useEffect } from 'react';
import { userAPI, socialAPI, postAPI } from '../services/api';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Search, 
  UserPlus, 
  UserCheck, 
  MessageSquare, 
  Loader2, 
  Flame, 
  Users, 
  Heart, 
  Repeat, 
  X,
  TrendingUp,
  Sparkles
} from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { useNotifications } from '../context/NotificationContext';
import { timeAgo } from '../utils/timeAgo';

export const SearchPage = () => {
  const { showToast } = useNotifications();
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'top_posts' | 'people'
  
  // Data states
  const [users, setUsers] = useState([]);
  const [topPosts, setTopPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSuggestedUsers, setIsSuggestedUsers] = useState(true);
  const navigate = useNavigate();

  // Load initial explore posts and suggested users
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const [postsData, usersData] = await Promise.all([
          postAPI.getExplorePosts(),
          userAPI.getSuggested(),
        ]);
        setTopPosts(postsData.posts || []);
        setUsers(usersData.users || []);
        setIsSuggestedUsers(true);
      } catch (err) {
        console.error('Failed to load explore data:', err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  // Search when query changes (with debounce)
  useEffect(() => {
    if (!query.trim()) {
      // Restore explore posts and suggested users
      postAPI.getExplorePosts().then((res) => setTopPosts(res.posts || []));
      userAPI.getSuggested().then((res) => {
        setUsers(res.users || []);
        setIsSuggestedUsers(true);
      });
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const [postsRes, usersRes] = await Promise.all([
          postAPI.getExplorePosts({ search: query.trim() }),
          userAPI.searchUsers(query.trim()),
        ]);
        setTopPosts(postsRes.posts || []);
        setUsers(usersRes.users || []);
        setIsSuggestedUsers(false);
      } catch (err) {
        console.error('Search failed:', err.message);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  const handleToggleFollow = async (targetUser) => {
    const isCurrentlyFollowing = targetUser.isFollowing;
    try {
      if (isCurrentlyFollowing) {
        await socialAPI.unfollowUser(targetUser._id);
      } else {
        await socialAPI.followUser(targetUser._id);
      }

      setUsers((prev) =>
        prev.map((u) =>
          u._id === targetUser._id ? { ...u, isFollowing: !isCurrentlyFollowing } : u
        )
      );
      showToast(isCurrentlyFollowing ? `Unfollowed @${targetUser.username}` : `Followed @${targetUser.username}`, 'success');
    } catch (err) {
      showToast(err.message || 'Follow action failed', 'error');
    }
  };

  const clearSearch = () => {
    setQuery('');
  };

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', width: '100%' }}>
      {/* Search Header Card */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={22} color="#a371f7" /> Explore & Search
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Trending posts & community
          </span>
        </div>

        {/* Search Input Box */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search 
            size={18} 
            style={{ position: 'absolute', left: '14px', color: 'var(--text-secondary)', pointerEvents: 'none' }} 
          />
          <input
            type="text"
            className="text-input"
            placeholder="Search high-engagement posts, people, or keywords..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ 
              paddingLeft: '2.5rem', 
              paddingRight: query ? '2.5rem' : '1rem',
              borderRadius: '9999px',
              backgroundColor: 'rgba(13, 17, 23, 0.75)',
              border: '1px solid var(--border-color)',
              height: '44px'
            }}
          />
          {query && (
            <button
              onClick={clearSearch}
              style={{
                position: 'absolute',
                right: '12px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Category Filter Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
          <button
            onClick={() => setActiveFilter('all')}
            className={`tab-btn ${activeFilter === 'all' ? 'active' : ''}`}
            style={{ padding: '0.35rem 0.85rem', fontSize: '0.82rem', borderRadius: '9999px' }}
          >
            All
          </button>
          <button
            onClick={() => setActiveFilter('top_posts')}
            className={`tab-btn ${activeFilter === 'top_posts' ? 'active' : ''}`}
            style={{ 
              padding: '0.35rem 0.85rem', 
              fontSize: '0.82rem', 
              borderRadius: '9999px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <Flame size={15} color="#f97316" /> Top Posts ({topPosts.length})
          </button>
          <button
            onClick={() => setActiveFilter('people')}
            className={`tab-btn ${activeFilter === 'people' ? 'active' : ''}`}
            style={{ 
              padding: '0.35rem 0.85rem', 
              fontSize: '0.82rem', 
              borderRadius: '9999px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <Users size={15} color="#a371f7" /> People ({users.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
          <Loader2 size={36} className="spin" style={{ margin: '0 auto 1rem', color: 'var(--accent-color)' }} />
          <p style={{ fontSize: '0.9rem' }}>Exploring content...</p>
        </div>
      ) : (
        <>
          {/* SECTION 1: HIGH AUDIENCE / TOP POSTS */}
          {(activeFilter === 'all' || activeFilter === 'top_posts') && (
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <h3 style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Flame size={18} color="#f97316" /> 
                  {query ? `Top Audience Posts for "${query}"` : 'High Audience & Trending Posts'}
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Ranked by likes & comments
                </span>
              </div>

              {topPosts.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  <p>No high audience posts found matching your search.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: '1rem' }}>
                  {topPosts.map((post) => (
                    <div
                      key={post._id}
                      onClick={() => navigate(`/post/${post._id}`)}
                      className="card"
                      style={{
                        margin: 0,
                        padding: '1rem',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        transition: 'transform 0.15s ease, border-color 0.15s ease',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--accent-color)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                        e.currentTarget.style.transform = 'none';
                      }}
                    >
                      {/* Author Header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.6rem' }}>
                        <Avatar src={post.authorId?.profilePicture} size={34} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {post.authorId?.name || post.authorId?.username}
                          </span>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                            @{post.authorId?.username} • {timeAgo(post.createdAt)}
                          </span>
                        </div>
                      </div>

                      {/* Post Text */}
                      {post.text && (
                        <p style={{ 
                          fontSize: '0.88rem', 
                          color: 'var(--text-primary)', 
                          lineHeight: 1.4,
                          margin: '0 0 0.6rem 0',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}>
                          {post.text}
                        </p>
                      )}

                      {/* Image Preview (if present) */}
                      {post.image && (
                        <div style={{ borderRadius: '8px', overflow: 'hidden', marginBottom: '0.6rem', maxHeight: '160px', backgroundColor: '#0d1117' }}>
                          <img
                            src={post.image}
                            alt="Post visual"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                      )}

                      {/* Engagement Audience Footer */}
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.85rem', 
                        paddingTop: '0.6rem', 
                        borderTop: '1px solid rgba(240, 246, 252, 0.08)',
                        fontSize: '0.78rem',
                        color: 'var(--text-secondary)'
                      }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: post.likesCount > 0 ? '#f43f5e' : 'inherit' }}>
                          <Heart size={14} fill={post.likesCount > 0 ? '#f43f5e' : 'none'} />
                          <strong>{post.likesCount || 0}</strong>
                        </span>

                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: post.commentsCount > 0 ? '#d2a8ff' : 'inherit' }}>
                          <MessageSquare size={14} />
                          <strong>{post.commentsCount || 0}</strong>
                        </span>

                        {post.repostsCount > 0 && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#3fb950' }}>
                            <Repeat size={14} />
                            <strong>{post.repostsCount}</strong>
                          </span>
                        )}

                        <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#8957e5', fontWeight: 600 }}>
                          View Post →
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SECTION 2: FIND PEOPLE */}
          {(activeFilter === 'all' || activeFilter === 'people') && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <h3 style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Users size={18} color="#a371f7" /> 
                  {isSuggestedUsers ? 'People You May Know' : `People Results for "${query}"`}
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {users.length} found
                </span>
              </div>

              {users.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  <p>No users found matching "{query}".</p>
                </div>
              ) : (
                <div className="user-grid">
                  {users.map((u) => (
                    <div key={u._id} className="user-card">
                      <Link to={`/profile/${u.username}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                        <Avatar src={u.profilePicture} size={48} style={{ margin: '0 auto 0.6rem' }} />
                        <h3 style={{ fontSize: '0.95rem' }}>{u.name}</h3>
                        <span className="user-handle">@{u.username}</span>
                      </Link>

                      <p className="user-bio">{u.bio || 'No bio yet.'}</p>

                      <div style={{ display: 'flex', gap: '0.5rem', width: '100%', marginTop: 'auto' }}>
                        <button
                          onClick={() => handleToggleFollow(u)}
                          className={`btn btn-sm ${u.isFollowing ? 'btn-secondary' : ''}`}
                          style={{ flex: 1, justifyContent: 'center' }}
                        >
                          {u.isFollowing ? (
                            <>
                              <UserCheck size={16} /> Following
                            </>
                          ) : (
                            <>
                              <UserPlus size={16} /> Follow
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => navigate(`/messages?userId=${u._id}`)}
                          className="btn btn-secondary btn-sm"
                          title="Direct Message"
                        >
                          <MessageSquare size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
