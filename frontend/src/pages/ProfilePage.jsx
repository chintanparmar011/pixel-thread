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
  Trash2 
} from 'lucide-react';

export const ProfilePage = () => {
  const { username } = useParams();
  const { user: currentUser, updateUser } = useAuth();
  const [profileData, setProfileData] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
          <div className="avatar" style={{ width: '84px', height: '84px', fontSize: '2rem' }}>
            {profileData.profilePicture ? (
              <img src={profileData.profilePicture} alt={profileData.name} />
            ) : (
              profileData.name.charAt(0).toUpperCase()
            )}
          </div>

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
          <div className="stat-item">
            <span className="stat-value">{profileData.followersCount || 0}</span>
            <span className="stat-label">Followers</span>
          </div>
          <div className="stat-item">
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
                <div className="avatar">
                  {profileData.profilePicture ? (
                    <img src={profileData.profilePicture} alt="" />
                  ) : (
                    profileData.name.charAt(0)
                  )}
                </div>
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
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            {post.text && <p className="post-content">{post.text}</p>}
            {post.image && <img src={post.image} alt="" className="post-media" />}

            <div className="post-footer">
              <span className="engagement-btn">
                <Heart size={16} fill={post.isLiked ? '#f43f5e' : 'none'} color={post.isLiked ? '#f43f5e' : 'currentColor'} />
                <span>{post.likesCount || 0} Likes</span>
              </span>
              <span className="engagement-btn">
                <MessageSquare size={16} />
                <span>{post.commentsCount || 0} Comments</span>
              </span>
            </div>
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
                <div className="avatar" style={{ width: '64px', height: '64px', position: 'relative' }}>
                  {editAvatarPreview ? (
                    <img src={editAvatarPreview} alt="Avatar preview" />
                  ) : (
                    editName.charAt(0) || 'U'
                  )}
                </div>

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
    </div>
  );
};
