import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Avatar } from './Avatar';
import { timeAgo } from '../utils/timeAgo';
import { storyAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { ConfirmModal } from './ConfirmModal';

const STORY_DURATION_MS = 5000;

export const StoryViewerModal = ({
  isOpen,
  trayUsers = [],
  initialUserIndex = 0,
  onClose,
  onStoryDeleted,
}) => {
  const { user: currentUser } = useAuth();
  const { showToast } = useNotifications();

  const [currentUserIdx, setCurrentUserIdx] = useState(initialUserIndex);
  const [currentStoryIdx, setCurrentStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const timerRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const elapsedBeforePauseRef = useRef(0);

  const activeGroup = trayUsers[currentUserIdx] || null;
  const stories = activeGroup?.stories || [];
  const currentStory = stories[currentStoryIdx] || null;

  // Reset when opened or initial index changes
  useEffect(() => {
    if (isOpen) {
      setCurrentUserIdx(initialUserIndex);
      // Pick first unviewed story or story 0
      const targetGroup = trayUsers[initialUserIndex];
      if (targetGroup?.stories?.length) {
        const firstUnseenIdx = targetGroup.stories.findIndex(
          (s) => !s.viewers?.some((v) => (v.user?._id || v.user) === currentUser?.id)
        );
        setCurrentStoryIdx(firstUnseenIdx >= 0 ? firstUnseenIdx : 0);
      } else {
        setCurrentStoryIdx(0);
      }
      setProgress(0);
      elapsedBeforePauseRef.current = 0;
    }
  }, [isOpen, initialUserIndex, trayUsers, currentUser?.id]);

  // Mark story as viewed
  useEffect(() => {
    if (isOpen && currentStory && currentStory._id) {
      storyAPI.viewStory(currentStory._id).catch(() => {});
    }
  }, [isOpen, currentStory]);

  const handleNextStory = useCallback(() => {
    if (currentStoryIdx < stories.length - 1) {
      setCurrentStoryIdx((prev) => prev + 1);
      setProgress(0);
      elapsedBeforePauseRef.current = 0;
    } else if (currentUserIdx < trayUsers.length - 1) {
      setCurrentUserIdx((prev) => prev + 1);
      setCurrentStoryIdx(0);
      setProgress(0);
      elapsedBeforePauseRef.current = 0;
    } else {
      onClose();
    }
  }, [currentStoryIdx, stories.length, currentUserIdx, trayUsers.length, onClose]);

  const handlePrevStory = useCallback(() => {
    if (currentStoryIdx > 0) {
      setCurrentStoryIdx((prev) => prev - 1);
      setProgress(0);
      elapsedBeforePauseRef.current = 0;
    } else if (currentUserIdx > 0) {
      const prevUserStories = trayUsers[currentUserIdx - 1]?.stories || [];
      setCurrentUserIdx((prev) => prev - 1);
      setCurrentStoryIdx(Math.max(0, prevUserStories.length - 1));
      setProgress(0);
      elapsedBeforePauseRef.current = 0;
    }
  }, [currentStoryIdx, currentUserIdx, trayUsers]);

  // Progress ticker
  useEffect(() => {
    if (!isOpen || !currentStory || isPaused || deleteConfirmOpen) {
      return;
    }

    const intervalTime = 50; // update every 50ms
    startTimeRef.current = Date.now() - elapsedBeforePauseRef.current;

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min(100, (elapsed / STORY_DURATION_MS) * 100);
      setProgress(pct);

      if (elapsed >= STORY_DURATION_MS) {
        clearInterval(timerRef.current);
        handleNextStory();
      }
    }, intervalTime);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, currentStory, isPaused, deleteConfirmOpen, handleNextStory]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') handleNextStory();
      else if (e.key === 'ArrowLeft') handlePrevStory();
      else if (e.key === ' ') {
        e.preventDefault();
        setIsPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNextStory, handlePrevStory, onClose]);

  const handlePause = () => {
    setIsPaused(true);
    elapsedBeforePauseRef.current = (progress / 100) * STORY_DURATION_MS;
  };

  const handleResume = () => {
    setIsPaused(false);
  };

  const handleDeleteStory = async () => {
    if (!currentStory) return;
    try {
      setDeleting(true);
      await storyAPI.deleteStory(currentStory._id);
      showToast('Story removed', 'info');
      setDeleteConfirmOpen(false);
      onStoryDeleted?.(currentStory._id);
      handleNextStory();
    } catch (err) {
      showToast(err.message || 'Failed to delete story', 'error');
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen || !currentStory || !activeGroup) return null;

  const isOwner =
    currentStory.authorId?._id === currentUser?.id ||
    currentStory.authorId === currentUser?.id;
  const isAdmin = currentUser?.userType === 'Admin';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
      }}
    >
      {/* Outer Close Button */}
      <button
        type="button"
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '1.25rem',
          right: '1.5rem',
          background: 'rgba(255, 255, 255, 0.15)',
          border: 'none',
          color: '#ffffff',
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 10002,
          transition: 'background 0.2s',
        }}
        title="Close story"
      >
        <X size={20} />
      </button>

      {/* Main Story Container (9:16 mobile aspect box) */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '420px',
          height: '92vh',
          maxHeight: '780px',
          backgroundColor: '#0d1117',
          borderRadius: '16px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
        }}
        onMouseDown={handlePause}
        onMouseUp={handleResume}
        onTouchStart={handlePause}
        onTouchEnd={handleResume}
      >
        {/* Progress Bars Tray */}
        <div
          style={{
            position: 'absolute',
            top: '0.75rem',
            left: '0.75rem',
            right: '0.75rem',
            display: 'flex',
            gap: '4px',
            zIndex: 10001,
          }}
        >
          {stories.map((st, idx) => {
            let widthPct = 0;
            if (idx < currentStoryIdx) widthPct = 100;
            else if (idx === currentStoryIdx) widthPct = progress;
            return (
              <div
                key={st._id || idx}
                style={{
                  flex: 1,
                  height: '3px',
                  backgroundColor: 'rgba(255, 255, 255, 0.25)',
                  borderRadius: '2px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${widthPct}%`,
                    backgroundColor: '#ffffff',
                    transition: idx === currentStoryIdx ? 'width 0.05s linear' : 'none',
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Story Header (Author info) */}
        <div
          style={{
            position: 'absolute',
            top: '1.5rem',
            left: '0.75rem',
            right: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 10001,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Avatar src={activeGroup.user.profilePicture} size={36} />
            <div>
              <div style={{ color: '#ffffff', fontSize: '0.88rem', fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                {activeGroup.user.name || activeGroup.user.username}
              </div>
              <div style={{ color: 'rgba(255, 255, 255, 0.75)', fontSize: '0.72rem', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                @{activeGroup.user.username} • {timeAgo(currentStory.createdAt)}
              </div>
            </div>
          </div>

          {(isOwner || isAdmin) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePause();
                setDeleteConfirmOpen(true);
              }}
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: 'none',
                color: '#f85149',
                padding: '6px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Delete this story"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>

        {/* Story Media */}
        <div
          style={{
            flex: 1,
            width: '100%',
            height: '100%',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000000',
          }}
        >
          <img
            src={currentStory.mediaUrl}
            alt="Story content"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          />

          {/* Interactive Tap Zones */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              handlePrevStory();
            }}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              width: '35%',
              cursor: 'pointer',
              zIndex: 10000,
            }}
          />
          <div
            onClick={(e) => {
              e.stopPropagation();
              handleNextStory();
            }}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              right: 0,
              width: '65%',
              cursor: 'pointer',
              zIndex: 10000,
            }}
          />
        </div>

        {/* Story Caption Overlay */}
        {currentStory.caption && (
          <div
            style={{
              position: 'absolute',
              bottom: '1.25rem',
              left: '1rem',
              right: '1rem',
              padding: '0.85rem 1rem',
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(8px)',
              borderRadius: '10px',
              color: '#ffffff',
              fontSize: '0.88rem',
              textAlign: 'center',
              lineHeight: 1.4,
              zIndex: 10001,
            }}
          >
            {currentStory.caption}
          </div>
        )}
      </div>

      {/* Side Navigation Arrows for Desktop */}
      {currentUserIdx > 0 || currentStoryIdx > 0 ? (
        <button
          type="button"
          onClick={handlePrevStory}
          style={{
            position: 'absolute',
            left: '2rem',
            background: 'rgba(255, 255, 255, 0.12)',
            border: 'none',
            color: '#ffffff',
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
        >
          <ChevronLeft size={26} />
        </button>
      ) : null}

      {currentUserIdx < trayUsers.length - 1 || currentStoryIdx < stories.length - 1 ? (
        <button
          type="button"
          onClick={handleNextStory}
          style={{
            position: 'absolute',
            right: '2rem',
            background: 'rgba(255, 255, 255, 0.12)',
            border: 'none',
            color: '#ffffff',
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
        >
          <ChevronRight size={26} />
        </button>
      ) : null}

      {/* Themed Confirm Modal for deletion */}
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        title="Delete Story?"
        message="Are you sure you want to remove this story? This cannot be undone."
        confirmText="Delete"
        confirmVariant="danger"
        loading={deleting}
        onConfirm={handleDeleteStory}
        onClose={() => {
          setDeleteConfirmOpen(false);
          handleResume();
        }}
      />
    </div>
  );
};
