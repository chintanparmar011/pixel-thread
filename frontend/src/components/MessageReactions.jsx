import { useState, useRef, useEffect } from 'react';
import { SmilePlus } from 'lucide-react';

const EMOJI_OPTIONS = ['❤️', '👍', '🔥', '😂', '😮', '👏'];

export const MessageReactions = ({
  reactions = [],
  currentUserId,
  onReact,
  isOutgoing = false,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const pickerRef = useRef(null);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowPicker(false);
      }
    };
    if (showPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPicker]);

  // Aggregate reactions by emoji
  const groupedReactions = reactions.reduce((acc, r) => {
    const emoji = r.emoji;
    if (!acc[emoji]) {
      acc[emoji] = {
        count: 0,
        users: [],
        hasReacted: false,
      };
    }
    acc[emoji].count += 1;
    const uid = r.user?._id || r.user;
    if (uid) acc[emoji].users.push(r.user);
    if (uid && uid.toString() === currentUserId?.toString()) {
      acc[emoji].hasReacted = true;
    }
    return acc;
  }, {});

  const handleSelectEmoji = (emoji) => {
    setShowPicker(false);
    onReact(emoji);
  };

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        flexWrap: 'wrap',
        marginTop: '3px',
      }}
    >
      {/* Existing Reaction Badges */}
      {Object.entries(groupedReactions).map(([emoji, data]) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onReact(emoji)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            backgroundColor: data.hasReacted
              ? 'rgba(137, 87, 229, 0.25)'
              : 'rgba(255, 255, 255, 0.08)',
            border: `1px solid ${data.hasReacted ? '#8957e5' : 'rgba(255, 255, 255, 0.15)'}`,
            borderRadius: '12px',
            padding: '1px 6px',
            fontSize: '0.74rem',
            cursor: 'pointer',
            color: 'var(--text-primary)',
            transition: 'transform 0.1s, background-color 0.2s',
          }}
          title={data.hasReacted ? 'Remove reaction' : 'React with ' + emoji}
        >
          <span>{emoji}</span>
          <span style={{ fontSize: '0.68rem', fontWeight: 600 }}>{data.count}</span>
        </button>
      ))}

      {/* Add Reaction Button */}
      <button
        type="button"
        onClick={() => setShowPicker((p) => !p)}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          padding: '2px 4px',
          borderRadius: '50%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.7,
          transition: 'opacity 0.2s',
        }}
        className="add-reaction-btn"
        title="Add reaction"
      >
        <SmilePlus size={14} />
      </button>

      {/* Quick Emoji Picker Popover */}
      {showPicker && (
        <div
          ref={pickerRef}
          style={{
            position: 'absolute',
            bottom: '100%',
            left: isOutgoing ? 'auto' : 0,
            right: isOutgoing ? 0 : 'auto',
            marginBottom: '6px',
            backgroundColor: '#161b22',
            border: '1px solid #30363d',
            borderRadius: '24px',
            padding: '4px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
            zIndex: 100,
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          {EMOJI_OPTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleSelectEmoji(emoji)}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '1.2rem',
                cursor: 'pointer',
                padding: '2px 4px',
                borderRadius: '50%',
                transition: 'transform 0.12s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.25)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
