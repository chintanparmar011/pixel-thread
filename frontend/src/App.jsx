import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { NotificationProvider } from './context/NotificationContext';
import { CallProvider } from './context/CallContext';
import { Navbar } from './components/Navbar';
import { FeedPage } from './pages/FeedPage';
import { SearchPage } from './pages/SearchPage';
import { ProfilePage } from './pages/ProfilePage';
import { ChatPage } from './pages/ChatPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { PostDetailPage } from './pages/PostDetailPage';
import { AdminPage } from './pages/AdminPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { InstallPwaBanner } from './components/InstallPwaBanner';
import { ThemeProvider } from './context/ThemeContext';
import { PwaProvider } from './context/PwaContext';
import { Loader2 } from 'lucide-react';
import './App.css';

// Route guard for pages requiring login
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)' }}>
        <Loader2 size={36} className="spin" />
      </div>
    );
  }

  if (!user) {
    const redirectParam = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirectParam}`} replace />;
  }

  return (
    <>
      <Navbar />
      <main className="main-content">{children}</main>
    </>
  );
};

// Route guard for public-only pages (Login, Signup)
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)' }}>
        <Loader2 size={36} className="spin" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function App() {
  return (
    <ThemeProvider>
      <PwaProvider>
        <BrowserRouter>
        <AuthProvider>
          <SocketProvider>
            <NotificationProvider>
              <CallProvider>
                <div className="app-container">
              <Routes>
                {/* Public Routes */}
                <Route
                  path="/login"
                  element={
                    <PublicRoute>
                      <LoginPage />
                    </PublicRoute>
                  }
                />
                <Route
                  path="/signup"
                  element={
                    <PublicRoute>
                      <SignupPage />
                    </PublicRoute>
                  }
                />

                {/* Protected Routes (Require Authentication) */}
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <FeedPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/search"
                  element={
                    <ProtectedRoute>
                      <SearchPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/profile/:username"
                  element={
                    <ProtectedRoute>
                      <ProfilePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/messages"
                  element={
                    <ProtectedRoute>
                      <ChatPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/notifications"
                  element={
                    <ProtectedRoute>
                      <NotificationsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/post/:postId"
                  element={
                    <ProtectedRoute>
                      <PostDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/posts/:postId"
                  element={
                    <ProtectedRoute>
                      <PostDetailPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute>
                      <AdminPage />
                    </ProtectedRoute>
                  }
                />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              <InstallPwaBanner />
            </div>
            </CallProvider>
          </NotificationProvider>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
      </PwaProvider>
    </ThemeProvider>
  );
}

export default App;
