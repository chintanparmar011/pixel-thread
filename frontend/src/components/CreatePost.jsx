import { useState, useRef } from 'react';
import { postAPI } from '../services/api';
import { Image as ImageIcon, X, Send, Loader2 } from 'lucide-react';

export const CreatePost = ({ onPostCreated }) => {
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
      setError('Please select a valid image file (PNG, JPG, WEBP)');
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
    if (!text.trim() && !imageFile) {
      setError('Please provide text or select an image from your device');
      return;
    }

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
    <div className="card">
      <h2 className="card-title">Share a Post</h2>

      {error && (
        <div style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: '0.8rem' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="create-post-box">
        <textarea
          className="textarea-input"
          rows="3"
          placeholder="What's happening? Share text or media with your network..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={isSubmitting}
        />

        {imagePreview && (
          <div style={{ position: 'relative', display: 'inline-block', maxWidth: '300px' }}>
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
                background: 'rgba(0, 0, 0, 0.7)',
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
              <X size={16} />
            </button>
          </div>
        )}

        <div className="post-actions">
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
            >
              <ImageIcon size={16} /> {imageFile ? 'Change Image' : 'Add Photo from Device'}
            </button>
          </div>

          <button type="submit" className="btn" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="spin" /> Uploading...
              </>
            ) : (
              <>
                <Send size={16} /> Publish Post
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
