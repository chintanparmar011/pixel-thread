import { useState, useRef, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { 
  Home, 
  Search, 
  MessageSquare, 
  ShieldAlert, 
  LogOut,
  Bell,
  Sparkles,
  PlusSquare,
  Download
} from 'lucide-react';

import { Avatar } from './Avatar';
import { NotificationDropdown } from './NotificationDropdown';
import { CreatePostModal } from './CreatePostModal';
import { usePwa } from '../context/PwaContext';

export const Navbar = () => {
  const { user, logout } = useAuth();
  const { unreadCount } = useNotifications();
  const { isInstalled, promptInstall } = usePwa();
  const navigate = useNavigate();

  const [showDropdown, setShowDropdown] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
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
    <>
      {/* Top Header */}
      <header className="app-header">
        <div className="brand-section">
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ 
              width: '28px', 
              height: '28px', 
              borderRadius: '8px', 
              background: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff'
            }}>
              <Sparkles size={16} />
            </span>
            <span className="brand-title">PixelThread</span>
          </Link>
        </div>

        {/* User & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Direct Messages Icon Button */}
          <NavLink 
            to="/messages" 
            className={({ isActive }) => `notification-bell-btn ${isActive ? 'active' : ''}`}
            title="Messages"
            aria-label="Messages"
          >
            <MessageSquare size={19} />
          </NavLink>

          {/* Install App Direct Button (PWA) */}
          {!isInstalled && (
            <button
              type="button"
              onClick={promptInstall}
              className="btn btn-secondary btn-sm pwa-install-header-btn"
              title="Install PixelThread App"
              style={{
                borderRadius: '9999px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.78rem',
                padding: '0.32rem 0.75rem',
              }}
            >
              <Download size={14} color="var(--accent-primary)" />
              <span className="pwa-install-text">Install App</span>
            </button>
          )}

          {/* Notification Bell Dropdown */}
          <div ref={dropdownRef} className="header-notification-wrap" style={{ position: 'relative' }}>
            <button
              onClick={() => setShowDropdown((prev) => !prev)}
              className={`notification-bell-btn ${showDropdown ? 'active' : ''}`}
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell size={19} />
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

          {/* Profile Quick Link */}
          <Link 
            to={`/profile/${user.username}`} 
            className="header-profile-link"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: 'inherit' }}
          >
            <Avatar src={user.profilePicture} size={32} />
            <span style={{ fontWeight: 650, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
              @{user.username}
            </span>
          </Link>

          {/* Logout */}
          <button onClick={handleLogout} className="btn btn-secondary btn-sm" title="Sign Out">
            <LogOut size={15} />
          </button>
        </div>
      </header>

      {/* Universal Bottom Navigation Dock (Icons Only, for all screen sizes) */}
      <nav className="bottom-nav-dock" aria-label="Main Navigation">
        <NavLink 
          to="/" 
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
          title="Feed"
          aria-label="Feed"
        >
          <Home size={22} />
        </NavLink>

        <NavLink 
          to="/search" 
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
          title="Explore"
          aria-label="Explore"
        >
          <Search size={22} />
        </NavLink>

        {/* Center Create Post Button - Compact Emphasized */}
        <button 
          type="button"
          onClick={() => setShowCreateModal(true)} 
          className="bottom-nav-create-btn"
          title="Create Post"
          aria-label="Create Post"
        >
          <PlusSquare size={20} />
        </button>

        <NavLink 
          to="/notifications" 
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
          title="Notifications"
          aria-label="Notifications"
        >
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bell size={22} />
            {unreadCount > 0 && (
              <span className="notification-badge" style={{ top: '-4px', right: '-8px' }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
        </NavLink>

        <NavLink 
          to={`/profile/${user.username}`} 
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
          title="Profile"
          aria-label="Profile"
        >
          <Avatar src={user.profilePicture} size={24} />
        </NavLink>

        {user.userType === 'Admin' && (
          <NavLink 
            to="/admin" 
            className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
            title="Admin Panel"
            aria-label="Admin Panel"
          >
            <ShieldAlert size={22} />
          </NavLink>
        )}
      </nav>

      {/* Global Create Post Modal */}
      <CreatePostModal 
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)} 
      />
    </>
  );
};
