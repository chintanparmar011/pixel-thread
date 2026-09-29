import { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { 
  ShieldAlert, 
  Users, 
  FileText, 
  MessageSquare, 
  Trash2, 
  Loader2, 
  Search,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

export const AdminPage = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('all');
  const [activeAdminTab, setActiveAdminTab] = useState('users'); // 'users' | 'posts' | 'logs'

  // Restrict access to Admin role
  if (user?.userType !== 'Admin') {
    return <Navigate to="/" replace />;
  }

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsData, usersData, postsData, logsData] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.getUsers({ search: userSearch, status: userStatusFilter }),
        adminAPI.getPosts({ limit: 20 }),
        adminAPI.getLogs({ limit: 20 }),
      ]);

      setStats(statsData.stats);
      setUsers(usersData.users || []);
      setPosts(postsData.posts || []);
      setLogs(logsData.logs || []);
    } catch (err) {
      console.error('Failed to load admin data:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userStatusFilter]);

  const handleSearchUsers = async (e) => {
    e.preventDefault();
    try {
      const data = await adminAPI.getUsers({ search: userSearch, status: userStatusFilter });
      setUsers(data.users || []);
    } catch (err) {
      alert(err.message || 'User search failed');
    }
  };

  const handleUpdateStatus = async (userId, currentStatus) => {
    const nextAction = currentStatus === 'active' ? 'suspend' : 'reactivate';
    if (!window.confirm(`Are you sure you want to ${nextAction} this account?`)) return;

    try {
      await adminAPI.updateUserStatus(userId, nextAction);
      setUsers((prev) =>
        prev.map((u) =>
          u._id === userId ? { ...u, status: nextAction === 'suspend' ? 'suspended' : 'active' } : u
        )
      );
      // Reload stats & logs
      const [newStats, newLogs] = await Promise.all([adminAPI.getStats(), adminAPI.getLogs({ limit: 10 })]);
      setStats(newStats.stats);
      setLogs(newLogs.logs);
    } catch (err) {
      alert(err.message || 'Action failed');
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Delete this post as Administrator?')) return;
    try {
      await adminAPI.deletePost(postId);
      setPosts((prev) => prev.filter((p) => p._id !== postId));
      const [newStats, newLogs] = await Promise.all([adminAPI.getStats(), adminAPI.getLogs({ limit: 10 })]);
      setStats(newStats.stats);
      setLogs(newLogs.logs);
    } catch (err) {
      alert(err.message || 'Failed to delete post');
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div className="card">
        <h2 className="card-title">
          <ShieldAlert size={24} color="#f59e0b" /> Administrator Control Center (SRS Sec 2.2)
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Manage user accounts, monitor posts, verify system health, and inspect audit trails.
        </p>
      </div>

      {/* Metrics Grid */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-box">
            <h4>Total Users</h4>
            <div className="count">{stats.totalUsers}</div>
          </div>
          <div className="stat-box">
            <h4>Active Accounts</h4>
            <div className="count" style={{ color: '#10b981' }}>{stats.activeUsers}</div>
          </div>
          <div className="stat-box">
            <h4>Suspended Accounts</h4>
            <div className="count" style={{ color: '#ef4444' }}>{stats.suspendedUsers}</div>
          </div>
          <div className="stat-box">
            <h4>Total Posts</h4>
            <div className="count">{stats.totalPosts}</div>
          </div>
          <div className="stat-box">
            <h4>Total Comments</h4>
            <div className="count">{stats.totalComments}</div>
          </div>
          <div className="stat-box">
            <h4>Total Messages</h4>
            <div className="count">{stats.totalMessages}</div>
          </div>
        </div>
      )}

      {/* Admin Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setActiveAdminTab('users')}
          className={`btn ${activeAdminTab === 'users' ? '' : 'btn-secondary'} btn-sm`}
        >
          <Users size={16} /> User Accounts (R.1.5)
        </button>
        <button
          onClick={() => setActiveAdminTab('posts')}
          className={`btn ${activeAdminTab === 'posts' ? '' : 'btn-secondary'} btn-sm`}
        >
          <FileText size={16} /> Content Moderation
        </button>
        <button
          onClick={() => setActiveAdminTab('logs')}
          className={`btn ${activeAdminTab === 'logs' ? '' : 'btn-secondary'} btn-sm`}
        >
          <AlertTriangle size={16} /> Audit Logs
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          <Loader2 size={32} className="spin" style={{ margin: '0 auto 1rem' }} />
          <p>Loading administration data...</p>
        </div>
      ) : activeAdminTab === 'users' ? (
        /* Users Management */
        <div className="card">
          <form onSubmit={handleSearchUsers} style={{ display: 'flex', gap: '0.8rem', marginBottom: '1.2rem' }}>
            <input
              type="text"
              className="text-input"
              placeholder="Search user by name, username, or email..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
            <select
              className="text-input"
              style={{ width: '160px' }}
              value={userStatusFilter}
              onChange={(e) => setUserStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="suspended">Suspended Only</option>
            </select>
            <button type="submit" className="btn btn-sm">
              <Search size={16} />
            </button>
          </form>

          <div className="table-container">
            <table className="styled-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Followers</th>
                  <th>Posts</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{u.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>@{u.username}</div>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{u.email}</td>
                    <td>
                      <span className={`badge ${u.userType === 'Admin' ? 'badge-info' : 'badge-secondary'}`}>
                        {u.userType}
                      </span>
                    </td>
                    <td>{u.followersCount || 0}</td>
                    <td>{u.postsCount || 0}</td>
                    <td>
                      <span className={`badge ${u.status === 'active' ? 'badge-online' : 'badge-danger'}`}>
                        {u.status}
                      </span>
                    </td>
                    <td>
                      {u._id !== user.id && (
                        <button
                          onClick={() => handleUpdateStatus(u._id, u.status)}
                          className={`btn btn-sm ${u.status === 'active' ? 'btn-danger' : 'btn-success'}`}
                        >
                          {u.status === 'active' ? 'Suspend' : 'Reactivate'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeAdminTab === 'posts' ? (
        /* Post Moderation */
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Platform Posts Moderation ({posts.length})</h3>
          <div className="table-container">
            <table className="styled-table">
              <thead>
                <tr>
                  <th>Author</th>
                  <th>Text / Media</th>
                  <th>Likes</th>
                  <th>Comments</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p._id}>
                    <td>@{p.authorId?.username || 'user'}</td>
                    <td style={{ maxWidth: '300px' }}>
                      <div style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                        {p.text || '(Image Only)'}
                      </div>
                      {p.image && (
                        <a href={p.image} target="_blank" rel="noreferrer" style={{ fontSize: '0.75rem', color: '#818cf8' }}>
                          View Media
                        </a>
                      )}
                    </td>
                    <td>{p.likesCount || 0}</td>
                    <td>{p.commentsCount || 0}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <button
                        onClick={() => handleDeletePost(p._id)}
                        className="btn btn-danger btn-sm"
                        title="Delete Post"
                      >
                        <Trash2 size={14} /> Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Audit Logs */
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Admin Action Audit Trail (`AdminActionLog`)</h3>
          <div className="table-container">
            <table className="styled-table">
              <thead>
                <tr>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Target User</th>
                  <th>Timestamp</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l._id}>
                    <td>@{l.adminId?.username || 'admin'}</td>
                    <td>
                      <span className="badge badge-info">{l.actionType}</span>
                    </td>
                    <td>@{l.targetUserId?.username || 'user'}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {new Date(l.createdAt).toLocaleString()}
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{l.details || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
