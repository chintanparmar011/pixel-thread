import { useState, useEffect } from 'react';
import { userAPI, socialAPI } from '../services/api';
import { Link, useNavigate } from 'react-router-dom';
import { Search, UserPlus, UserCheck, MessageSquare, Loader2 } from 'lucide-react';

export const SearchPage = () => {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSuggested, setIsSuggested] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSuggested = async () => {
      try {
        setLoading(true);
        const data = await userAPI.getSuggested();
        setUsers(data.users || []);
        setIsSuggested(true);
      } catch (err) {
        console.error('Failed to load suggested users:', err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSuggested();
  }, []);

  useEffect(() => {
    if (!query.trim()) return;

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const data = await userAPI.searchUsers(query.trim());
        setUsers(data.users || []);
        setIsSuggested(false);
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
    } catch (err) {
      alert(err.message || 'Follow action failed');
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <div className="card">
        <h2 className="card-title">Discover & Search Users</h2>
        <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
          <Search size={20} color="var(--text-secondary)" />
          <input
            type="text"
            className="text-input"
            placeholder="Search people by name or username..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div style={{ marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
        {isSuggested ? 'Suggested for you' : `Search results for "${query}" (${users.length})`}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          <Loader2 size={32} className="spin" style={{ margin: '0 auto 1rem' }} />
          <p>Searching database...</p>
        </div>
      ) : users.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: 'var(--text-secondary)' }}>No matching users found.</p>
        </div>
      ) : (
        <div className="user-grid">
          {users.map((u) => (
            <div key={u._id} className="user-card">
              <Link to={`/profile/${u.username}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="avatar">
                  {u.profilePicture ? (
                    <img src={u.profilePicture} alt={u.name} />
                  ) : (
                    u.name.charAt(0).toUpperCase()
                  )}
                </div>
                <h3>{u.name}</h3>
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
  );
};
