import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { messageAPI, userAPI, socialAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { Send, Loader2, MessageSquare, Search, X, Users } from 'lucide-react';
import { Avatar } from '../components/Avatar';

export const ChatPage = () => {
  const { user: currentUser } = useAuth();
  const { socket, isUserOnline } = useSocket();
  const [searchParams] = useSearchParams();
  const targetUserIdFromUrl = searchParams.get('userId');

  const [conversations, setConversations] = useState([]);
  const [contacts, setContacts] = useState([]); // followers and following contacts
  const [searchQuery, setSearchQuery] = useState('');
  const [activePartner, setActivePartner] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        setLoadingConvos(true);
        const data = await messageAPI.getConversations();
        setConversations(data.conversations || []);

        if (targetUserIdFromUrl) {
          const existing = (data.conversations || []).find(
            (c) => c.partner?.id === targetUserIdFromUrl
          );
          if (existing) {
            setActivePartner(existing.partner);
          } else {
            try {
              const historyData = await messageAPI.getChatHistory(targetUserIdFromUrl);
              if (historyData.partner) {
                setActivePartner(historyData.partner);
              }
            } catch (e) {
              console.error('Failed to load target chat user:', e.message);
            }
          }
        } else if ((data.conversations || []).length > 0) {
          setActivePartner(data.conversations[0].partner);
        }
      } catch (err) {
        console.error('Failed to load conversations:', err.message);
      } finally {
        setLoadingConvos(false);
      }
    };

    fetchConversations();
  }, [targetUserIdFromUrl]);

  // Load followers & following to allow starting chats directly
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
              name: u.name,
              username: u.username,
              profilePicture: u.profilePicture,
              bio: u.bio,
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

  const handleSelectContact = (contact) => {
    const contactId = contact.id || contact._id;
    const existing = conversations.find((c) => c.partner?.id === contactId);
    if (existing) {
      setActivePartner(existing.partner);
    } else {
      setActivePartner({
        id: contactId,
        name: contact.name,
        username: contact.username,
        profilePicture: contact.profilePicture,
      });
      setMessages([]);
    }
    setSearchQuery('');
  };

  useEffect(() => {
    if (!activePartner) return;

    const fetchHistory = async () => {
      try {
        setLoadingChat(true);
        const data = await messageAPI.getChatHistory(activePartner.id);
        setMessages(data.messages || []);
        scrollToBottom();
      } catch (err) {
        console.error('Failed to load chat history:', err.message);
      } finally {
        setLoadingChat(false);
      }
    };

    fetchHistory();
  }, [activePartner]);

  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (incomingMsg) => {
      const partnerId =
        incomingMsg.senderId?._id === currentUser?.id
          ? incomingMsg.receiverId?._id
          : incomingMsg.senderId?._id;

      setConversations((prev) => {
        const index = prev.findIndex((c) => c.partner?.id === partnerId);
        const updatedItem = {
          partner:
            incomingMsg.senderId?._id === currentUser?.id
              ? incomingMsg.receiverId
              : incomingMsg.senderId,
          lastMessage: {
            id: incomingMsg._id,
            text: incomingMsg.text,
            senderId: incomingMsg.senderId?._id,
            createdAt: incomingMsg.createdAt,
          },
          unreadCount:
            incomingMsg.senderId?._id !== currentUser?.id && activePartner?.id !== partnerId
              ? (prev[index]?.unreadCount || 0) + 1
              : 0,
        };

        if (index > -1) {
          const next = [...prev];
          next.splice(index, 1);
          return [updatedItem, ...next];
        }
        return [updatedItem, ...prev];
      });

      if (
        (incomingMsg.senderId?._id === activePartner?.id &&
          incomingMsg.receiverId?._id === currentUser?.id) ||
        (incomingMsg.senderId?._id === currentUser?.id &&
          incomingMsg.receiverId?._id === activePartner?.id)
      ) {
        setMessages((prev) => [...prev, incomingMsg]);
        scrollToBottom();
      }
    };

    const handleUserTyping = ({ userId }) => {
      if (userId === activePartner?.id) {
        setIsTyping(true);
      }
    };

    const handleUserStopTyping = ({ userId }) => {
      if (userId === activePartner?.id) {
        setIsTyping(false);
      }
    };

    socket.on('receiveMessage', handleReceiveMessage);
    socket.on('userTyping', handleUserTyping);
    socket.on('userStopTyping', handleUserStopTyping);

    return () => {
      socket.off('receiveMessage', handleReceiveMessage);
      socket.off('userTyping', handleUserTyping);
      socket.off('userStopTyping', handleUserStopTyping);
    };
  }, [socket, activePartner, currentUser]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleInputChange = (e) => {
    setInputText(e.target.value);
    if (!socket || !activePartner) return;

    socket.emit('typing', { receiverId: activePartner.id });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stopTyping', { receiverId: activePartner.id });
    }, 1500);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim() || !activePartner) return;

    const messageText = inputText.trim();
    setInputText('');

    if (socket) {
      socket.emit('stopTyping', { receiverId: activePartner.id });
      socket.emit(
        'sendMessage',
        { receiverId: activePartner.id, text: messageText },
        (res) => {
          if (res?.error) {
            alert('Failed to send message: ' + res.error);
          }
        }
      );
    }
  };

  const query = searchQuery.trim().toLowerCase();
  const filteredConversations = conversations.filter((c) => {
    if (!query) return true;
    const name = c.partner?.name?.toLowerCase() || '';
    const username = c.partner?.username?.toLowerCase() || '';
    return name.includes(query) || username.includes(query);
  });

  const filteredContacts = contacts.filter((c) => {
    const name = c.name?.toLowerCase() || '';
    const username = c.username?.toLowerCase() || '';
    return name.includes(query) || username.includes(query);
  });

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', width: '100%' }}>
      <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
        <h2 className="card-title" style={{ margin: 0 }}>
          <MessageSquare size={20} color="#818cf8" /> Real-Time Private Messaging
        </h2>
      </div>

      <div className="chat-container">
        {/* Left Sidebar: Conversations & Contacts Search */}
        <div className="chat-sidebar">
          {/* Search Box */}
          <div style={{ padding: '0.8rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ position: 'relative' }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-secondary)',
                }}
              />
              <input
                type="text"
                className="text-input"
                style={{ paddingLeft: '2.4rem', paddingRight: searchQuery ? '2.4rem' : '0.8rem', fontSize: '0.85rem' }}
                placeholder="Search chats or find followers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {loadingConvos ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <Loader2 size={24} className="spin" style={{ margin: '0 auto' }} />
            </div>
          ) : (
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {/* Recent Conversations */}
              <div
                style={{
                  padding: '0.6rem 1rem 0.3rem',
                  fontWeight: '600',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {searchQuery ? `Matching Chats (${filteredConversations.length})` : `Recent Chats (${conversations.length})`}
              </div>

              {filteredConversations.length === 0 && !searchQuery ? (
                <div style={{ padding: '1.2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  No active conversations yet. Pick a follower below to start chatting!
                </div>
              ) : (
                filteredConversations.map((convo) => {
                  const partner = convo.partner || {};
                  const isActive = activePartner?.id === partner.id;
                  const online = isUserOnline(partner.id);

                  return (
                    <div
                      key={partner.id || Math.random()}
                      className={`conversation-item ${isActive ? 'active' : ''}`}
                      onClick={() => {
                        setActivePartner(partner);
                        setSearchQuery('');
                      }}
                    >
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <Avatar src={partner.profilePicture} size={38} />
                        {online && (
                          <span
                            style={{
                              position: 'absolute',
                              bottom: 0,
                              right: 0,
                              width: '10px',
                              height: '10px',
                              borderRadius: '50%',
                              backgroundColor: '#10b981',
                              border: '2px solid var(--bg-card)',
                            }}
                          />
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{partner.name}</div>
                        <div
                          style={{
                            color: 'var(--text-secondary)',
                            fontSize: '0.8rem',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                          }}
                        >
                          {convo.lastMessage?.text || 'Click to chat'}
                        </div>
                      </div>

                      {convo.unreadCount > 0 && (
                        <span
                          style={{
                            backgroundColor: 'var(--accent-color)',
                            color: 'white',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.45rem',
                            borderRadius: '9999px',
                          }}
                        >
                          {convo.unreadCount}
                        </span>
                      )}
                    </div>
                  );
                })
              )}

              {/* Followers & Following Contacts Section */}
              {contacts.length > 0 && (
                <>
                  <div
                    style={{
                      padding: '0.9rem 1rem 0.3rem',
                      fontWeight: '600',
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      borderTop: '1px solid var(--border-color)',
                      marginTop: '0.4rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    <Users size={14} />
                    <span>
                      {searchQuery
                        ? `Followers / Following (${filteredContacts.length})`
                        : `Start Chat with Follower (${contacts.length})`}
                    </span>
                  </div>

                  {filteredContacts.length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      No followers or following match "{searchQuery}"
                    </div>
                  ) : (
                    filteredContacts.map((contact) => {
                      const isActive = activePartner?.id === contact.id;
                      const online = isUserOnline(contact.id);

                      return (
                        <div
                          key={contact.id}
                          className={`conversation-item ${isActive ? 'active' : ''}`}
                          onClick={() => handleSelectContact(contact)}
                          title={`Start chat with ${contact.name}`}
                        >
                          <div style={{ position: 'relative', flexShrink: 0 }}>
                            <Avatar src={contact.profilePicture} size={38} />
                            {online && (
                              <span
                                style={{
                                  position: 'absolute',
                                  bottom: 0,
                                  right: 0,
                                  width: '10px',
                                  height: '10px',
                                  borderRadius: '50%',
                                  backgroundColor: '#10b981',
                                  border: '2px solid var(--bg-card)',
                                }}
                              />
                            )}
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{contact.name}</div>
                            <div
                              style={{
                                color: 'var(--text-secondary)',
                                fontSize: '0.78rem',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                              }}
                            >
                              @{contact.username}
                            </div>
                          </div>

                          <span style={{ fontSize: '0.75rem', color: '#818cf8', fontWeight: 500 }}>
                            Chat
                          </span>
                        </div>
                      );
                    })
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Right Panel: Chat Window */}
        <div className="chat-window">
          {activePartner ? (
            <>
              {/* Chat Header */}
              <div className="chat-header">
                <Avatar src={activePartner.profilePicture} size={38} />
                <div>
                  <div style={{ fontWeight: 600 }}>{activePartner.name}</div>
                  <div style={{ fontSize: '0.75rem', color: isUserOnline(activePartner.id) ? '#34d399' : 'var(--text-secondary)' }}>
                    {isUserOnline(activePartner.id) ? '● Online' : 'Offline'}
                  </div>
                </div>
              </div>

              {/* Messages Bubble Stream */}
              <div className="chat-messages">
                {loadingChat ? (
                  <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--text-secondary)' }}>
                    <Loader2 size={24} className="spin" style={{ margin: '0 auto' }} />
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--text-secondary)' }}>
                    Say hello to {activePartner.name}! 👋
                  </div>
                ) : (
                  messages.map((m) => {
                    const isSentByMe =
                      (m.senderId?._id || m.senderId) === currentUser?.id;

                    return (
                      <div
                        key={m._id || m.id}
                        className={`message-bubble ${isSentByMe ? 'sent' : 'received'}`}
                      >
                        <div>{m.text}</div>
                        <div style={{ fontSize: '0.65rem', textAlign: 'right', marginTop: '0.2rem', opacity: 0.8 }}>
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
                  <div style={{ fontStyle: 'italic', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {activePartner.name} is typing...
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Bar */}
              <form onSubmit={handleSendMessage} className="chat-input-bar">
                <input
                  type="text"
                  className="text-input"
                  placeholder={`Message ${activePartner.name}...`}
                  value={inputText}
                  onChange={handleInputChange}
                />
                <button type="submit" className="btn">
                  <Send size={16} />
                </button>
              </form>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
              Select a conversation to start messaging
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
