import axios from 'axios';

export const API_BASE_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('pixelthread_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.message || error.message || 'Something went wrong';
    return Promise.reject(new Error(message));
  }
);

export const authAPI = {
  signup: (formData) => api.post('/auth/signup', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  signin: (credentials) => api.post('/auth/signin', credentials),
  getMe: () => api.get('/auth/me'),
  updateProfile: (formData) => api.put('/auth/profile', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  logout: () => api.post('/auth/logout'),
};

export const postAPI = {
  getFeed: (page = 1, limit = 20) => api.get(`/posts/feed?page=${page}&limit=${limit}`),
  getExplorePosts: (params = {}) => api.get('/posts/explore', { params }),
  getPostById: (postId) => api.get(`/posts/${postId}`),
  getUserPosts: (userId) => api.get(`/posts/user/${userId}`),
  createPost: (formData) => api.post('/posts', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  toggleRepost: (postId) => api.post(`/posts/${postId}/repost`),
  deletePost: (postId) => api.delete(`/posts/${postId}`),
};

export const socialAPI = {
  toggleLike: (postId) => api.post(`/likes/${postId}`),
  getLikes: (postId) => api.get(`/likes/${postId}`),
  getComments: (postId) => api.get(`/comments/${postId}`),
  addComment: (postId, text, parentId = null) => api.post(`/comments/${postId}`, { text, parentId }),
  deleteComment: (commentId) => api.delete(`/comments/${commentId}`),
  followUser: (userId) => api.post(`/follows/${userId}`),
  unfollowUser: (userId) => api.delete(`/follows/${userId}`),
  getFollowers: (userId) => api.get(`/follows/${userId}/followers`),
  getFollowing: (userId) => api.get(`/follows/${userId}/following`),
  getFollowStatus: (userId) => api.get(`/follows/${userId}/status`),
};

export const userAPI = {
  searchUsers: (query) => api.get(`/users/search?q=${encodeURIComponent(query)}`),
  getSuggested: () => api.get('/users/suggested'),
  getProfile: (username) => api.get(`/users/${username}`),
};

export const messageAPI = {
  getConversations: () => api.get('/messages/conversations'),
  getChatHistory: (userId, page = 1) => api.get(`/messages/${userId}?page=${page}`),
  uploadMedia: (formData) => api.post('/messages/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  reactMessage: (messageId, emoji) => api.post(`/messages/${messageId}/react`, { emoji }),
};

export const storyAPI = {
  getFeed: () => api.get('/stories/feed'),
  createStory: (formData) => api.post('/stories', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  viewStory: (storyId) => api.post(`/stories/${storyId}/view`),
  deleteStory: (storyId) => api.delete(`/stories/${storyId}`),
};

export const adminAPI = {
  getStats: () => api.get('/admin/stats'),
  getUsers: (params) => api.get('/admin/users', { params }),
  updateUserStatus: (userId, action) => api.patch(`/admin/users/${userId}/status`, { action }),
  getPosts: (params) => api.get('/admin/posts', { params }),
  deletePost: (postId) => api.delete(`/admin/posts/${postId}`),
  getLogs: (params) => api.get('/admin/logs', { params }),
};

export const notificationAPI = {
  getNotifications: (page = 1, limit = 30) => api.get(`/notifications?page=${page}&limit=${limit}`),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllAsRead: () => api.patch('/notifications/read-all'),
  deleteNotification: (id) => api.delete(`/notifications/${id}`),
};

export const groupAPI = {
  createGroup: (formData) => api.post('/groups', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getUserGroups: () => api.get('/groups'),
  getGroupDetails: (groupId) => api.get(`/groups/${groupId}`),
  updateGroup: (groupId, formData) => api.put(`/groups/${groupId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getGroupMessages: (groupId) => api.get(`/groups/${groupId}/messages`),
  joinGroup: (groupId) => api.post(`/groups/${groupId}/join`),
  leaveGroup: (groupId) => api.post(`/groups/${groupId}/leave`),
};

export default api;
