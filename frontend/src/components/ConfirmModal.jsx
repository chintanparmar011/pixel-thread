import { useEffect } from 'react';
import { AlertTriangle, Trash2, X, Check } from 'lucide-react';

export const ConfirmModal = ({
  isOpen,
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'danger', // 'danger' or 'primary'
  onConfirm,
  onClose,
  loading = false,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  const isDanger = confirmVariant === 'danger';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '1.5rem',
          margin: 0,
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(240, 246, 252, 0.12)',
          position: 'relative',
          backgroundColor: '#161b22',
          borderRadius: '12px',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem', marginBottom: '1rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: isDanger ? 'rgba(248, 81, 73, 0.15)' : 'rgba(137, 87, 229, 0.15)',
              border: `1px solid ${isDanger ? 'rgba(248, 81, 73, 0.3)' : 'rgba(137, 87, 229, 0.3)'}`,
              color: isDanger ? '#f85149' : '#a371f7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {isDanger ? <AlertTriangle size={20} /> : <Check size={20} />}
          </div>
          <div>
            <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.35rem 0', color: 'var(--text-primary)', fontWeight: 600 }}>
              {title}
            </h3>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              {message}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '1.25rem' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            disabled={loading}
            style={{ padding: '0.45rem 1rem' }}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={onConfirm}
            disabled={loading}
            style={{
              backgroundColor: isDanger ? '#da3633' : 'var(--accent-purple)',
              color: '#ffffff',
              border: 'none',
              padding: '0.45rem 1.15rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            {isDanger && <Trash2 size={14} />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
