import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { postAPI, socialAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Avatar } from '../components/Avatar';
import { 
  Heart, 
  MessageSquare, 
  Repeat, 
  Share2, 
  Trash2, 
  Loader2, 
  Send, 
  ArrowLeft,
  AlertCircle,
  CornerDownRight,
  Check
} from 'lucide-react';

export const PostDetailPage = () => {
  const { postId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Repost & Share State
  const [copiedToast, setCopiedToast] = useState(false);

  // Threaded Reply State
  const [activeReplyId, setActiveReplyId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  useEffect(() => {
    const fetchPostData = async () => {
      if (!postId) return;
      try {
        setLoading(true);
        setError('');
        const data = await postAPI.getPostById(postId);
        setPost(data.post);
        setComments(data.comments || []);
      } catch (err) {
        setError(err.message || 'Failed to load post');
      } finally {
        setLoading(false);
      }
    };

    fetchPostData();
  }, [postId]);

  const handleToggleLike = async () => {
    if (!post) return;
    try {
      const data = await socialAPI.toggleLike(post._id);
      setPost((prev) => ({
        ...prev,
        isLiked: data.liked,
        likesCount: data.likeCount,
      }));
    } catch (err) {
      alert(err.message || 'Failed to update like');
    }
  };

  const handleToggleRepost = async () => {
    if (!post) return;
    try {
      const data = await postAPI.toggleRepost(post._id);
      setPost((prev) => ({
        ...prev,
        isReposted: data.reposted,
        repostsCount: data.repostsCount,
      }));
    } catch (err) {
      alert(err.message || 'Failed to update repost');
    }
  };

  const handleSharePost = async () => {
    if (!post) return;
    const url = `${window.location.origin}/post/${post._id}`;
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    } else {
      prompt('Copy post link:', url);
    }
  };

  const handleAddComment = async (e) => {
    if (e) e.preventDefault();
    if (!commentText.trim() || submittingComment) return;

    try {
      setSubmittingComment(true);
      const data = await socialAPI.addComment(post._id, commentText.trim());
      setComments((prev) => [...prev, data.comment]);
      setPost((prev) => ({
        ...prev,
        commentsCount: (prev.commentsCount || 0) + 1,
      }));
      setCommentText('');
    } catch (err) {
      alert(err.message || 'Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleAddReply = async (parentId) => {
    if (!replyText.trim() || submittingReply) return;

    try {
      setSubmittingReply(true);
      const data = await socialAPI.addComment(post._id, replyText.trim(), parentId);
      setComments((prev) => [...prev, data.comment]);
      setPost((prev) => ({
        ...prev,
        commentsCount: (prev.commentsCount || 0) + 1,
      }));
      setReplyText('');
      setActiveReplyId(null);
    } catch (err) {
      alert(err.message || 'Failed to submit reply');
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;
    try {
      await socialAPI.deleteComment(commentId);
      // Remove comment and any children
      setComments((prev) =>
        prev.filter((c) => c._id !== commentId && (c.parentId?._id || c.parentId) !== commentId)
      );
      setPost((prev) => ({
        ...prev,
        commentsCount: Math.max(0, (prev.commentsCount || 0) - 1),
      }));
    } catch (err) {
      alert(err.message || 'Failed to delete comment');
    }
  };

  const handleDeletePost = async () => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    try {
      await postAPI.deletePost(post._id);
      navigate('/');
    } catch (err) {
      alert(err.message || 'Failed to delete post');
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
        <Loader2 size={36} className="spin" style={{ margin: '0 auto 1rem' }} />
        <p>Loading post details...</p>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="card" style={{ maxWidth: '600px', margin: '2rem auto', textAlign: 'center', padding: '3rem' }}>
        <AlertCircle size={40} style={{ color: '#ef4444', margin: '0 auto 1rem' }} />
        <h3>Post Unavailable</h3>
        <p style={{ color: 'var(--text-secondary)', margin: '0.8rem 0 1.5rem' }}>
          {error || 'This post could not be found or may have been deleted.'}
        </p>
        <button onClick={() => navigate(-1)} className="btn btn-secondary btn-sm" style={{ marginRight: '0.5rem' }}>
          Go Back
        </button>
        <Link to="/" className="btn btn-sm">
          Return to Feed
        </Link>
      </div>
    );
  }

  const author = post.authorId || {};
  const isOwner = author._id === user?.id;
  const isAdmin = user?.userType === 'Admin';

  // Group comments into root comments and child replies
  const rootComments = comments.filter((c) => !c.parentId);
  const getRepliesForComment = (parentId) =>
    comments.filter((c) => (c.parentId?._id || c.parentId) === parentId);

  return (
    <div style={{ maxWidth: '680px', margin: '1rem auto 3rem', width: '100%', padding: '0 0.5rem' }}>
      {/* Top Header Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <button
          onClick={() => navigate(-1)}
          className="btn btn-secondary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <ArrowLeft size={16} /> Back
        </button>

        {copiedToast && (
          <span className="badge badge-online" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <Check size={14} /> Link copied to clipboard!
          </span>
        )}
      </div>

      {/* Main Post Card */}
      <div className="card" style={{ boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)' }}>
        <div className="post-header" style={{ justifyContent: 'space-between' }}>
          <Link
            to={`/profile/${author.username}`}
            style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', textDecoration: 'none', color: 'inherit' }}
          >
            <Avatar src={author.profilePicture} size={44} />
            <div className="post-user-info">
              <span className="user-name">{author.name || 'Anonymous'}</span>
              <span className="user-handle">
                @{author.username} • {new Date(post.createdAt).toLocaleDateString()}
              </span>
            </div>
          </Link>

          {(isOwner || isAdmin) && (
            <button
              onClick={handleDeletePost}
              className="btn btn-secondary btn-sm"
              style={{ padding: '0.3rem', color: '#f87171' }}
              title="Delete Post"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>

        {post.text && (
          <p className="post-content" style={{ fontSize: '1rem', lineHeight: 1.6, margin: '1rem 0' }}>
            {post.text}
          </p>
        )}

        {post.image && (
          <img
            src={post.image}
            alt="Post content"
            className="post-media"
            style={{ maxHeight: '500px', objectFit: 'cover', borderRadius: '8px', width: '100%' }}
          />
        )}

        {/* Engagement Action Bar */}
        <div className="post-footer" style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.8rem', display: 'flex', gap: '1rem' }}>
          {/* Like */}
          <button
            className={`engagement-btn ${post.isLiked ? 'liked' : ''}`}
            onClick={handleToggleLike}
          >
            <Heart size={19} fill={post.isLiked ? '#f43f5e' : 'none'} color={post.isLiked ? '#f43f5e' : 'currentColor'} />
            <span style={{ fontWeight: 600 }}>{post.likesCount || 0} Likes</span>
          </button>

          {/* Repost */}
          <button
            className={`engagement-btn ${post.isReposted ? 'liked' : ''}`}
            onClick={handleToggleRepost}
            style={{ color: post.isReposted ? '#34d399' : 'inherit' }}
            title={post.isReposted ? 'Undo Repost' : 'Repost to your profile'}
          >
            <Repeat size={19} color={post.isReposted ? '#34d399' : 'currentColor'} />
            <span style={{ fontWeight: 600 }}>{post.repostsCount || 0} Reposts</span>
          </button>

          {/* Comments count */}
          <div className="engagement-btn" style={{ cursor: 'default' }}>
            <MessageSquare size={19} />
            <span style={{ fontWeight: 600 }}>{comments.length} Comments</span>
          </div>

          {/* Share Link */}
          <button
            className="engagement-btn"
            onClick={handleSharePost}
            title="Copy shareable link"
            style={{ marginLeft: 'auto' }}
          >
            <Share2 size={18} />
            <span>Share</span>
          </button>
        </div>

        {/* Comments Section */}
        <div className="comments-section" style={{ marginTop: '1.2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.2rem' }}>
          <h4 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-secondary)' }}>
            Comments ({comments.length})
          </h4>

          {rootComments.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.2rem', textAlign: 'center', padding: '1rem' }}>
              No comments on this post yet. Be the first to reply!
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.2rem' }}>
              {rootComments.map((c) => {
                const canDelete =
                  c.authorId?._id === user?.id || isOwner || isAdmin;
                const replies = getRepliesForComment(c._id);

                return (
                  <div key={c._id} className="comment-block">
                    {/* Parent Comment Item */}
                    <div className="comment-item" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <Link
                        to={`/profile/${c.authorId?.username}`}
                        style={{ textDecoration: 'none', color: 'inherit', flexShrink: 0 }}
                      >
                        <Avatar src={c.authorId?.profilePicture} size={32} />
                      </Link>

                      <div className="comment-bubble" style={{ backgroundColor: 'var(--bg-secondary)', padding: '0.6rem 0.9rem', borderRadius: '12px', flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                          <Link
                            to={`/profile/${c.authorId?.username}`}
                            style={{ fontWeight: 600, fontSize: '0.82rem', textDecoration: 'none', color: 'inherit' }}
                          >
                            @{c.authorId?.username || 'user'}
                          </Link>

                          {canDelete && (
                            <button
                              onClick={() => handleDeleteComment(c._id)}
                              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.1rem' }}
                              title="Delete comment"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>

                        <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', wordBreak: 'break-word', lineHeight: 1.4 }}>
                          {c.text}
                        </div>

                        {/* Reply trigger button */}
                        <div style={{ marginTop: '0.35rem' }}>
                          <button
                            onClick={() => {
                              setActiveReplyId(activeReplyId === c._id ? null : c._id);
                              setReplyText(`@${c.authorId?.username} `);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--accent-color)',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.2rem',
                              padding: 0,
                            }}
                          >
                            <CornerDownRight size={13} /> Reply
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Inline Reply Form */}
                    {activeReplyId === c._id && (
                      <div style={{ marginLeft: '2.5rem', marginTop: '0.5rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <input
                          type="text"
                          className="text-input"
                          placeholder={`Reply to @${c.authorId?.username}...`}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleAddReply(c._id)}
                          style={{ fontSize: '0.82rem', padding: '0.4rem 0.7rem' }}
                          autoFocus
                        />
                        <button
                          onClick={() => handleAddReply(c._id)}
                          disabled={!replyText.trim() || submittingReply}
                          className="btn btn-sm"
                          style={{ padding: '0.4rem 0.7rem', fontSize: '0.8rem' }}
                        >
                          {submittingReply ? <Loader2 size={13} className="spin" /> : 'Send'}
                        </button>
                        <button
                          onClick={() => setActiveReplyId(null)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    {/* Threaded Child Replies */}
                    {replies.length > 0 && (
                      <div className="comment-reply-thread">
                        {replies.map((reply) => {
                          const canDeleteReply =
                            reply.authorId?._id === user?.id || isOwner || isAdmin;

                          return (
                            <div key={reply._id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem' }}>
                              <Link to={`/profile/${reply.authorId?.username}`}>
                                <Avatar src={reply.authorId?.profilePicture} size={26} />
                              </Link>

                              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '0.45rem 0.75rem', borderRadius: '10px', flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.15rem' }}>
                                  <Link
                                    to={`/profile/${reply.authorId?.username}`}
                                    style={{ fontWeight: 600, fontSize: '0.78rem', textDecoration: 'none', color: 'inherit' }}
                                  >
                                    @{reply.authorId?.username || 'user'}
                                  </Link>

                                  {canDeleteReply && (
                                    <button
                                      onClick={() => handleDeleteComment(reply._id)}
                                      style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0 }}
                                      title="Delete reply"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </div>

                                <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', wordBreak: 'break-word', lineHeight: 1.35 }}>
                                  {reply.text}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Add Root Comment Input */}
          <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            <input
              type="text"
              className="text-input"
              placeholder="Write a comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              disabled={submittingComment}
              style={{ flex: 1 }}
            />
            <button
              type="submit"
              disabled={!commentText.trim() || submittingComment}
              className="btn btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.55rem 0.9rem' }}
            >
              {submittingComment ? <Loader2 size={15} className="spin" /> : <Send size={15} />}
              <span>Reply</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
