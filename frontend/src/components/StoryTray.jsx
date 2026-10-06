import { useState, useEffect, useCallback } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { storyAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Avatar } from './Avatar';
import { CreateStoryModal } from './CreateStoryModal';
import { StoryViewerModal } from './StoryViewerModal';

export const StoryTray = () => {
  const { user: currentUser } = useAuth();
  const [trayUsers, setTrayUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [viewerModalOpen, setViewerModalOpen] = useState(false);
  const [selectedUserIndex, setSelectedUserIndex] = useState(0);

  const fetchStories = useCallback(async () => {
    if (!currentUser) return;
    try {
      setLoading(true);
      const data = await storyAPI.getFeed();
      setTrayUsers(data.tray || []);
    } catch (err) {
      // Fail silently for background status tray
      setTrayUsers([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  const myGroup = trayUsers.find((g) => g.isOwner);
  const otherGroups = trayUsers.filter((g) => !g.isOwner);

  const handleOpenMyStories = () => {
    if (myGroup && myGroup.stories?.length > 0) {
      const idx = trayUsers.findIndex((g) => g.isOwner);
      setSelectedUserIndex(idx >= 0 ? idx : 0);
      setViewerModalOpen(true);
    } else {
      setCreateModalOpen(true);
    }
  };

  const handleOpenUserStories = (userGroup) => {
    const idx = trayUsers.findIndex((g) => g.user.id === userGroup.user.id);
    setSelectedUserIndex(idx >= 0 ? idx : 0);
    setViewerModalOpen(true);
  };

  const handleStoryCreated = (newStory) => {
    fetchStories();
  };

  const handleStoryDeleted = () => {
    fetchStories();
  };

  return (
    <>
      <div
        className="card"
        style={{
          marginBottom: '1.25rem',
          padding: '0.9rem 1rem',
          backgroundColor: '#161b22',
          border: '1px solid #30363d',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.1rem',
            overflowX: 'auto',
            paddingBottom: '0.25rem',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
          className="stories-scroll-container"
        >
          {/* Current User: "Your Story" */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.4rem',
              cursor: 'pointer',
              flexShrink: 0,
              width: '68px',
            }}
            onClick={handleOpenMyStories}
          >
            <div
              style={{
                position: 'relative',
                width: '58px',
                height: '58px',
                borderRadius: '50%',
                padding: '2.5px',
                background:
                  myGroup?.stories?.length > 0
                    ? 'linear-gradient(45deg, #f778ba, #8957e5, #58a6ff)'
                    : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  backgroundColor: '#161b22',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                <Avatar src={currentUser?.profilePicture} size={52} />
              </div>

              {/* Plus Badge to Add Story */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCreateModalOpen(true);
                }}
                style={{
                  position: 'absolute',
                  bottom: '-2px',
                  right: '-2px',
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  backgroundColor: '#8957e5',
                  border: '2px solid #161b22',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                }}
                title="Add to story"
              >
                <Plus size={14} strokeWidth={3} />
              </button>
            </div>

            <span
              style={{
                fontSize: '0.72rem',
                color: 'var(--text-secondary)',
                fontWeight: 500,
                textAlign: 'center',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                width: '100%',
              }}
            >
              Your Story
            </span>
          </div>

          {/* Followed & Active Users Stories */}
          {otherGroups.map((group) => {
            const hasUnseen = group.hasUnseen;

            return (
              <div
                key={group.user.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer',
                  flexShrink: 0,
                  width: '68px',
                }}
                onClick={() => handleOpenUserStories(group)}
              >
                <div
                  style={{
                    width: '58px',
                    height: '58px',
                    borderRadius: '50%',
                    padding: '2.5px',
                    background: hasUnseen
                      ? 'linear-gradient(45deg, #f778ba, #8957e5, #58a6ff)'
                      : '#30363d',
                    boxShadow: hasUnseen
                      ? '0 0 10px rgba(137, 87, 229, 0.45)'
                      : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'transform 0.2s',
                  }}
                  className="story-avatar-ring"
                >
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      backgroundColor: '#161b22',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    <Avatar src={group.user.profilePicture} size={50} />
                  </div>
                </div>

                <span
                  style={{
                    fontSize: '0.72rem',
                    color: hasUnseen ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontWeight: hasUnseen ? 600 : 400,
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    width: '100%',
                  }}
                >
                  {group.user.username || group.user.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Story Creator Modal */}
      <CreateStoryModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onStoryCreated={handleStoryCreated}
      />

      {/* Story Viewer Modal */}
      <StoryViewerModal
        isOpen={viewerModalOpen}
        trayUsers={trayUsers}
        initialUserIndex={selectedUserIndex}
        onClose={() => {
          setViewerModalOpen(false);
          fetchStories(); // refresh seen states
        }}
        onStoryDeleted={handleStoryDeleted}
      />
    </>
  );
};
