import { useState, useRef } from 'react';
import { postAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { Image as ImageIcon, X, Loader2, Sparkles, Send } from 'lucide-react';
import { Avatar } from './Avatar';
import { useNavigate } from 'react-router-dom';

export const CreatePostModal = ({ isOpen, onClose, onPostCreated }) => {
  const { user } = useAuth();
  const { showToast } = useNotifications();
  const navigate = useNavigate();

  const [text, setText] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image (PNG, JPG, WEBP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image file size must be less than 5MB');
      return;
    }

    setError('');
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim() && !imageFile) return;

    setIsSubmitting(true);
    setError('');

    try {
      const formData = new FormData();
      if (text.trim()) {
        formData.append('text', text.trim());
      }
      if (imageFile) {
        formData.append('image', imageFile);
      }

      const response = await postAPI.createPost(formData);
      setText('');
      handleRemoveImage();
      showToast('Post published successfully!', 'success');
      
      // Dispatch global event so feed updates in real-time
      window.dispatchEvent(new CustomEvent('postCreated', { detail: response.post }));
      
      if (onPostCreated) {
        onPostCreated(response.post);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create post');
      showToast(err.message || 'Failed to create post', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10001,
        backgroundColor: 'var(--modal-overlay)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '540px',
          padding: '1.4rem',
          margin: 0,
          backgroundColor: 'var(--bg-modal)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-lg)',
          borderRadius: '16px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Sparkles size={18} color="var(--accent-primary)" /> New Post
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{ padding: '0.3rem', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <div style={{ color: 'var(--danger)', fontSize: '0.84rem', marginBottom: '0.8rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '0.5rem 0.8rem', borderRadius: '8px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <Avatar src={user?.profilePicture} size={42} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                {user?.name || user?.username}
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginLeft: '0.35rem', fontWeight: 400 }}>
                  @{user?.username}
                </span>
              </div>
              <textarea
                className="textarea-input"
                rows="4"
                placeholder="What is happening?! Share your thoughts..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={isSubmitting}
                autoFocus
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: '0.4rem 0',
                  fontSize: '0.98rem',
                  boxShadow: 'none',
                  minHeight: '90px',
                  resize: 'none',
                  width: '100%',
                }}
              />
            </div>
          </div>

          {/* Image Preview */}
          {imagePreview && (
            <div style={{ position: 'relative', display: 'block', marginBottom: '1rem', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border-color)', maxHeight: '240px', backgroundColor: 'var(--bg-secondary)' }}>
              <img
                src={imagePreview}
                alt="Upload preview"
                style={{ width: '100%', maxHeight: '240px', objectFit: 'cover' }}
              />
              <button
                type="button"
                onClick={handleRemoveImage}
                style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  background: 'rgba(0, 0, 0, 0.75)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                title="Remove image"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Actions Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
            <div>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileChange}
                disabled={isSubmitting}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting}
                title="Attach photo"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-primary)' }}
              >
                <ImageIcon size={18} />
                <span style={{ fontSize: '0.82rem' }}>{imageFile ? 'Change Photo' : 'Add Photo'}</span>
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary btn-sm"
                disabled={isSubmitting}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn btn-sm"
                disabled={isSubmitting || (!text.trim() && !imageFile)}
                style={{
                  borderRadius: '10px',
                  padding: '0.5rem 1.35rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  backgroundColor: 'var(--btn-primary-bg)',
                  color: 'var(--btn-primary-text)',
                  fontWeight: 650,
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {isSubmitting ? (
                  <Loader2 size={16} className="spin" />
                ) : (
                  <>
                    <Send size={15} /> Post
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
