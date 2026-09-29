import { useState, useEffect } from 'react';
import { postAPI, socialAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { CreatePost } from '../components/CreatePost';
import { Link } from 'react-router-dom';
import { Heart, MessageSquare, Trash2, Loader2, Send } from 'lucide-react';

export const FeedPage = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  const [commentsMap, setCommentsMap] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [commentLoading, setCommentLoading] = useState(false);

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
      alert(err.message || 'Failed to update like');
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
      alert(err.message || 'Failed to add comment');
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    try {
      await postAPI.deletePost(postId);
      setPosts((prev) => prev.filter((p) => p._id !== postId));
    } catch (err) {
      alert(err.message || 'Failed to delete post');
    }
  };

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', width: '100%' }}>
      {/* Create Post Component with Device Image Upload */}
      <CreatePost onPostCreated={handlePostCreated} />

      {error && (
        <div className="card" style={{ color: '#f87171', borderColor: '#ef4444' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
          <Loader2 size={32} className="spin" style={{ margin: '0 auto 1rem' }} />
          <p>Loading your feed from database...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <h3>No posts in your feed yet!</h3>
          <p style={{ color: 'var(--text-secondary)', margin: '0.8rem 0 1.2rem' }}>
            Follow other users on the Discover page or create your first post above.
          </p>
          <Link to="/search" className="btn btn-sm">
            Discover Users
          </Link>
        </div>
      ) : (
        posts.map((post) => {
          const author = post.authorId || {};
          const isOwner = author._id === user?.id;
          const isAdmin = user?.userType === 'Admin';
          const postComments = commentsMap[post._id] || [];

          return (
            <div key={post._id} className="card">
              <div className="post-header" style={{ justifyContent: 'space-between' }}>
                <Link
                  to={`/profile/${author.username}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', textDecoration: 'none', color: 'inherit' }}
                >
                  <div className="avatar">
                    {author.profilePicture ? (
                      <img src={author.profilePicture} alt={author.name} />
                    ) : (
                      (author.name || 'U').charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="post-user-info">
                    <span className="user-name">{author.name || 'Anonymous'}</span>
                    <span className="user-handle">
                      @{author.username} • {new Date(post.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </Link>

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

              {post.text && <p className="post-content">{post.text}</p>}

              {post.image && (
                <img
                  src={post.image}
                  alt="Post media from device"
                  className="post-media"
                />
              )}

              {/* Engagement Bar */}
              <div className="post-footer">
                <button
                  className={`engagement-btn ${post.isLiked ? 'liked' : ''}`}
                  onClick={() => handleToggleLike(post._id)}
                >
                  <Heart size={18} fill={post.isLiked ? '#f43f5e' : 'none'} />
                  <span>{post.likesCount || 0} Likes</span>
                </button>

                <button
                  className="engagement-btn"
                  onClick={() => handleToggleComments(post._id)}
                >
                  <MessageSquare size={18} />
                  <span>{post.commentsCount || 0} Comments</span>
                </button>
              </div>

              {/* Comments Section */}
              {activeCommentPostId === post._id && (
                <div className="comments-section">
                  {commentLoading && !commentsMap[post._id] ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      Loading comments...
                    </p>
                  ) : postComments.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.8rem' }}>
                      No comments yet. Start the conversation!
                    </p>
                  ) : (
                    postComments.map((c) => (
                      <div key={c._id} className="comment-item">
                        <div className="avatar" style={{ width: '28px', height: '28px', fontSize: '0.75rem' }}>
                          {c.authorId?.profilePicture ? (
                            <img src={c.authorId.profilePicture} alt="" />
                          ) : (
                            (c.authorId?.name || 'U').charAt(0)
                          )}
                        </div>
                        <div className="comment-bubble">
                          <div className="comment-author">@{c.authorId?.username || 'user'}</div>
                          <div>{c.text}</div>
                        </div>
                      </div>
                    ))
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
    </div>
  );
};
