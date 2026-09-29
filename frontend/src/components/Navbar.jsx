import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Home, 
  Search, 
  MessageSquare, 
  User as UserIcon, 
  ShieldAlert, 
  LogOut 
} from 'lucide-react';

export const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <header className="app-header">
      <div className="brand-section">
        <Link to="/" style={{ textDecoration: 'none' }}>
          <h1 className="brand-title">PixelThread</h1>
        </Link>
        <span className="badge badge-info">{user.userType}</span>
      </div>

      <nav style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
        <NavLink 
          to="/" 
          className={({ isActive }) => `tab-btn ${isActive ? 'active' : ''}`}
        >
          <Home size={18} /> Feed
        </NavLink>

        <NavLink 
          to="/search" 
          className={({ isActive }) => `tab-btn ${isActive ? 'active' : ''}`}
        >
          <Search size={18} /> Discover
        </NavLink>

        <NavLink 
          to="/messages" 
          className={({ isActive }) => `tab-btn ${isActive ? 'active' : ''}`}
        >
          <MessageSquare size={18} /> Messages
        </NavLink>

        <NavLink 
          to={`/profile/${user.username}`} 
          className={({ isActive }) => `tab-btn ${isActive ? 'active' : ''}`}
        >
          <UserIcon size={18} /> Profile
        </NavLink>

        {user.userType === 'Admin' && (
          <NavLink 
            to="/admin" 
            className={({ isActive }) => `tab-btn ${isActive ? 'active' : ''}`}
            style={{ color: '#fbbf24' }}
          >
            <ShieldAlert size={18} /> Admin
          </NavLink>
        )}
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Link 
          to={`/profile/${user.username}`} 
          style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none', color: 'inherit' }}
        >
          <div className="avatar" style={{ width: '36px', height: '36px', fontSize: '0.9rem' }}>
            {user.profilePicture ? (
              <img src={user.profilePicture} alt={user.name} />
            ) : (
              user.name.charAt(0).toUpperCase()
            )}
          </div>
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>@{user.username}</span>
        </Link>

        <button onClick={handleLogout} className="btn btn-secondary btn-sm" title="Sign Out">
          <LogOut size={16} /> Logout
        </button>
      </div>
    </header>
  );
};
