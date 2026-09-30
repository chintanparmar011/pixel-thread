import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { userAPI, socialAPI, authAPI, postAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  UserPlus, 
  UserCheck, 
  Edit3, 
  Heart, 
  MessageSquare, 
  Camera, 
  Loader2, 
  X, 
  Trash2,
  Send
} from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { FollowListModal } from '../components/FollowListModal';

export const ProfilePage = () => {
  const { username } = useParams();
  const { user: currentUser, updateUser } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Followers / Following Modal
  const [followModalOpen, setFollowModalOpen] = useState(false);
  const [followModalTab, setFollowModalTab] = useState('followers');

  // Comments & Likes state for profile posts
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  const [commentsMap, setCommentsMap] = useState({});
  const [commentInputs, setCommentInputs] = useState({});
  const [commentLoading, setCommentLoading] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatarFile, setEditAvatarFile] = useState(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const avatarInputRef = useRef(null);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await userAPI.getProfile(username);
      setProfileData(data.user);
      setPosts(data.posts || []);
    } catch (err) {
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [username]);

  const handleToggleFollow = async () => {
    if (!profileData) return;
    const isCurrentlyFollowing = profileData.isFollowing;
    try {
      if (isCurrentlyFollowing) {
        await socialAPI.unfollowUser(profileData.id);
        setProfileData((prev) => ({
          ...prev,
          isFollowing: false,
          followersCount: Math.max(0, prev.followersCount - 1),
        }));
      } else {
        await socialAPI.followUser(profileData.id);
        setProfileData((prev) => ({
          ...prev,
          isFollowing: true,
          followersCount: prev.followersCount + 1,
        }));
      }
    } catch (err) {
      alert(err.message || 'Follow action failed');
    }
  };

  const openEditModal = () => {
    setEditName(profileData.name || '');
    setEditBio(profileData.bio || '');
    setEditAvatarFile(null);
    setEditAvatarPreview(profileData.profilePicture || null);
    setIsEditing(true);
  };

  const handleAvatarFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditAvatarFile(file);
      setEditAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setEditSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('name', editName.trim());
      formData.append('bio', editBio.trim());
      if (editAvatarFile) {
        formData.append('profilePicture', editAvatarFile);
      }

      const response = await authAPI.updateProfile(formData);
      updateUser(response.user);
      setProfileData((prev) => ({
        ...prev,
        name: response.user.name,
        bio: response.user.bio,
        profilePicture: response.user.profilePicture,
      }));
      setIsEditing(false);
    } catch (err) {
      alert(err.message || 'Failed to update profile');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Delete this post?')) return;
    try {
      await postAPI.deletePost(postId);
      setPosts((prev) => prev.filter((p) => p._id !== postId));
      setProfileData((prev) => ({
        ...prev,
        postsCount: Math.max(0, prev.postsCount - 1),
      }));
    } catch (err) {
      alert(err.message || 'Failed to delete post');
    }
  };

  const handleToggleLike = async (postId) => {
    try {
      const data = await socialAPI.toggleLike(postId);
      setPosts((prev) =>
        prev.map((p) =>
          p._id === postId
            ? { ...p, isLiked: data.liked, likesCount: data.likeCount }
            : p
        )
      );
    } catch (err) {
      console.error('Failed to toggle like:', err.message);
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
        setCommentsMap((prev) => ({ ...prev, [postId]: data.comments || [] }));
      } catch (err) {
        console.error('Failed to load comments:', err.message);
      } finally {
        setCommentLoading(false);
      }
    }
  };

  const handleAddComment = async (postId) => {
    const text = commentInputs[postId]?.trim();
    if (!text) return;
    try {
      const data = await socialAPI.addComment(postId, text);
      setCommentsMap((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), data.comment],
      }));
      setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
      setPosts((prev) =>
        prev.map((p) =>
          p._id === postId ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p
        )
      );
    } catch (err) {
      alert(err.message || 'Failed to add comment');
    }
  };

  const handleDeleteComment = async (postId, commentId) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await socialAPI.deleteComment(commentId);
      setCommentsMap((prev) => ({
        ...prev,
        [postId]: (prev[postId] || []).filter((c) => c._id !== commentId),
      }));
      setPosts((prev) =>
        prev.map((p) =>
          p._id === postId ? { ...p, commentsCount: Math.max(0, (p.commentsCount || 0) - 1) } : p
        )
      );
    } catch (err) {
      alert(err.message || 'Failed to delete comment');
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
        <Loader2 size={32} className="spin" style={{ margin: '0 auto 1rem' }} />
        <p>Loading profile...</p>
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem', maxWidth: '600px', margin: '0 auto' }}>
        <h3>User Not Found</h3>
        <p style={{ color: 'var(--text-secondary)', margin: '0.8rem 0' }}>{error || 'This user does not exist.'}</p>
        <Link to="/" className="btn btn-sm">Return Home</Link>
      </div>
    );
  }

  const isSelf = profileData.isSelf || profileData.id === currentUser?.id;

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', width: '100%' }}>
      {/* Profile Header Card */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.2rem' }}>
          <Avatar src={profileData.profilePicture} size={84} />

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2>{profileData.name}</h2>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  @{profileData.username} • <span className="badge badge-info">{profileData.userType}</span>
                </div>
              </div>

              {isSelf ? (
                <button onClick={openEditModal} className="btn btn-secondary btn-sm">
                  <Edit3 size={16} /> Edit Profile
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={handleToggleFollow}
                    className={`btn btn-sm ${profileData.isFollowing ? 'btn-secondary' : ''}`}
                  >
                    {profileData.isFollowing ? (
                      <>
                        <UserCheck size={16} /> Following
                      </>
                    ) : (
                      <>
                        <UserPlus size={16} /> Follow
                      </>
                    )}
                  </button>

                  <Link to={`/messages?userId=${profileData.id}`} className="btn btn-secondary btn-sm">
                    <MessageSquare size={16} /> Message
                  </Link>
                </div>
              )}
            </div>

            {profileData.bio && (
              <p style={{ marginTop: '0.8rem', fontSize: '0.95rem', lineHeight: 1.4 }}>
                {profileData.bio}
              </p>
            )}
          </div>
        </div>

        {/* Stats Bar */}
        <div className="user-stats">
          <div className="stat-item">
            <span className="stat-value">{profileData.postsCount || 0}</span>
            <span className="stat-label">Posts</span>
          </div>
          <div
            className="stat-item"
            style={{ cursor: 'pointer', userSelect: 'none' }}
            onClick={() => {
              setFollowModalTab('followers');
              setFollowModalOpen(true);
            }}
            title="Click to view followers"
          >
            <span className="stat-value">{profileData.followersCount || 0}</span>
            <span className="stat-label">Followers</span>
          </div>
          <div
            className="stat-item"
            style={{ cursor: 'pointer', userSelect: 'none' }}
            onClick={() => {
              setFollowModalTab('following');
              setFollowModalOpen(true);
            }}
            title="Click to view following"
          >
            <span className="stat-value">{profileData.followingCount || 0}</span>
            <span className="stat-label">Following</span>
          </div>
        </div>
      </div>

      {/* User Posts Stream */}
      <h3 style={{ margin: '1.5rem 0 1rem', fontSize: '1.1rem' }}>Posts by {profileData.name}</h3>

      {posts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-secondary)' }}>
          No posts shared yet.
        </div>
      ) : (
        posts.map((post) => (
          <div key={post._id} className="card">
            <div className="post-header" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <Avatar src={profileData.profilePicture} size={40} />
                <div>
                  <div style={{ fontWeight: 600 }}>{profileData.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {new Date(post.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>

              {(isSelf || currentUser?.userType === 'Admin') && (
                <button
                  onClick={() => handleDeletePost(post._id)}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '0.3rem', color: '#f87171' }}
                  title="Delete post"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            {post.text && <p className="post-content">{post.text}</p>}
            {post.image && <img src={post.image} alt="" className="post-media" />}

            <div className="post-footer">
              <button
                className="engagement-btn"
                onClick={() => handleToggleLike(post._id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.85rem',
                }}
              >
                <Heart
                  size={18}
                  fill={post.isLiked ? '#f43f5e' : 'none'}
                  color={post.isLiked ? '#f43f5e' : 'currentColor'}
                />
                <span>{post.likesCount || 0} Likes</span>
              </button>
              <button
                className="engagement-btn"
                onClick={() => handleToggleComments(post._id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.85rem',
                }}
              >
                <MessageSquare size={18} />
                <span>{post.commentsCount || 0} Comments</span>
              </button>
            </div>

            {/* Comments Section */}
            {activeCommentPostId === post._id && (
              <div
                className="comments-section"
                style={{
                  marginTop: '1rem',
                  borderTop: '1px solid var(--border-color)',
                  paddingTop: '0.8rem',
                }}
              >
                {commentLoading && !commentsMap[post._id] ? (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Loading comments...
                  </p>
                ) : (commentsMap[post._id] || []).length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.8rem' }}>
                    No comments yet. Start the conversation!
                  </p>
                ) : (
                  (commentsMap[post._id] || []).map((c) => (
                    <div
                      key={c._id}
                      className="comment-item"
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.6rem',
                        marginBottom: '0.7rem',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', flex: 1, minWidth: 0 }}>
                        <Link
                          to={`/profile/${c.authorId?.username}`}
                          style={{ textDecoration: 'none', color: 'inherit', flexShrink: 0 }}
                          title={`Visit @${c.authorId?.username}'s profile`}
                        >
                          <Avatar src={c.authorId?.profilePicture} size={28} />
                        </Link>
                        <div
                          className="comment-bubble"
                          style={{
                            backgroundColor: 'var(--bg-secondary)',
                            padding: '0.5rem 0.8rem',
                            borderRadius: '12px',
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          <Link
                            to={`/profile/${c.authorId?.username}`}
                            style={{
                              fontWeight: 600,
                              fontSize: '0.8rem',
                              textDecoration: 'none',
                              color: 'inherit',
                              display: 'inline-block',
                              marginBottom: '0.2rem',
                            }}
                            title={`Visit @${c.authorId?.username}'s profile`}
                          >
                            @{c.authorId?.username || 'user'}
                          </Link>
                          <div style={{ fontSize: '0.85rem', wordBreak: 'break-word' }}>{c.text}</div>
                        </div>
                      </div>

                      {(c.authorId?._id === currentUser?.id || isSelf || currentUser?.userType === 'Admin') && (
                        <button
                          onClick={() => handleDeleteComment(post._id, c._id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            padding: '0.2rem',
                            marginLeft: '0.4rem',
                            flexShrink: 0,
                          }}
                          title="Delete comment"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
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
        ))
      )}

      {/* Edit Profile Modal */}
      {isEditing && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem',
        }}>
          <div className="card" style={{ maxWidth: '440px', width: '100%', position: 'relative' }}>
            <button
              onClick={() => setIsEditing(false)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              <X size={20} />
            </button>

            <h3 style={{ marginBottom: '1.2rem' }}>Edit Profile</h3>

            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Avatar Selector from Device */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Avatar src={editAvatarPreview || profileData.profilePicture} size={64} />

                <div>
                  <input
                    type="file"
                    ref={avatarInputRef}
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleAvatarFileChange}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    <Camera size={14} /> Upload from Device
                  </button>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    JPG, PNG, or WEBP up to 5MB
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                  Display Name
                </label>
                <input
                  type="text"
                  className="text-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                  Bio
                </label>
                <textarea
                  className="textarea-input"
                  rows="3"
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Tell others about yourself..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.8rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setIsEditing(false)} className="btn btn-secondary btn-sm">
                  Cancel
                </button>
                <button type="submit" className="btn btn-sm" disabled={editSubmitting}>
                  {editSubmitting ? <Loader2 size={16} className="spin" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Followers & Following Modal */}
      <FollowListModal
        isOpen={followModalOpen}
        onClose={() => setFollowModalOpen(false)}
        userId={profileData.id}
        initialTab={followModalTab}
        currentUserId={currentUser?.id}
        onFollowChange={fetchProfile}
      />
    </div>
  );
};
