import { useState, useEffect } from 'react';
import { postAPI, socialAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { 
  Heart, 
  MessageSquare, 
  Repeat, 
  Share2, 
  Trash2, 
  Loader2, 
  Send, 
  CornerDownRight, 
  Check 
} from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { useNotifications } from '../context/NotificationContext';
import { StoryTray } from '../components/StoryTray';
import { ConfirmModal } from '../components/ConfirmModal';

export const FeedPage = () => {
  const { user } = useAuth();
  const { showToast } = useNotifications();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmConfig, setConfirmConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    loading: false,
  });

  // Listen for posts published via bottom dock create post modal
  useEffect(() => {
    const handleGlobalPostCreated = (e) => {
      if (e.detail) {
        setPosts((prev) => [e.detail, ...prev]);
      }
    };
    window.addEventListener('postCreated', handleGlobalPostCreated);
    return () => window.removeEventListener('postCreated', handleGlobalPostCreated);
  }, []);
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  const [commentsMap, setCommentsMap] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [commentLoading, setCommentLoading] = useState(false);

  // Threaded replies state
  const [activeReplyId, setActiveReplyId] = useState(null);
  const [replyInputs, setReplyInputs] = useState({});
  const [submittingReply, setSubmittingReply] = useState(false);

  // Share link toast
  const [shareToastId, setShareToastId] = useState(null);

  const fetchFeed = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await postAPI.getFeed(1, 30);
      setPosts(data.posts || []);
    } catch (err) {
      setError(err.message || 'Failed to load feed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed();
  }, []);

  const handlePostCreated = (newPost) => {
    setPosts([newPost, ...posts]);
  };

  const handleToggleLike = async (postId) => {
    try {
      const data = await socialAPI.toggleLike(postId);
      setPosts((prevPosts) =>
        prevPosts.map((p) =>
          p._id === postId
            ? { ...p, isLiked: data.liked, likesCount: data.likeCount }
            : p
        )
      );
    } catch (err) {
      showToast(err.message || 'Failed to update like', 'error');
    }
  };

  const handleToggleRepost = async (postId) => {
    try {
      const data = await postAPI.toggleRepost(postId);
      setPosts((prevPosts) =>
        prevPosts.map((p) =>
          p._id === postId
            ? { ...p, isReposted: data.reposted, repostsCount: data.repostsCount }
            : p
        )
      );
    } catch (err) {
      showToast(err.message || 'Failed to update repost', 'error');
    }
  };

  const handleSharePost = async (postId) => {
    const url = `${window.location.origin}/post/${postId}`;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setShareToastId(postId);
      setTimeout(() => setShareToastId(null), 2500);
      showToast('Post link copied to clipboard!', 'success');
    } catch {
      showToast('Failed to copy link', 'error');
    }
  };

  const handleToggleComments = async (postId) => {
    if (activeCommentPostId === postId) {
      setActiveCommentPostId(null);
      return;
    }

    setActiveCommentPostId(postId);
    if (!commentsMap[postId]) {
      try {
        setCommentLoading(true);
        const data = await socialAPI.getComments(postId);
        setCommentsMap((prev) => ({ ...prev, [postId]: data.comments }));
      } catch (err) {
        console.error('Failed to load comments:', err.message);
      } finally {
        setCommentLoading(false);
      }
    }
  };

  const handleAddComment = async (postId) => {
    const text = commentInputs[postId];
    if (!text || !text.trim()) return;

    try {
      const data = await socialAPI.addComment(postId, text.trim());
      setCommentsMap((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), data.comment],
      }));
      setPosts((prev) =>
        prev.map((p) =>
          p._id === postId ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p
        )
      );
      setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
    } catch (err) {
      showToast(err.message || 'Failed to add comment', 'error');
    }
  };

  const handleAddReply = async (postId, parentId) => {
    const text = replyInputs[parentId];
    if (!text || !text.trim() || submittingReply) return;

    try {
      setSubmittingReply(true);
      const data = await socialAPI.addComment(postId, text.trim(), parentId);
      setCommentsMap((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), data.comment],
      }));
      setPosts((prev) =>
        prev.map((p) =>
          p._id === postId ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p
        )
      );
      setReplyInputs((prev) => ({ ...prev, [parentId]: '' }));
      setActiveReplyId(null);
    } catch (err) {
      showToast(err.message || 'Failed to add reply', 'error');
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleDeleteComment = (postId, commentId) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Comment',
      message: 'Are you sure you want to delete this comment?',
      onConfirm: async () => {
        try {
          setConfirmConfig((prev) => ({ ...prev, loading: true }));
          await socialAPI.deleteComment(commentId);
          setCommentsMap((prev) => ({
            ...prev,
            [postId]: (prev[postId] || []).filter(
              (c) => c._id !== commentId && (c.parentId?._id || c.parentId) !== commentId
            ),
          }));
          setPosts((prev) =>
            prev.map((p) =>
              p._id === postId ? { ...p, commentsCount: Math.max(0, (p.commentsCount || 0) - 1) } : p
            )
          );
          showToast('Comment deleted', 'info');
        } catch (err) {
          showToast(err.message || 'Failed to delete comment', 'error');
        } finally {
          setConfirmConfig({ isOpen: false, title: '', message: '', onConfirm: null, loading: false });
        }
      },
    });
  };

  const handleDeletePost = (postId) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Post',
      message: 'Are you sure you want to permanently delete this post?',
      onConfirm: async () => {
        try {
          setConfirmConfig((prev) => ({ ...prev, loading: true }));
          await postAPI.deletePost(postId);
          setPosts((prev) => prev.filter((p) => p._id !== postId));
          showToast('Post deleted', 'info');
        } catch (err) {
          showToast(err.message || 'Failed to delete post', 'error');
        } finally {
          setConfirmConfig({ isOpen: false, title: '', message: '', onConfirm: null, loading: false });
        }
      },
    });
  };

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', width: '100%' }}>
      {/* 24-Hour Stories Tray */}
      <StoryTray />

      {error && (
        <div className="card" style={{ color: '#f87171', borderColor: '#ef4444' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          <Loader2 size={32} className="spin" style={{ margin: '0 auto 1rem' }} />
          <p>Loading your feed...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <h3>No posts in your feed yet!</h3>
          <p style={{ color: 'var(--text-secondary)', margin: '0.8rem 0 1.2rem' }}>
            Follow creators on Explore to see their latest updates here.
          </p>
          <Link to="/search" className="btn btn-sm">
            Explore Creators
          </Link>
        </div>
      ) : (
        posts.map((post) => {
          const author = post.authorId || {};
          const isOwner = author._id === user?.id;
          const isAdmin = user?.userType === 'Admin';
          const postComments = commentsMap[post._id] || [];

          // Group comments into root and replies
          const rootComments = postComments.filter((c) => !c.parentId);
          const getReplies = (pId) =>
            postComments.filter((c) => (c.parentId?._id || c.parentId) === pId);

          return (
            <div key={post._id} className="card">
              {/* Repost Banner */}
              {post.repostedBy && (
                <div className="repost-banner">
                  <Repeat size={14} />
                  <span>
                    Reposted by{' '}
                    <Link
                      to={`/profile/${post.repostedBy.username}`}
                      style={{ color: 'inherit', textDecoration: 'underline' }}
                    >
                      @{post.repostedBy.username}
                    </Link>
                  </span>
                </div>
              )}

              <div className="post-header" style={{ justifyContent: 'space-between' }}>
                <Link
                  to={`/profile/${author.username}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', textDecoration: 'none', color: 'inherit' }}
                >
                  <Avatar src={author.profilePicture} size={40} />
                  <div className="post-user-info">
                    <span className="user-name">{author.name || 'Anonymous'}</span>
                    <span className="user-handle">
                      @{author.username} • {new Date(post.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </Link>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {shareToastId === post._id && (
                    <span className="badge badge-online" style={{ fontSize: '0.7rem' }}>
                      <Check size={12} /> Copied
                    </span>
                  )}

                  {(isOwner || isAdmin) && (
                    <button
                      onClick={() => handleDeletePost(post._id)}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '0.3rem', color: '#f87171' }}
                      title="Delete Post"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              {post.text && <p className="post-content">{post.text}</p>}

              {post.image && (
                <img
                  src={post.image}
                  alt="Post"
                  className="post-media"
                />
              )}

              {/* Engagement Bar (Twitter/Instagram icon style) */}
              <div className="post-footer">
                <button
                  className={`engagement-btn like-btn ${post.isLiked ? 'liked' : ''}`}
                  onClick={() => handleToggleLike(post._id)}
                  title={post.isLiked ? 'Unlike' : 'Like'}
                >
                  <Heart size={18} fill={post.isLiked ? 'var(--like-color)' : 'none'} color={post.isLiked ? 'var(--like-color)' : 'currentColor'} />
                  {post.likesCount > 0 && <span className="engagement-count">{post.likesCount}</span>}
                </button>

                <button
                  className="engagement-btn comment-btn"
                  onClick={() => handleToggleComments(post._id)}
                  title="Reply"
                >
                  <MessageSquare size={18} />
                  {post.commentsCount > 0 && <span className="engagement-count">{post.commentsCount}</span>}
                </button>

                <button
                  className={`engagement-btn repost-btn ${post.isReposted ? 'reposted' : ''}`}
                  onClick={() => handleToggleRepost(post._id)}
                  title={post.isReposted ? 'Undo Repost' : 'Repost'}
                >
                  <Repeat size={18} color={post.isReposted ? 'var(--repost-color)' : 'currentColor'} />
                  {post.repostsCount > 0 && <span className="engagement-count">{post.repostsCount}</span>}
                </button>

                <button
                  className="engagement-btn share-btn"
                  onClick={() => handleSharePost(post._id)}
                  title="Share post link"
                  style={{ marginLeft: 'auto' }}
                >
                  <Share2 size={17} />
                </button>
              </div>

              {/* Comments Section */}
              {activeCommentPostId === post._id && (
                <div className="comments-section">
                  {commentLoading && !commentsMap[post._id] ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      Loading comments...
                    </p>
                  ) : rootComments.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.8rem' }}>
                      No comments yet. Start the conversation!
                    </p>
                  ) : (
                    rootComments.map((c) => {
                      const canDelete = c.authorId?._id === user?.id || isOwner || isAdmin;
                      const replies = getReplies(c._id);

                      return (
                        <div key={c._id} className="comment-block" style={{ marginBottom: '0.8rem' }}>
                          <div className="comment-item" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                            <Link
                              to={`/profile/${c.authorId?.username}`}
                              style={{ textDecoration: 'none', color: 'inherit', flexShrink: 0 }}
                            >
                              <Avatar src={c.authorId?.profilePicture} size={28} />
                            </Link>
                            <div className="comment-bubble" style={{ backgroundColor: 'var(--bg-secondary)', padding: '0.5rem 0.8rem', borderRadius: '12px', flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                                <Link
                                  to={`/profile/${c.authorId?.username}`}
                                  style={{
                                    fontWeight: 600,
                                    fontSize: '0.8rem',
                                    textDecoration: 'none',
                                    color: 'inherit',
                                  }}
                                >
                                  @{c.authorId?.username || 'user'}
                                </Link>

                                {canDelete && (
                                  <button
                                    onClick={() => handleDeleteComment(post._id, c._id)}
                                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}
                                    title="Delete comment"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                              <div style={{ fontSize: '0.85rem', wordBreak: 'break-word' }}>{c.text}</div>

                              <button
                                onClick={() => {
                                  setActiveReplyId(activeReplyId === c._id ? null : c._id);
                                  setReplyInputs({ ...replyInputs, [c._id]: `@${c.authorId?.username} ` });
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--accent-color)',
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.2rem',
                                  marginTop: '0.3rem',
                                  padding: 0,
                                }}
                              >
                                <CornerDownRight size={12} /> Reply
                              </button>
                            </div>
                          </div>

                          {/* Inline Reply Input */}
                          {activeReplyId === c._id && (
                            <div style={{ marginLeft: '2.2rem', marginTop: '0.4rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                              <input
                                type="text"
                                className="text-input"
                                placeholder={`Reply to @${c.authorId?.username}...`}
                                value={replyInputs[c._id] || ''}
                                onChange={(e) => setReplyInputs({ ...replyInputs, [c._id]: e.target.value })}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddReply(post._id, c._id)}
                                style={{ fontSize: '0.8rem', padding: '0.35rem 0.6rem' }}
                                autoFocus
                              />
                              <button
                                onClick={() => handleAddReply(post._id, c._id)}
                                disabled={!replyInputs[c._id]?.trim() || submittingReply}
                                className="btn btn-sm"
                                style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                              >
                                {submittingReply ? <Loader2 size={12} className="spin" /> : 'Reply'}
                              </button>
                              <button
                                onClick={() => setActiveReplyId(null)}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                              >
                                Cancel
                              </button>
                            </div>
                          )}

                          {/* Threaded Child Replies */}
                          {replies.length > 0 && (
                            <div className="comment-reply-thread">
                              {replies.map((r) => {
                                const canDeleteReply = r.authorId?._id === user?.id || isOwner || isAdmin;
                                return (
                                  <div key={r._id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                                    <Link to={`/profile/${r.authorId?.username}`}>
                                      <Avatar src={r.authorId?.profilePicture} size={24} />
                                    </Link>
                                    <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '0.4rem 0.7rem', borderRadius: '10px', flex: 1 }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.1rem' }}>
                                        <Link
                                          to={`/profile/${r.authorId?.username}`}
                                          style={{ fontWeight: 600, fontSize: '0.75rem', textDecoration: 'none', color: 'inherit' }}
                                        >
                                          @{r.authorId?.username || 'user'}
                                        </Link>
                                        {canDeleteReply && (
                                          <button
                                            onClick={() => handleDeleteComment(post._id, r._id)}
                                            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}
                                            title="Delete reply"
                                          >
                                            <Trash2 size={11} />
                                          </button>
                                        )}
                                      </div>
                                      <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                                        {r.text}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.8rem' }}>
                    <input
                      type="text"
                      className="text-input"
                      placeholder="Write a comment..."
                      value={commentInputs[post._id] || ''}
                      onChange={(e) =>
                        setCommentInputs({ ...commentInputs, [post._id]: e.target.value })
                      }
                      onKeyDown={(e) => e.key === 'Enter' && handleAddComment(post._id)}
                    />
                    <button onClick={() => handleAddComment(post._id)} className="btn btn-sm">
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Themed Confirm Dialog */}
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        loading={confirmConfig.loading}
        onConfirm={confirmConfig.onConfirm}
        onClose={() => setConfirmConfig({ isOpen: false, title: '', message: '', onConfirm: null, loading: false })}
      />
    </div>
  );
};
