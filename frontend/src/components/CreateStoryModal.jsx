import { useState, useRef } from 'react';
import { X, Image as ImageIcon, Loader2, Sparkles } from 'lucide-react';
import { storyAPI } from '../services/api';
import { useNotifications } from '../context/NotificationContext';

export const CreateStoryModal = ({ isOpen, onClose, onStoryCreated }) => {
  const { showToast } = useNotifications();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (!selected.type.startsWith('image/')) {
        showToast('Please select an image file', 'error');
        return;
      }
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setCaption('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      showToast('Please select a photo for your story', 'error');
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('media', file);
      if (caption.trim()) formData.append('caption', caption.trim());
      formData.append('mediaType', 'image');

      const data = await storyAPI.createStory(formData);
      showToast('Story shared for 24 hours!', 'success');
      handleReset();
      onStoryCreated?.(data.story);
      onClose();
    } catch (err) {
      showToast(err.message || 'Failed to upload story', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) {
          handleReset();
          onClose();
        }
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '440px',
          padding: '1.5rem',
          backgroundColor: '#161b22',
          borderRadius: '16px',
          position: 'relative',
        }}
      >
        <button
          type="button"
          onClick={() => {
            if (!loading) {
              handleReset();
              onClose();
            }
          }}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          <X size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <Sparkles size={20} color="#a371f7" />
          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Add to Story</h3>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          {!preview ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed rgba(137, 87, 229, 0.4)',
                borderRadius: '12px',
                padding: '2.5rem 1rem',
                textAlign: 'center',
                cursor: 'pointer',
                backgroundColor: 'rgba(137, 87, 229, 0.05)',
                transition: 'border-color 0.2s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem',
              }}
            >
              <div
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(137, 87, 229, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#a371f7',
                }}
              >
                <ImageIcon size={26} />
              </div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Select Photo for Story</div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Visible to your followers for 24 hours
              </p>
            </div>
          ) : (
            <div style={{ position: 'relative', marginBottom: '1rem' }}>
              <img
                src={preview}
                alt="Story preview"
                style={{
                  width: '100%',
                  maxHeight: '360px',
                  objectFit: 'contain',
                  borderRadius: '12px',
                  backgroundColor: '#0d1117',
                }}
              />
              <button
                type="button"
                onClick={handleReset}
                style={{
                  position: 'absolute',
                  top: '0.5rem',
                  right: '0.5rem',
                  background: 'rgba(0, 0, 0, 0.7)',
                  border: 'none',
                  color: 'white',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>
          )}

          <div style={{ marginTop: '1rem' }}>
            <input
              type="text"
              className="text-input"
              placeholder="Add a caption... (optional)"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={200}
              style={{ borderRadius: '8px' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                handleReset();
                onClose();
              }}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-sm"
              disabled={!file || loading}
              style={{ minWidth: '110px', justifyContent: 'center' }}
            >
              {loading ? <Loader2 size={16} className="spin" /> : 'Share Story'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
