import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('pixelthread_token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const storedToken = localStorage.getItem('pixelthread_token');
      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        const response = await authAPI.getMe();
        setUser(response.user);
      } catch (err) {
        console.error('Failed to restore session:', err.message);
        localStorage.removeItem('pixelthread_token');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const login = async (identifier, password) => {
    const response = await authAPI.signin({ identifier, password });
    localStorage.setItem('pixelthread_token', response.token);
    setToken(response.token);
    setUser(response.user);
    return response.user;
  };

  const signup = async (formData) => {
    const response = await authAPI.signup(formData);
    localStorage.setItem('pixelthread_token', response.token);
    setToken(response.token);
    setUser(response.user);
    return response.user;
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (e) {
    } finally {
      localStorage.removeItem('pixelthread_token');
      setToken(null);
      setUser(null);
    }
  };

  const updateUser = (userData) => {
    setUser((prev) => ({ ...prev, ...userData }));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
