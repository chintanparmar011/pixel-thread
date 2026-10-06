import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { messageAPI, userAPI, socialAPI, groupAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useNotifications } from '../context/NotificationContext';
import { 
  Send, 
  Loader2, 
  MessageSquare, 
  Search, 
  X, 
  Users, 
  Plus, 
  Phone, 
  Video, 
  Settings, 
  Shield, 
  Check, 
  UserCheck,
  ArrowLeft,
  Image as ImageIcon,
  Lock,
  Reply
} from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { useCall } from '../context/CallContext';
import { timeAgo } from '../utils/timeAgo';
import { AudioMessagePlayer } from '../components/AudioMessagePlayer';
import { VoiceRecorder } from '../components/VoiceRecorder';
import { MessageReactions } from '../components/MessageReactions';

export const ChatPage = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { socket, isUserOnline } = useSocket();
  const { showToast } = useNotifications();
  const { startCall } = useCall();
  const [searchParams] = useSearchParams();
  const targetUserIdFromUrl = searchParams.get('userId');

  const [activeTab, setActiveTab] = useState('direct'); // 'direct' or 'groups'
  const [conversations, setConversations] = useState([]);
  const [groups, setGroups] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Active chat target: either a partner user or a group
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  // Group Modals
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupType, setNewGroupType] = useState('standard');
  const [newGroupIcon, setNewGroupIcon] = useState(null);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Group Edit State
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupIcon, setEditGroupIcon] = useState(null);
  const [updatingGroup, setUpdatingGroup] = useState(false);

  // Reply State
  const [replyingTo, setReplyingTo] = useState(null);

  // Chat Media & Lightbox State
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const editFileInputRef = useRef(null);
  const chatImageInputRef = useRef(null);
  const chatInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Fetch direct conversations and user groups
  const loadChatData = async () => {
    try {
      setLoadingList(true);
      const [convosData, groupsData] = await Promise.all([
        messageAPI.getConversations(),
        groupAPI.getUserGroups(),
      ]);

      const convos = convosData.conversations || [];
      const userGroups = groupsData.groups || [];

      setConversations(convos);
      setGroups(userGroups);

      if (targetUserIdFromUrl) {
        const existing = convos.find((c) => c.partner?.id === targetUserIdFromUrl);
        if (existing) {
          setActiveChat({ isGroup: false, ...existing.partner });
        } else {
          try {
            const historyData = await messageAPI.getChatHistory(targetUserIdFromUrl);
            if (historyData.partner) {
              setActiveChat({ isGroup: false, ...historyData.partner });
            }
          } catch (e) {
            console.error('Failed to load target chat user:', e.message);
          }
        }
      } else if (!activeChat && convos.length > 0) {
        setActiveChat({ isGroup: false, ...convos[0].partner });
      }
    } catch (err) {
      console.error('Failed to load chat data:', err.message);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadChatData();
  }, [targetUserIdFromUrl]);

  // Load followers/following contacts
  useEffect(() => {
    if (!currentUser?.id) return;
    const loadContacts = async () => {
      try {
        const [followersRes, followingRes] = await Promise.all([
          socialAPI.getFollowers(currentUser.id),
          socialAPI.getFollowing(currentUser.id),
        ]);
        const combined = [...(followersRes.followers || []), ...(followingRes.following || [])];
        const map = new Map();
        combined.forEach((u) => {
          const uid = u._id || u.id;
          if (uid && uid !== currentUser.id && !map.has(uid)) {
            map.set(uid, {
              id: uid,
              _id: uid,
              name: u.name,
              username: u.username,
              profilePicture: u.profilePicture,
            });
          }
        });
        setContacts(Array.from(map.values()));
      } catch (err) {
        console.error('Failed to load contacts for chat:', err.message);
      }
    };
    loadContacts();
  }, [currentUser?.id]);

  // Load active chat messages
  useEffect(() => {
    if (!activeChat) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      try {
        setLoadingChat(true);
        const targetId = activeChat._id || activeChat.id;
        if (!targetId) return;

        if (activeChat.isGroup) {
          const data = await groupAPI.getGroupMessages(targetId);
          setMessages(data.messages || []);
        } else {
          const data = await messageAPI.getChatHistory(targetId);
          setMessages(data.messages || []);
        }
      } catch (err) {
        console.error('Failed to load messages:', err.message);
      } finally {
        setLoadingChat(false);
      }
    };

    fetchMessages();
    setIsTyping(false);
    setReplyingTo(null);
  }, [activeChat?._id, activeChat?.id, activeChat?.isGroup]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Direct message received
    const handleReceiveMessage = (msg) => {
      if (!activeChat?.isGroup) {
        const activePartnerId = activeChat?._id || activeChat?.id;
        const senderId = msg.senderId?._id || msg.senderId;
        const receiverId = msg.receiverId?._id || msg.receiverId;

        if (senderId === activePartnerId || receiverId === activePartnerId) {
          setMessages((prev) => [...prev, msg]);
        }
      }

      setConversations((prev) => {
        const partner = msg.senderId?._id === currentUser.id ? msg.receiverId : msg.senderId;
        const partnerId = partner?._id || partner;
        const filtered = prev.filter((c) => c.partner?.id !== partnerId && c.partner?._id !== partnerId);
        return [{ partner, lastMessage: msg }, ...filtered];
      });
    };

    // Group message received
    const handleReceiveGroupMessage = ({ groupId, message }) => {
      const activeId = (activeChat?._id || activeChat?.id)?.toString();
      if (activeChat?.isGroup && activeId === groupId?.toString()) {
        setMessages((prev) => [...prev, message]);
      }

      setGroups((prev) =>
        prev.map((g) => {
          const gId = (g._id || g.id)?.toString();
          return gId === groupId?.toString() ? { ...g, lastMessage: message } : g;
        })
      );
    };

    // New group created
    const handleNewGroup = (newGroup) => {
      setGroups((prev) => [newGroup, ...prev]);
    };

    // Group updated
    const handleGroupUpdated = (updatedGroup) => {
      const updatedId = (updatedGroup._id || updatedGroup.id)?.toString();
      setGroups((prev) =>
        prev.map((g) => {
          const gId = (g._id || g.id)?.toString();
          return gId === updatedId ? updatedGroup : g;
        })
      );
      const activeId = (activeChat?._id || activeChat?.id)?.toString();
      if (activeChat?.isGroup && activeId === updatedId) {
        setActiveChat({ isGroup: true, ...updatedGroup });
      }
    };

    const handleUserTyping = ({ userId }) => {
      if (!activeChat?.isGroup && (activeChat?._id === userId || activeChat?.id === userId)) {
        setIsTyping(true);
      }
    };

    const handleUserStopTyping = ({ userId }) => {
      if (!activeChat?.isGroup && (activeChat?._id === userId || activeChat?.id === userId)) {
        setIsTyping(false);
      }
    };

    const handleReactionUpdated = ({ messageId, reactions }) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, reactions } : m))
      );
    };

    socket.on('receiveMessage', handleReceiveMessage);
    socket.on('receiveGroupMessage', handleReceiveGroupMessage);
    socket.on('newGroup', handleNewGroup);
    socket.on('groupUpdated', handleGroupUpdated);
    socket.on('userTyping', handleUserTyping);
    socket.on('userStopTyping', handleUserStopTyping);
    socket.on('messageReactionUpdated', handleReactionUpdated);

    return () => {
      socket.off('receiveMessage', handleReceiveMessage);
      socket.off('receiveGroupMessage', handleReceiveGroupMessage);
      socket.off('newGroup', handleNewGroup);
      socket.off('groupUpdated', handleGroupUpdated);
      socket.off('userTyping', handleUserTyping);
      socket.off('userStopTyping', handleUserStopTyping);
      socket.off('messageReactionUpdated', handleReactionUpdated);
    };
  }, [socket, activeChat, currentUser.id]);

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        showToast('Please select a valid image file', 'error');
        return;
      }
      setSelectedImageFile(file);
      setSelectedImagePreview(URL.createObjectURL(file));
    }
  };

  const handleClearImage = () => {
    setSelectedImageFile(null);
    setSelectedImagePreview(null);
    if (chatImageInputRef.current) chatImageInputRef.current.value = '';
  };

  const handleSendVoiceNote = async (audioBlob, duration) => {
    if (!socket || !activeChat) return;
    try {
      setUploadingMedia(true);
      const formData = new FormData();
      formData.append('file', audioBlob, 'voice-memo.webm');
      const data = await messageAPI.uploadMedia(formData);

      if (activeChat.isGroup) {
        const isPrivate = activeChat.groupType === 'broadcast';
        const targetUser = replyingTo?.sender?._id || replyingTo?.sender?.id || null;
        socket.emit('sendGroupMessage', {
          groupId: activeChat._id || activeChat.id,
          text: '',
          mediaUrl: data.url,
          mediaType: 'audio',
          audioDuration: duration,
          isBroadcast: isPrivate ? !targetUser : true,
          targetUserId: isPrivate && isCurrentGroupAdmin ? targetUser : null,
        });
        setReplyingTo(null);
      } else {
        const partnerId = activeChat._id || activeChat.id;
        socket.emit('sendMessage', {
          receiverId: partnerId,
          text: '',
          mediaUrl: data.url,
          mediaType: 'audio',
          audioDuration: duration,
        });
      }
    } catch (err) {
      showToast(err.message || 'Failed to send voice note', 'error');
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleReactMessage = (messageId, emoji) => {
    if (!socket || !socket.connected) {
      messageAPI.reactMessage(messageId, emoji).catch(() => {});
      return;
    }
    socket.emit('reactMessage', { messageId, emoji });
  };

  // Send message handler
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!inputText.trim() && !selectedImageFile) || !socket || !activeChat || uploadingMedia) return;

    let mediaUrl = null;
    let mediaType = null;

    if (selectedImageFile) {
      try {
        setUploadingMedia(true);
        const formData = new FormData();
        formData.append('file', selectedImageFile);
        const data = await messageAPI.uploadMedia(formData);
        mediaUrl = data.url;
        mediaType = 'image';
      } catch (err) {
        showToast(err.message || 'Failed to upload photo', 'error');
        setUploadingMedia(false);
        return;
      } finally {
        setUploadingMedia(false);
      }
    }

    if (activeChat.isGroup) {
      // Group message
      const isPrivate = activeChat.groupType === 'broadcast';
      const targetUser = replyingTo?.sender?._id || replyingTo?.sender?.id || null;
      socket.emit('sendGroupMessage', {
        groupId: activeChat._id || activeChat.id,
        text: inputText.trim(),
        mediaUrl,
        mediaType,
        isBroadcast: isPrivate ? !targetUser : true,
        targetUserId: isPrivate && isCurrentGroupAdmin ? targetUser : null,
      });
    } else {
      // 1-on-1 message
      const partnerId = activeChat._id || activeChat.id;
      socket.emit('sendMessage', {
        receiverId: partnerId,
        text: inputText.trim(),
        mediaUrl,
        mediaType,
      });
      socket.emit('stopTyping', { receiverId: partnerId });
    }

    setInputText('');
    setReplyingTo(null);
    handleClearImage();
  };

  const handleInputChange = (e) => {
    setInputText(e.target.value);
    if (!socket || !activeChat || activeChat.isGroup) return;

    const partnerId = activeChat._id || activeChat.id;
    socket.emit('typing', { receiverId: partnerId });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stopTyping', { receiverId: partnerId });
    }, 1500);
  };

  // Create Group Form
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    try {
      setCreatingGroup(true);
      const formData = new FormData();
      formData.append('name', newGroupName.trim());
      formData.append('groupType', newGroupType);
      formData.append('participants', JSON.stringify(selectedMembers));
      if (newGroupIcon) {
        formData.append('icon', newGroupIcon);
      }

      const res = await groupAPI.createGroup(formData);
      const createdGroup = res.group || res.data?.group || res;
      setGroups((prev) => [createdGroup, ...prev]);
      setActiveChat({ isGroup: true, ...createdGroup });
      setActiveTab('groups');
      setShowCreateGroup(false);
      setNewGroupName('');
      setNewGroupIcon(null);
      setSelectedMembers([]);
      showToast('Group created successfully!', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Failed to create group', 'error');
    } finally {
      setCreatingGroup(false);
    }
  };

  // Update Group Form
  const handleUpdateGroup = async (e) => {
    e.preventDefault();
    if (!activeChat?.isGroup) return;

    try {
      setUpdatingGroup(true);
      const formData = new FormData();
      if (editGroupName.trim()) {
        formData.append('name', editGroupName.trim());
      }
      if (editGroupIcon) {
        formData.append('icon', editGroupIcon);
      }

      const targetGroupId = activeChat._id || activeChat.id;
      const res = await groupAPI.updateGroup(targetGroupId, formData);
      const updatedGroup = res.group || res.data?.group || res;
      setActiveChat({ isGroup: true, ...updatedGroup });
      const updatedId = (updatedGroup._id || updatedGroup.id)?.toString();
      setGroups((prev) => prev.map((g) => {
        const gId = (g._id || g.id)?.toString();
        return gId === updatedId ? updatedGroup : g;
      }));
      setShowGroupSettings(false);
      showToast('Group updated successfully!', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Failed to update group', 'error');
    } finally {
      setUpdatingGroup(false);
    }
  };

  const currentUserId = (currentUser?.id || currentUser?._id)?.toString();
  const adminId = (activeChat?.admin?._id || activeChat?.admin?.id || activeChat?.admin)?.toString();
  const isCurrentGroupAdmin = Boolean(
    activeChat?.isGroup && adminId && currentUserId && adminId === currentUserId
  );

  // Filter lists based on search
  const filteredConvos = conversations.filter((c) => {
    const name = c.partner?.name || '';
    const username = c.partner?.username || '';
    return (
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      username.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="chat-container">
      {/* Sidebar */}
      <div className={`chat-sidebar ${activeChat ? 'mobile-hidden' : ''}`}>
        {/* Header Tabs & Actions */}
        <div className="chat-sidebar-header">
          <div className="chat-sidebar-title-row">
            <h2 className="chat-sidebar-title">
              <MessageSquare size={19} color="#a371f7" /> Messages
            </h2>
            <button
              onClick={() => setShowCreateGroup(true)}
              className="btn btn-secondary btn-sm"
              style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem', borderRadius: '9999px' }}
              title="Create New Group"
            >
              <Plus size={14} /> Group
            </button>
          </div>

          {/* Segmented Control Pill Switch */}
          <div className="chat-segmented-control">
            <button
              onClick={() => setActiveTab('direct')}
              className={`chat-segment-btn ${activeTab === 'direct' ? 'active' : ''}`}
            >
              Direct ({conversations.length})
            </button>
            <button
              onClick={() => setActiveTab('groups')}
              className={`chat-segment-btn ${activeTab === 'groups' ? 'active' : ''}`}
            >
              Groups ({groups.length})
            </button>
          </div>

          {/* Search Box */}
          <div className="chat-search-wrap">
            <Search size={15} style={{ position: 'absolute', left: '12px', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
            <input
              type="text"
              className="chat-search-input"
              placeholder={activeTab === 'direct' ? 'Search conversations...' : 'Search groups...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '10px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* List Content */}
        <div className="conversation-list">
          {loadingList ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              <Loader2 size={24} className="spin" style={{ margin: '0 auto 0.5rem' }} />
              <p style={{ fontSize: '0.82rem' }}>Loading conversations...</p>
            </div>
          ) : activeTab === 'direct' ? (
            /* Direct Chats List */
            filteredConvos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                <p style={{ margin: '0 0 0.5rem 0' }}>No active chats yet.</p>
                {contacts.length > 0 && (
                  <p style={{ fontSize: '0.8rem', color: '#8957e5' }}>Select a follower to start chatting!</p>
                )}
              </div>
            ) : (
              filteredConvos.map((convo) => {
                const partner = convo.partner || {};
                const partnerId = partner._id || partner.id;
                const isActive = !activeChat?.isGroup && (activeChat?._id === partnerId || activeChat?.id === partnerId);
                const online = isUserOnline(partnerId);

                return (
                  <div
                    key={partnerId}
                    className={`conversation-item ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveChat({ isGroup: false, ...partner })}
                  >
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <Avatar src={partner.profilePicture} size={42} />
                      {online && <div className="online-indicator" />}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.2rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {partner.name || partner.username}
                        </span>
                        {convo.lastMessage?.createdAt && (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', flexShrink: 0, marginLeft: '0.4rem' }}>
                            {timeAgo(convo.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {convo.lastMessage?.text || 'No messages yet'}
                      </p>
                    </div>
                  </div>
                );
              })
            )
          ) : (
            /* Groups List */
            filteredGroups.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                <Users size={32} style={{ opacity: 0.4, margin: '0 auto 0.6rem' }} />
                <p style={{ margin: 0 }}>No groups joined yet.</p>
                <button
                  onClick={() => setShowCreateGroup(true)}
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: '0.8rem', borderRadius: '9999px' }}
                >
                  Create First Group
                </button>
              </div>
            ) : (
              filteredGroups.map((g) => {
                const gId = g._id || g.id;
                const activeId = activeChat?._id || activeChat?.id;
                const isActive = activeChat?.isGroup && activeId?.toString() === gId?.toString();
                const isPrivate = g.groupType === 'broadcast';

                return (
                  <div
                    key={gId}
                    className={`conversation-item ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveChat({ isGroup: true, ...g })}
                  >
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <Avatar src={g.icon} size={42} />
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '-2px',
                          right: '-2px',
                          backgroundColor: '#8957e5',
                          borderRadius: '50%',
                          width: '18px',
                          height: '18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          border: '2px solid #161b22',
                        }}
                      >
                        {isPrivate ? <Lock size={10} /> : <Users size={10} />}
                      </div>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {g.name}
                        </span>
                        <span className="group-type-tag standard">
                          {isPrivate ? 'Private' : 'Public'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                          {g.lastMessage?.text || (isPrivate ? `@${g.admin?.username || 'admin'}` : `${g.participants?.length || 0} members`)}
                        </p>
                        {g.lastMessage?.createdAt && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', flexShrink: 0, marginLeft: '0.4rem' }}>
                            {timeAgo(g.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`chat-main ${!activeChat ? 'mobile-hidden' : ''}`}>
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="chat-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                <button
                  onClick={() => setActiveChat(null)}
                  className="mobile-back-btn"
                  title="Back to conversations"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    padding: '0.2rem',
                    display: 'none',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ArrowLeft size={20} />
                </button>

                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <Avatar
                    src={activeChat.isGroup ? activeChat.icon : activeChat.profilePicture}
                    size={42}
                  />
                  {!activeChat.isGroup && isUserOnline(activeChat._id || activeChat.id) && (
                    <div className="online-indicator" />
                  )}
                </div>

                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <h3 
                      onClick={() => !activeChat.isGroup && navigate(`/profile/${activeChat.username || activeChat._id || activeChat.id}`)}
                      style={{ 
                        margin: 0, 
                        fontSize: '1rem', 
                        fontWeight: 700, 
                        color: 'var(--text-primary)', 
                        whiteSpace: 'nowrap', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis',
                        cursor: activeChat.isGroup ? 'default' : 'pointer'
                      }}
                    >
                      {activeChat.isGroup ? activeChat.name : activeChat.name || activeChat.username}
                    </h3>
                    {activeChat.isGroup && (
                      <span className="group-type-tag standard">
                        {activeChat.groupType === 'broadcast' ? 'Private' : 'Public'}
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                    {activeChat.isGroup ? (
                      activeChat.groupType === 'broadcast' ? (
                        <span>
                          Admin:{' '}
                          <span
                            onClick={() => navigate(`/profile/${activeChat.admin?.username || activeChat.admin?._id || activeChat.admin}`)}
                            style={{ color: '#d2a8ff', cursor: 'pointer', fontWeight: 600 }}
                            title="View admin profile"
                          >
                            @{activeChat.admin?.username || 'admin'}
                          </span>
                        </span>
                      ) : (
                        <span>
                          {activeChat.participants?.length || 0} members • Admin:{' '}
                          <span
                            onClick={() => navigate(`/profile/${activeChat.admin?.username || activeChat.admin?._id || activeChat.admin}`)}
                            style={{ color: '#d2a8ff', cursor: 'pointer', fontWeight: 600 }}
                            title="View admin profile"
                          >
                            @{activeChat.admin?.username || 'admin'}
                          </span>
                        </span>
                      )
                    ) : isUserOnline(activeChat._id || activeChat.id) ? (
                      <span style={{ color: '#3fb950', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span className="pulse-dot" /> Active now
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)' }}>Offline</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexShrink: 0 }}>
                {!activeChat.isGroup ? (
                  <>
                    {/* Audio Call */}
                    <button
                      onClick={() => startCall(activeChat, 'audio')}
                      className="call-btn"
                      title="Start Voice Call"
                    >
                      <Phone size={17} />
                    </button>

                    {/* Video Call */}
                    <button
                      onClick={() => startCall(activeChat, 'video')}
                      className="call-btn"
                      title="Start Video Call"
                    >
                      <Video size={17} />
                    </button>
                  </>
                ) : (
                  /* Group Settings Button */
                  <button
                    onClick={() => {
                      setEditGroupName(activeChat.name);
                      setShowGroupSettings(true);
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '0.4rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', borderRadius: '9999px' }}
                    title="Group Settings & Info"
                  >
                    <Settings size={15} /> Info
                  </button>
                )}
              </div>
            </div>

            {/* Messages Thread */}
            <div className="chat-messages">
              {loadingChat ? (
                <div style={{ textAlign: 'center', margin: 'auto', padding: '3rem', color: 'var(--text-secondary)' }}>
                  <Loader2 size={32} className="spin" style={{ margin: '0 auto 0.75rem', color: '#a371f7' }} />
                  <p style={{ fontSize: '0.85rem' }}>Loading conversation history...</p>
                </div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: 'center', margin: 'auto', padding: '3rem', color: 'var(--text-secondary)' }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(137, 87, 229, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1rem',
                    color: '#a371f7'
                  }}>
                    <MessageSquare size={26} />
                  </div>
                  <h4 style={{ color: 'var(--text-primary)', margin: '0 0 0.35rem 0' }}>No messages yet</h4>
                  <p style={{ fontSize: '0.85rem', margin: 0 }}>
                    {activeChat.isGroup
                      ? 'Be the first to send a message to this group!'
                      : `Say hello to @${activeChat.username || activeChat.name}!`}
                  </p>
                </div>
              ) : (
                messages.map((m) => {
                  const senderId = (m.senderId?._id || m.senderId)?.toString();
                  const myId = (currentUser?.id || currentUser?._id)?.toString();
                  const isMine = Boolean(senderId && myId && senderId === myId);
                  const senderObj = m.senderId || {};
                  const adminId = (activeChat.admin?._id || activeChat.admin?.id || activeChat.admin)?.toString();
                  const isAdminSender = Boolean(activeChat.isGroup && adminId && adminId === senderId);

                  return (
                    <div
                      key={m._id}
                      className={`chat-message-row ${isMine ? 'outgoing' : 'incoming'}`}
                    >
                      {activeChat.isGroup && !isMine && (
                        <div 
                          onClick={() => navigate(`/profile/${senderObj.username || senderObj._id || senderId}`)}
                          style={{ cursor: 'pointer', flexShrink: 0, marginBottom: '2px' }}
                          title="View profile"
                        >
                          <Avatar
                            src={senderObj.profilePicture}
                            size={32}
                          />
                        </div>
                      )}

                      <div className={`message-bubble ${isMine ? 'outgoing' : 'incoming'}`}>
                        {/* Target recipient reference in private replies */}
                        {m.targetUserId && (
                          <div style={{ 
                            fontSize: '0.72rem', 
                            color: '#d2a8ff', 
                            marginBottom: '0.3rem', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.3rem', 
                            fontWeight: 600 
                          }}>
                            <Reply size={11} />
                            <span>@{m.targetUserId.username || m.targetUserId.name || 'Member'}</span>
                          </div>
                        )}

                        {/* Group Sender Identity Header */}
                        {activeChat.isGroup && !isMine && (
                          <div style={{ marginBottom: '0.25rem' }}>
                            <span 
                              onClick={() => navigate(`/profile/${senderObj.username || senderObj._id || senderId}`)}
                              style={{ fontSize: '0.78rem', fontWeight: 700, color: '#d2a8ff', cursor: 'pointer' }}
                              title="View profile"
                            >
                              {senderObj.name || senderObj.username || 'Member'}
                            </span>
                          </div>
                        )}

                        {/* Attached Image (if any) */}
                        {m.mediaUrl && m.mediaType === 'image' && (
                          <div style={{ marginBottom: m.text ? '0.45rem' : 0 }}>
                            <img
                              src={m.mediaUrl}
                              alt="Attachment"
                              onClick={() => setLightboxImage(m.mediaUrl)}
                              style={{
                                maxWidth: '100%',
                                maxHeight: '280px',
                                borderRadius: '8px',
                                objectFit: 'cover',
                                cursor: 'pointer',
                                display: 'block',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                              }}
                            />
                          </div>
                        )}

                        {/* Attached Voice Note (if any) */}
                        {m.mediaUrl && m.mediaType === 'audio' && (
                          <div style={{ marginBottom: m.text ? '0.4rem' : 0 }}>
                            <AudioMessagePlayer
                              src={m.mediaUrl}
                              duration={m.audioDuration}
                              isOutgoing={isMine}
                            />
                          </div>
                        )}

                        {/* Message Text Content */}
                        {m.text && (
                          <div style={{ wordBreak: 'break-word', fontSize: '0.92rem', lineHeight: 1.5 }}>
                            {m.text}
                          </div>
                        )}

                        {/* Timestamp, Delivery Status & Reply Trigger */}
                        <div style={{ 
                          fontSize: '0.68rem', 
                          opacity: 0.8, 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'flex-end', 
                          gap: '0.25rem', 
                          marginTop: '0.35rem' 
                        }}>
                          <span>
                            {new Date(m.createdAt || Date.now()).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          {isMine && <Check size={12} />}
                          <button
                            type="button"
                            onClick={() => {
                              setReplyingTo({
                                messageId: m._id,
                                sender: senderObj,
                                text: m.text || (m.mediaType === 'audio' ? 'Voice note' : 'Photo'),
                              });
                              chatInputRef.current?.focus();
                            }}
                            className="message-reply-btn"
                            title={`Reply to @${senderObj.username || senderObj.name || 'user'}`}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'inherit',
                              cursor: 'pointer',
                              padding: '2px 4px',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              marginLeft: '0.15rem',
                            }}
                          >
                            <Reply size={12} />
                          </button>
                        </div>
                      </div>

                      {/* Message Emoji Reactions */}
                      <MessageReactions
                        reactions={m.reactions || []}
                        currentUserId={currentUser?.id}
                        onReact={(emoji) => handleReactMessage(m._id, emoji)}
                        isOutgoing={isMine}
                      />
                    </div>
                  );
                })
              )}

              {/* Typing Indicator */}
              {isTyping && (
                <div className="typing-bubble">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span style={{ marginLeft: '4px' }}>
                    {activeChat.name || activeChat.username} is typing...
                  </span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar Area */}
            <div>
              {/* Replying Preview Bar */}
              {replyingTo && (
                <div style={{
                  padding: '0.45rem 1rem',
                  backgroundColor: 'rgba(22, 27, 34, 0.95)',
                  borderTop: '1px solid rgba(240, 246, 252, 0.1)',
                  borderLeft: '3px solid #8957e5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                    <Reply size={14} color="#a371f7" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#d2a8ff' }}>
                        Replying to @{replyingTo.sender?.username || replyingTo.sender?.name || 'Member'}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {replyingTo.text}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyingTo(null)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Cancel reply"
                  >
                    <X size={15} />
                  </button>
                </div>
              )}

              {/* Selected Image Preview Attachment Chip */}
              {selectedImagePreview && (
                <div style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: 'rgba(22, 27, 34, 0.95)',
                  borderTop: '1px solid rgba(240, 246, 252, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}>
                  <div style={{ position: 'relative' }}>
                    <img
                      src={selectedImagePreview}
                      alt="Selected attachment"
                      style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }}
                    />
                    <button
                      type="button"
                      onClick={handleClearImage}
                      style={{
                        position: 'absolute',
                        top: '-4px',
                        right: '-4px',
                        backgroundColor: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '50%',
                        width: '18px',
                        height: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <span>{selectedImageFile?.name}</span>
                  </div>
                </div>
              )}

              <form onSubmit={handleSendMessage} className="chat-input-bar">
                {/* Hidden File Input for Image Attachments */}
                <input
                  type="file"
                  ref={chatImageInputRef}
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleImageSelect}
                />

                <button
                  type="button"
                  onClick={() => chatImageInputRef.current?.click()}
                  disabled={uploadingMedia}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: uploadingMedia ? 'not-allowed' : 'pointer',
                    padding: '8px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'color 0.2s',
                  }}
                  className="mic-action-btn"
                  title="Attach photo"
                >
                  <ImageIcon size={18} />
                </button>

                {/* Voice Note Recorder Button */}
                <VoiceRecorder onSendVoice={handleSendVoiceNote} disabled={uploadingMedia} />

                <input
                  ref={chatInputRef}
                  type="text"
                  className="text-input"
                  placeholder={
                    replyingTo 
                      ? `Reply to @${replyingTo.sender?.username || 'user'}...` 
                      : (activeChat.isGroup ? 'Message group...' : 'Message...')
                  }
                  value={inputText}
                  onChange={handleInputChange}
                  style={{
                    flex: 1,
                    borderRadius: '9999px',
                    backgroundColor: 'rgba(13, 17, 23, 0.85)',
                    border: '1px solid rgba(240, 246, 252, 0.14)',
                    padding: '0.65rem 1.15rem',
                    height: '42px',
                    fontSize: '0.9rem',
                  }}
                />
                <button
                  type="submit"
                  disabled={(!inputText.trim() && !selectedImageFile) || uploadingMedia}
                  className="btn"
                  style={{
                    borderRadius: '50%',
                    width: '42px',
                    height: '42px',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: (inputText.trim() || selectedImageFile) ? 'linear-gradient(135deg, #8957e5, #6f42c1)' : 'rgba(255, 255, 255, 0.05)',
                    color: (inputText.trim() || selectedImageFile) ? '#ffffff' : 'var(--text-secondary)',
                    cursor: (inputText.trim() || selectedImageFile) ? 'pointer' : 'not-allowed',
                    boxShadow: (inputText.trim() || selectedImageFile) ? '0 2px 12px rgba(137, 87, 229, 0.45)' : 'none',
                    transition: 'all 0.2s ease',
                    flexShrink: 0,
                  }}
                  title="Send message"
                >
                  {uploadingMedia ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', margin: 'auto', padding: '2rem', maxWidth: '420px', color: 'var(--text-secondary)' }}>
            <div style={{
              width: '76px',
              height: '76px',
              borderRadius: '50%',
              backgroundColor: 'rgba(137, 87, 229, 0.12)',
              border: '1px solid rgba(137, 87, 229, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
              color: '#a371f7',
              boxShadow: '0 0 24px rgba(137, 87, 229, 0.15)',
            }}>
              <MessageSquare size={34} />
            </div>
            <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', fontSize: '1.2rem', fontWeight: 700 }}>
              Your Messages
            </h3>
            <p style={{ fontSize: '0.88rem', lineHeight: 1.5, marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
              Send private messages, make voice and video calls, or start a group chat with friends.
            </p>
            <button
              onClick={() => setShowCreateGroup(true)}
              className="btn btn-sm"
              style={{ borderRadius: '9999px', padding: '0.55rem 1.5rem' }}
            >
              <Plus size={16} /> Create Group
            </button>
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {showCreateGroup && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div className="card" style={{ width: '100%', maxWidth: '480px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <h3 style={{ margin: 0 }}>Create New Group</h3>
              <button onClick={() => setShowCreateGroup(false)} className="btn btn-secondary btn-sm" style={{ padding: '0.3rem' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateGroup}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                  Group Name *
                </label>
                <input
                  type="text"
                  className="text-input"
                  placeholder="e.g. Design Club"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                  Group Icon / Picture
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setNewGroupIcon(e.target.files?.[0] || null)}
                  className="text-input"
                  style={{ padding: '0.4rem' }}
                />
              </div>

              <div style={{ marginBottom: '1.2rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
                  Privacy
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                  <button
                    type="button"
                    onClick={() => setNewGroupType('standard')}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      border: `1px solid ${newGroupType === 'standard' ? '#8957e5' : 'var(--border-color)'}`,
                      cursor: 'pointer',
                      backgroundColor: newGroupType === 'standard' ? 'rgba(137, 87, 229, 0.15)' : 'transparent',
                      color: newGroupType === 'standard' ? '#d2a8ff' : 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      fontWeight: 600,
                      fontSize: '0.88rem',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Users size={16} /> Public Group
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewGroupType('broadcast')}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      border: `1px solid ${newGroupType === 'broadcast' ? '#8957e5' : 'var(--border-color)'}`,
                      cursor: 'pointer',
                      backgroundColor: newGroupType === 'broadcast' ? 'rgba(137, 87, 229, 0.15)' : 'transparent',
                      color: newGroupType === 'broadcast' ? '#d2a8ff' : 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      fontWeight: 600,
                      fontSize: '0.88rem',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Lock size={16} /> Private Group
                  </button>
                </div>
              </div>

              {/* Participant picker */}
              <div style={{ marginBottom: '1.2rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>
                  Add Followers / Contacts ({selectedMembers.length} selected)
                </label>
                <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.4rem' }}>
                  {contacts.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '0.5rem', textAlign: 'center' }}>
                      No followers/following found. You can add them later!
                    </p>
                  ) : (
                    contacts.map((c) => {
                      const isSelected = selectedMembers.includes(c.id);
                      return (
                        <div
                          key={c.id}
                          onClick={() => {
                            setSelectedMembers((prev) =>
                              isSelected ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                            );
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.4rem 0.6rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            backgroundColor: isSelected ? 'var(--bg-hover)' : 'transparent',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <Avatar src={c.profilePicture} size={28} />
                            <span style={{ fontSize: '0.85rem' }}>{c.name} (@{c.username})</span>
                          </div>
                          {isSelected && <Check size={16} color="var(--accent-color)" />}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateGroup(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newGroupName.trim() || creatingGroup}
                  className="btn btn-sm"
                >
                  {creatingGroup ? <Loader2 size={16} className="spin" /> : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Group Settings / Edit Modal */}
      {showGroupSettings && activeChat?.isGroup && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <div className="card" style={{ width: '100%', maxWidth: '440px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <h3 style={{ margin: 0 }}>Group Details</h3>
              <button onClick={() => setShowGroupSettings(false)} className="btn btn-secondary btn-sm" style={{ padding: '0.3rem' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ textAlign: 'center', marginBottom: '1.2rem' }}>
              <Avatar src={activeChat.icon} size={64} style={{ margin: '0 auto 0.6rem' }} />
              <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{activeChat.name}</div>
              <span className="group-type-tag standard" style={{ marginTop: '0.3rem', display: 'inline-block' }}>
                {activeChat.groupType === 'broadcast' ? 'Private Group' : 'Public Group'}
              </span>
            </div>

            {/* Admin Section - Clickable Profile */}
            <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Admin
              </label>
              <div
                onClick={() => {
                  setShowGroupSettings(false);
                  navigate(`/profile/${activeChat.admin?.username || activeChat.admin?._id || activeChat.admin}`);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.55rem 0.75rem',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer',
                }}
                title="View admin profile"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <Avatar src={activeChat.admin?.profilePicture} size={32} />
                  <div>
                    <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {activeChat.admin?.name || activeChat.admin?.username || 'Admin'}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                      @{activeChat.admin?.username || 'admin'}
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: '0.72rem', color: '#a371f7', fontWeight: 600 }}>Profile →</span>
              </div>
            </div>

            {/* Members Section (Only for Public Groups) - Clickable Profiles */}
            {activeChat.groupType !== 'broadcast' && (
              <div style={{ marginBottom: '1.2rem', textAlign: 'left' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Members ({activeChat.participants?.length || 0})
                </label>
                <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.3rem' }}>
                  {(!activeChat.participants || activeChat.participants.length === 0) ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '0.5rem', textAlign: 'center' }}>
                      No members listed
                    </p>
                  ) : (
                    activeChat.participants.map((m) => {
                      const memberId = m._id || m.id || m;
                      return (
                        <div
                          key={memberId}
                          onClick={() => {
                            setShowGroupSettings(false);
                            navigate(`/profile/${m.username || memberId}`);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.45rem 0.6rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                          }}
                          title="View profile"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <Avatar src={m.profilePicture} size={28} />
                            <div>
                              <div style={{ fontSize: '0.84rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                                {m.name || m.username || 'Member'}
                              </div>
                              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                                @{m.username || 'user'}
                              </div>
                            </div>
                          </div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Profile →</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Edit Group Form (if authorized) */}
            {(activeChat.groupType !== 'broadcast' || isCurrentGroupAdmin) ? (
              <form onSubmit={handleUpdateGroup}>
                <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                    Group Name
                  </label>
                  <input
                    type="text"
                    className="text-input"
                    value={editGroupName}
                    onChange={(e) => setEditGroupName(e.target.value)}
                    required
                  />
                </div>

                <div style={{ marginBottom: '1.2rem', textAlign: 'left' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                    Group Icon
                  </label>
                  <input
                    ref={editFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => setEditGroupIcon(e.target.files?.[0] || null)}
                    className="text-input"
                    style={{ padding: '0.4rem' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setShowGroupSettings(false)}
                    className="btn btn-secondary btn-sm"
                  >
                    Close
                  </button>
                  <button type="submit" disabled={updatingGroup} className="btn btn-sm">
                    {updatingGroup ? <Loader2 size={16} className="spin" /> : 'Save Changes'}
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowGroupSettings(false)}
                  className="btn btn-secondary btn-sm"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Image Attachment Lightbox */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.92)',
            zIndex: 10005,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          <button
            type="button"
            onClick={() => setLightboxImage(null)}
            style={{
              position: 'absolute',
              top: '1.25rem',
              right: '1.25rem',
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              color: '#ffffff',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={20} />
          </button>
          <img
            src={lightboxImage}
            alt="Expanded Attachment"
            style={{
              maxWidth: '92vw',
              maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: '8px',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};
