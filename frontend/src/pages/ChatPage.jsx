import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { messageAPI, userAPI, socialAPI, groupAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
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
  Radio, 
  Check, 
  UserCheck 
} from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { CallModal } from '../components/CallModal';

export const ChatPage = () => {
  const { user: currentUser } = useAuth();
  const { socket, isUserOnline } = useSocket();
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

  // Broadcast Channel Admin Reply Target
  const [broadcastTargetUser, setBroadcastTargetUser] = useState(null);
  const [isAdminBroadcastMode, setIsAdminBroadcastMode] = useState(true);

  // Audio / Video Calling State
  const [callState, setCallState] = useState(null);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const editFileInputRef = useRef(null);

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
        if (activeChat.isGroup) {
          const data = await groupAPI.getGroupMessages(activeChat._id);
          setMessages(data.messages || []);
        } else {
          const partnerId = activeChat._id || activeChat.id;
          const data = await messageAPI.getChatHistory(partnerId);
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
    setBroadcastTargetUser(null);
    setIsAdminBroadcastMode(true);
  }, [activeChat]);

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
      if (activeChat?.isGroup && activeChat._id === groupId) {
        setMessages((prev) => [...prev, message]);
      }

      setGroups((prev) =>
        prev.map((g) => (g._id === groupId ? { ...g, lastMessage: message } : g))
      );
    };

    // New group created
    const handleNewGroup = (newGroup) => {
      setGroups((prev) => [newGroup, ...prev]);
    };

    // Group updated
    const handleGroupUpdated = (updatedGroup) => {
      setGroups((prev) =>
        prev.map((g) => (g._id === updatedGroup._id ? updatedGroup : g))
      );
      if (activeChat?.isGroup && activeChat._id === updatedGroup._id) {
        setActiveChat({ isGroup: true, ...updatedGroup });
      }
    };

    // Incoming Audio/Video Call
    const handleIncomingCall = (data) => {
      setCallState({
        isOpen: true,
        isIncoming: true,
        incomingSignal: data.signal,
        callType: data.callType || 'video',
        partnerUser: {
          _id: data.from,
          id: data.from,
          name: data.callerName,
          profilePicture: data.callerAvatar,
        },
      });
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

    socket.on('receiveMessage', handleReceiveMessage);
    socket.on('receiveGroupMessage', handleReceiveGroupMessage);
    socket.on('newGroup', handleNewGroup);
    socket.on('groupUpdated', handleGroupUpdated);
    socket.on('incomingCall', handleIncomingCall);
    socket.on('userTyping', handleUserTyping);
    socket.on('userStopTyping', handleUserStopTyping);

    return () => {
      socket.off('receiveMessage', handleReceiveMessage);
      socket.off('receiveGroupMessage', handleReceiveGroupMessage);
      socket.off('newGroup', handleNewGroup);
      socket.off('groupUpdated', handleGroupUpdated);
      socket.off('incomingCall', handleIncomingCall);
      socket.off('userTyping', handleUserTyping);
      socket.off('userStopTyping', handleUserStopTyping);
    };
  }, [socket, activeChat, currentUser.id]);

  // Send message handler
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim() || !socket || !activeChat) return;

    if (activeChat.isGroup) {
      // Group message
      socket.emit('sendGroupMessage', {
        groupId: activeChat._id,
        text: inputText.trim(),
        isBroadcast: activeChat.groupType === 'broadcast' && isAdminBroadcastMode,
        targetUserId: broadcastTargetUser?._id || null,
      });
    } else {
      // 1-on-1 message
      const partnerId = activeChat._id || activeChat.id;
      socket.emit('sendMessage', {
        receiverId: partnerId,
        text: inputText.trim(),
      });
      socket.emit('stopTyping', { receiverId: partnerId });
    }

    setInputText('');
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
      setGroups((prev) => [res.data.group, ...prev]);
      setActiveChat({ isGroup: true, ...res.data.group });
      setActiveTab('groups');
      setShowCreateGroup(false);
      setNewGroupName('');
      setNewGroupIcon(null);
      setSelectedMembers([]);
    } catch (err) {
      alert(err.message || 'Failed to create group');
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

      const res = await groupAPI.updateGroup(activeChat._id, formData);
      setActiveChat({ isGroup: true, ...res.data.group });
      setShowGroupSettings(false);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to update group');
    } finally {
      setUpdatingGroup(false);
    }
  };

  const isCurrentGroupAdmin =
    activeChat?.isGroup &&
    (activeChat.admin?._id === currentUser.id || activeChat.admin === currentUser.id);

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
      <div className="chat-sidebar">
        {/* Header Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              onClick={() => setActiveTab('direct')}
              className={`tab-btn ${activeTab === 'direct' ? 'active' : ''}`}
              style={{ fontSize: '0.82rem', padding: '0.35rem 0.65rem' }}
            >
              Direct ({conversations.length})
            </button>
            <button
              onClick={() => setActiveTab('groups')}
              className={`tab-btn ${activeTab === 'groups' ? 'active' : ''}`}
              style={{ fontSize: '0.82rem', padding: '0.35rem 0.65rem' }}
            >
              Groups ({groups.length})
            </button>
          </div>

          <button
            onClick={() => setShowCreateGroup(true)}
            className="btn btn-secondary btn-sm"
            style={{ padding: '0.35rem 0.6rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
            title="Create New Group"
          >
            <Plus size={14} /> Group
          </button>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', marginBottom: '0.8rem' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-secondary)' }} />
          <input
            type="text"
            className="text-input"
            placeholder={activeTab === 'direct' ? 'Search contacts...' : 'Search groups...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '2.2rem', fontSize: '0.85rem' }}
          />
        </div>

        {/* List Content */}
        <div className="conversation-list">
          {loadingList ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              <Loader2 size={24} className="spin" style={{ margin: '0 auto' }} />
            </div>
          ) : activeTab === 'direct' ? (
            /* Direct Chats List */
            filteredConvos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                <p>No active chats yet.</p>
                {contacts.length > 0 && (
                  <p style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>Pick a follower below to start chatting!</p>
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
                    <div style={{ position: 'relative' }}>
                      <Avatar src={partner.profilePicture} size={42} />
                      {online && <div className="online-indicator" />}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                          {partner.name || partner.username}
                        </span>
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
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                <Users size={28} style={{ opacity: 0.4, margin: '0 auto 0.5rem' }} />
                <p>No groups joined yet.</p>
                <button
                  onClick={() => setShowCreateGroup(true)}
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: '0.8rem' }}
                >
                  Create First Group
                </button>
              </div>
            ) : (
              filteredGroups.map((g) => {
                const isActive = activeChat?.isGroup && activeChat._id === g._id;
                const isBroadcast = g.groupType === 'broadcast';

                return (
                  <div
                    key={g._id}
                    className={`conversation-item ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveChat({ isGroup: true, ...g })}
                  >
                    <div style={{ position: 'relative' }}>
                      <Avatar src={g.icon} size={42} />
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '-2px',
                          right: '-2px',
                          backgroundColor: isBroadcast ? '#10b981' : '#6366f1',
                          borderRadius: '50%',
                          width: '16px',
                          height: '16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          border: '2px solid var(--bg-card)',
                        }}
                      >
                        {isBroadcast ? <Radio size={9} /> : <Users size={9} />}
                      </div>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {g.name}
                        </span>
                        <span className={`group-type-tag ${isBroadcast ? 'broadcast' : 'standard'}`}>
                          {isBroadcast ? 'Channel' : 'Group'}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {g.lastMessage?.text || `${g.participants?.length || 0} members`}
                      </p>
                    </div>
                  </div>
                );
              })
            )
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="chat-main">
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="chat-header" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <Avatar
                  src={activeChat.isGroup ? activeChat.icon : activeChat.profilePicture}
                  size={42}
                />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem' }}>
                      {activeChat.isGroup ? activeChat.name : activeChat.name || activeChat.username}
                    </h3>
                    {activeChat.isGroup && (
                      <span className={`group-type-tag ${activeChat.groupType === 'broadcast' ? 'broadcast' : 'standard'}`}>
                        {activeChat.groupType === 'broadcast' ? 'WhatsApp Channel' : 'Instagram Group'}
                      </span>
                    )}
                  </div>

                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {activeChat.isGroup ? (
                      activeChat.groupType === 'broadcast' ? (
                        isCurrentGroupAdmin ? (
                          'Admin View: You manage this channel'
                        ) : (
                          'Private Channel: Only Admin sees your messages'
                        )
                      ) : (
                        `${activeChat.participants?.length || 0} participants • Tap settings to edit`
                      )
                    ) : isUserOnline(activeChat._id || activeChat.id) ? (
                      <span style={{ color: '#34d399' }}>● Online</span>
                    ) : (
                      'Offline'
                    )}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {!activeChat.isGroup ? (
                  <>
                    {/* Audio Call */}
                    <button
                      onClick={() =>
                        setCallState({
                          isOpen: true,
                          isIncoming: false,
                          partnerUser: activeChat,
                          callType: 'audio',
                        })
                      }
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.45rem', borderRadius: '50%' }}
                      title="Start Voice Call"
                    >
                      <Phone size={17} />
                    </button>

                    {/* Video Call */}
                    <button
                      onClick={() =>
                        setCallState({
                          isOpen: true,
                          isIncoming: false,
                          partnerUser: activeChat,
                          callType: 'video',
                        })
                      }
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.45rem', borderRadius: '50%' }}
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
                    style={{ padding: '0.4rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}
                    title="Group Settings & Info"
                  >
                    <Settings size={15} /> Info
                  </button>
                )}
              </div>
            </div>

            {/* Broadcast Channel Admin Control Banner */}
            {activeChat.isGroup && activeChat.groupType === 'broadcast' && isCurrentGroupAdmin && (
              <div
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  borderBottom: '1px solid rgba(16, 185, 129, 0.25)',
                  padding: '0.5rem 1rem',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Shield size={14} style={{ color: '#34d399' }} />
                  <span>
                    Sending as: <strong>{isAdminBroadcastMode ? 'Broadcast to All' : `Private to @${broadcastTargetUser?.username}`}</strong>
                  </span>
                </div>

                <button
                  onClick={() => setIsAdminBroadcastMode((prev) => !prev)}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                >
                  {isAdminBroadcastMode ? 'Switch to Private Reply' : 'Switch to Broadcast'}
                </button>
              </div>
            )}

            {/* Messages Thread */}
            <div className="chat-messages">
              {loadingChat ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                  <Loader2 size={30} className="spin" style={{ margin: '0 auto' }} />
                </div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                  <p>No messages yet. Say hello!</p>
                </div>
              ) : (
                messages.map((m) => {
                  const senderId = m.senderId?._id || m.senderId;
                  const isMine = senderId === currentUser.id;
                  const senderObj = m.senderId || {};

                  return (
                    <div
                      key={m._id}
                      className={`message-bubble ${isMine ? 'outgoing' : 'incoming'}`}
                    >
                      {activeChat.isGroup && !isMine && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#818cf8' }}>
                            {senderObj.name || senderObj.username || 'Member'}
                          </span>
                          {activeChat.admin?._id === senderId && (
                            <span className="badge badge-info" style={{ fontSize: '0.65rem', padding: '0.1rem 0.3rem' }}>
                              Admin
                            </span>
                          )}
                        </div>
                      )}

                      {m.isBroadcast && (
                        <div style={{ fontSize: '0.7rem', color: '#34d399', fontWeight: 600, marginBottom: '0.2rem' }}>
                          📢 Broadcast Announcement
                        </div>
                      )}

                      <div style={{ wordBreak: 'break-word', fontSize: '0.9rem', lineHeight: 1.4 }}>
                        {m.text}
                      </div>

                      <div style={{ fontSize: '0.7rem', opacity: 0.7, textAlign: 'right', marginTop: '0.3rem' }}>
                        {new Date(m.createdAt || Date.now()).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  );
                })
              )}
              {isTyping && (
                <div style={{ fontStyle: 'italic', fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '0.4rem' }}>
                  typing...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSendMessage} className="chat-input-bar">
              <input
                type="text"
                className="text-input"
                placeholder={
                  activeChat.isGroup && activeChat.groupType === 'broadcast' && !isCurrentGroupAdmin
                    ? 'Write private message to Admin...'
                    : 'Write a message...'
                }
                value={inputText}
                onChange={handleInputChange}
                style={{ flex: 1 }}
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="btn btn-sm"
                style={{ padding: '0.6rem 1rem' }}
              >
                <Send size={16} />
              </button>
            </form>
          </>
        ) : (
          <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--text-secondary)' }}>
            <MessageSquare size={48} style={{ opacity: 0.3, margin: '0 auto 1rem' }} />
            <h3>Select a conversation</h3>
            <p style={{ fontSize: '0.85rem' }}>Choose a direct contact or group to begin chatting.</p>
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
                  placeholder="e.g. Pixel Creators"
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
                  Group Architecture Type
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                  <div
                    onClick={() => setNewGroupType('standard')}
                    style={{
                      padding: '0.8rem',
                      borderRadius: '8px',
                      border: `2px solid ${newGroupType === 'standard' ? 'var(--accent-color)' : 'var(--border-color)'}`,
                      cursor: 'pointer',
                      backgroundColor: newGroupType === 'standard' ? 'var(--accent-light)' : 'transparent',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.2rem' }}>
                      📸 Instagram Group
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      All members chat & anyone can update name/icon.
                    </div>
                  </div>

                  <div
                    onClick={() => setNewGroupType('broadcast')}
                    style={{
                      padding: '0.8rem',
                      borderRadius: '8px',
                      border: `2px solid ${newGroupType === 'broadcast' ? '#10b981' : 'var(--border-color)'}`,
                      cursor: 'pointer',
                      backgroundColor: newGroupType === 'broadcast' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.2rem', color: '#34d399' }}>
                      📢 WhatsApp Channel
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Only Admin is visible. Members chat privately with Admin.
                    </div>
                  </div>
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
          <div className="card" style={{ width: '100%', maxWidth: '440px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <h3 style={{ margin: 0 }}>Group Settings</h3>
              <button onClick={() => setShowGroupSettings(false)} className="btn btn-secondary btn-sm" style={{ padding: '0.3rem' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ textAlign: 'center', marginBottom: '1.2rem' }}>
              <Avatar src={activeChat.icon} size={64} style={{ margin: '0 auto 0.6rem' }} />
              <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{activeChat.name}</div>
              <span className={`group-type-tag ${activeChat.groupType === 'broadcast' ? 'broadcast' : 'standard'}`} style={{ marginTop: '0.3rem', display: 'inline-block' }}>
                {activeChat.groupType === 'broadcast' ? 'WhatsApp Confidential Channel' : 'Instagram Standard Group'}
              </span>
            </div>

            {/* Permission check rule display */}
            {activeChat.groupType === 'broadcast' && !isCurrentGroupAdmin ? (
              <div
                style={{
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  color: '#fbbf24',
                  padding: '0.8rem',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  marginBottom: '1rem',
                }}
              >
                WhatsApp Channel Rule: Only the Channel Admin (@{activeChat.admin?.username}) can change the group name or icon.
              </div>
            ) : (
              <form onSubmit={handleUpdateGroup}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                    Edit Group Name
                  </label>
                  <input
                    type="text"
                    className="text-input"
                    value={editGroupName}
                    onChange={(e) => setEditGroupName(e.target.value)}
                    required
                  />
                </div>

                <div style={{ marginBottom: '1.2rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '0.3rem' }}>
                    Change Group Icon
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
            )}
          </div>
        </div>
      )}

      {/* WebRTC Video / Audio Calling Overlay */}
      {callState?.isOpen && (
        <CallModal
          callState={callState}
          onEndCall={() => setCallState(null)}
          socket={socket}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};
