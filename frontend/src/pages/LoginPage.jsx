import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, LogIn } from 'lucide-react';

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!identifier || !password) {
      setError('Please fill in both fields');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const loggedInUser = await login(identifier, password);
      if (redirect) {
        navigate(decodeURIComponent(redirect));
      } else if (loggedInUser.userType === 'Admin') {
        navigate('/admin');
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAdmin = () => {
    setIdentifier('ogadmin');
    setPassword('12345678');
  };

  return (
    <div style={{ maxWidth: '400px', margin: '4rem auto', width: '100%', padding: '0 1rem' }}>
      <div className="card" style={{ padding: '2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h1 className="brand-title" style={{ fontSize: '2rem' }}>PixelThread</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.4rem' }}>
            Sign in to your account
          </p>
        </div>

        {error && (
          <div style={{
            padding: '0.75rem',
            borderRadius: '6px',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            fontSize: '0.85rem',
            marginBottom: '1rem'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
              Email or Username
            </label>
            <input
              type="text"
              className="text-input"
              placeholder="e.g. chintan01 or user@email.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
              Password
            </label>
            <input
              type="password"
              className="text-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn" style={{ justifyContent: 'center', marginTop: '0.5rem' }} disabled={loading}>
            {loading ? <Loader2 size={16} className="spin" /> : <><LogIn size={16} /> Sign In</>}
          </button>
        </form>

        <div style={{ borderTop: '1px solid var(--border-color)', margin: '1.5rem 0', paddingTop: '1rem', textAlign: 'center' }}>
          <button
            type="button"
            onClick={handleQuickAdmin}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.8rem', width: '100%', justifyContent: 'center' }}
          >
            Fill Admin Credentials (ogadmin / 12345678)
          </button>
        </div>

        <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Don't have an account?{' '}
          <Link
            to={redirect ? `/signup?redirect=${encodeURIComponent(redirect)}` : '/signup'}
            style={{ color: '#818cf8', textDecoration: 'none', fontWeight: 600 }}
          >
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
};
