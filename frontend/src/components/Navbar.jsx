import { useState, useRef, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { 
  Home, 
  Search, 
  MessageSquare, 
  User as UserIcon, 
  ShieldAlert, 
  LogOut,
  Bell
} from 'lucide-react';

import { Avatar } from './Avatar';
import { NotificationDropdown } from './NotificationDropdown';

export const Navbar = () => {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();

  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Close notification dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

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

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
        {/* Notification Bell with Dropdown */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowDropdown((prev) => !prev)}
            className={`notification-bell-btn ${showDropdown ? 'active' : ''}`}
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="notification-badge">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {showDropdown && (
            <NotificationDropdown onClose={() => setShowDropdown(false)} />
          )}
        </div>

        <Link 
          to={`/profile/${user.username}`} 
          style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none', color: 'inherit' }}
        >
          <Avatar src={user.profilePicture} size={36} />
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>@{user.username}</span>
        </Link>

        <button onClick={handleLogout} className="btn btn-secondary btn-sm" title="Sign Out">
          <LogOut size={16} /> Logout
        </button>
      </div>
    </header>
  );
};
