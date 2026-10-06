import { useState, useRef } from 'react';
import { postAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Image as ImageIcon, X, Send, Loader2 } from 'lucide-react';
import { Avatar } from './Avatar';

export const CreatePost = ({ onPostCreated }) => {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

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
      if (onPostCreated) {
        onPostCreated(response.post);
      }
    } catch (err) {
      setError(err.message || 'Failed to create post');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card" style={{ marginBottom: '1.25rem' }}>
      {error && (
        <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '0.6rem' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="create-post-box">
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
          <Avatar src={user?.profilePicture} size={40} />
          <textarea
            className="textarea-input"
            rows="2"
            placeholder="What is happening?!"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={isSubmitting}
            style={{ 
              border: 'none', 
              background: 'transparent', 
              padding: '0.4rem 0',
              fontSize: '1rem',
              boxShadow: 'none',
              minHeight: '60px'
            }}
          />
        </div>

        {imagePreview && (
          <div style={{ position: 'relative', display: 'inline-block', maxWidth: '320px', marginLeft: '3rem' }}>
            <img
              src={imagePreview}
              alt="Upload preview"
              style={{
                width: '100%',
                maxHeight: '220px',
                objectFit: 'cover',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
              }}
            />
            <button
              type="button"
              onClick={handleRemoveImage}
              style={{
                position: 'absolute',
                top: '6px',
                right: '6px',
                background: 'rgba(0, 0, 0, 0.75)',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '26px',
                height: '26px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              title="Remove image"
            >
              <X size={15} />
            </button>
          </div>
        )}

        <div className="post-actions" style={{ marginLeft: '3rem' }}>
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
              className="engagement-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSubmitting}
              title="Add photo"
              style={{ color: 'var(--accent-color)' }}
            >
              <ImageIcon size={19} />
              {imageFile && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Selected</span>}
            </button>
          </div>

          <button 
            type="submit" 
            className="btn btn-sm" 
            disabled={isSubmitting || (!text.trim() && !imageFile)}
            style={{ borderRadius: 'var(--radius-full)', padding: '0.4rem 1rem' }}
          >
            {isSubmitting ? (
              <Loader2 size={16} className="spin" />
            ) : (
              'Post'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
