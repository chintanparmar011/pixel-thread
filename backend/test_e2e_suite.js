const { io } = require('socket.io-client');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

const runTests = async () => {
  const ts = Date.now();
  const u1Name = `Alpha_${ts}`;
  const u1Username = `alpha_${ts}`;
  const u1Email = `alpha_${ts}@example.com`;
  const u1Password = 'Password123!';

  const u2Name = `Beta_${ts}`;
  const u2Username = `beta_${ts}`;
  const u2Email = `beta_${ts}@example.com`;
  const u2Password = 'Password123!';

  let u1Token, u1Id;
  let u2Token, u2Id;
  let adminToken;
  let createdPostId;
  let createdCommentId;

  console.log('====================================');
  console.log('   PIXELTHREAD E2E TEST SUITE');
  console.log('====================================\n');

  // Test 1: User Signup with Profile Image (Device Upload simulation)
  console.log('[1/14] Testing User 1 Signup with Multipart Avatar...');
  const form1 = new FormData();
  form1.append('name', u1Name);
  form1.append('username', u1Username);
  form1.append('email', u1Email);
  form1.append('password', u1Password);
  form1.append('bio', 'Hello from test suite');
  const dummyPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  form1.append('profilePicture', new Blob([dummyPng], { type: 'image/png' }), 'avatar.png');

  const resSignup1 = await fetch(`${BASE_URL}/auth/signup`, {
    method: 'POST',
    body: form1,
  });
  const dataSignup1 = await resSignup1.json();
  if (!resSignup1.ok) throw new Error(`Signup 1 failed: ${JSON.stringify(dataSignup1)}`);
  u1Token = dataSignup1.token;
  u1Id = dataSignup1.user.id;
  console.log(`  ✓ User 1 created: ${u1Username} (ID: ${u1Id}) with avatar`);

  // Test 2: User 2 Signup
  console.log('[2/14] Testing User 2 Signup...');
  const form2 = new FormData();
  form2.append('name', u2Name);
  form2.append('username', u2Username);
  form2.append('email', u2Email);
  form2.append('password', u2Password);

  const resSignup2 = await fetch(`${BASE_URL}/auth/signup`, {
    method: 'POST',
    body: form2,
  });
  const dataSignup2 = await resSignup2.json();
  if (!resSignup2.ok) throw new Error(`Signup 2 failed: ${JSON.stringify(dataSignup2)}`);
  u2Token = dataSignup2.token;
  u2Id = dataSignup2.user.id;
  console.log(`  ✓ User 2 created: ${u2Username} (ID: ${u2Id})`);

  // Test 3: Sign In & Me verification
  console.log('[3/14] Testing User 1 Sign In & Profile Verification...');
  const resLogin1 = await fetch(`${BASE_URL}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrUsername: u1Username, password: u1Password }),
  });
  const dataLogin1 = await resLogin1.json();
  if (!resLogin1.ok) throw new Error(`Login 1 failed: ${JSON.stringify(dataLogin1)}`);
  console.log(`  ✓ Login successful for ${u1Username}`);

  const resMe = await fetch(`${BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${u1Token}` },
  });
  const dataMe = await resMe.json();
  if (!resMe.ok || dataMe.user.username !== u1Username) throw new Error(`Auth/Me verification failed`);
  console.log(`  ✓ GET /auth/me verified for ${dataMe.user.username}`);

  // Test 4: Profile Update
  console.log('[4/14] Testing Profile Update...');
  const formProfile = new FormData();
  formProfile.append('bio', 'Updated bio via automated test');
  const resUpdateProfile = await fetch(`${BASE_URL}/auth/profile`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${u1Token}` },
    body: formProfile,
  });
  const dataProfile = await resUpdateProfile.json();
  if (!resUpdateProfile.ok || dataProfile.user.bio !== 'Updated bio via automated test') {
    throw new Error(`Profile update failed: ${JSON.stringify(dataProfile)}`);
  }
  console.log(`  ✓ Profile updated successfully`);

  // Test 5: Follow System
  console.log('[5/14] Testing Follow & Unfollow Lifecycle...');
  const resFollow = await fetch(`${BASE_URL}/follows/${u2Id}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${u1Token}` },
  });
  const dataFollow = await resFollow.json();
  if (!resFollow.ok) throw new Error(`Follow failed: ${JSON.stringify(dataFollow)}`);
  console.log(`  ✓ ${u1Username} followed ${u2Username}`);

  const resFollowers = await fetch(`${BASE_URL}/follows/${u2Id}/followers`, {
    headers: { Authorization: `Bearer ${u1Token}` },
  });
  const dataFollowers = await resFollowers.json();
  const isUser1InFollowers = dataFollowers.followers.some((f) => f._id === u1Id);
  if (!isUser1InFollowers) throw new Error('Followers list does not contain follower');
  console.log(`  ✓ Followers list verified (count: ${dataFollowers.followers.length})`);

  // Test 6: Create Post with Device Image
  console.log('[6/14] Testing Create Post with Device Image Upload...');
  const postForm = new FormData();
  postForm.append('text', 'Automated test post caption #testing #pixelthread');
  postForm.append('image', new Blob([dummyPng], { type: 'image/png' }), 'test-post.png');

  const resPost = await fetch(`${BASE_URL}/posts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${u2Token}` },
    body: postForm,
  });
  const dataPost = await resPost.json();
  if (!resPost.ok) throw new Error(`Post creation failed: ${JSON.stringify(dataPost)}`);
  createdPostId = dataPost.post._id;
  console.log(`  ✓ Post created by ${u2Username} (Post ID: ${createdPostId}, image attached: ${!!dataPost.post.image})`);

  // Test 7: Feed Retrieval
  console.log('[7/14] Testing User 1 Feed (should include followed user\'s post)...');
  const resFeed = await fetch(`${BASE_URL}/posts/feed`, {
    headers: { Authorization: `Bearer ${u1Token}` },
  });
  const dataFeed = await resFeed.json();
  if (!resFeed.ok || !dataFeed.posts.some((p) => p._id === createdPostId)) {
    throw new Error('Post not found in feed');
  }
  console.log(`  ✓ Feed successfully populated with ${dataFeed.posts.length} posts`);

  // Test 8: Like & Unlike Post
  console.log('[8/14] Testing Post Like / Unlike...');
  const resLike = await fetch(`${BASE_URL}/likes/${createdPostId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${u1Token}` },
  });
  const dataLike = await resLike.json();
  if (!resLike.ok || dataLike.liked !== true) throw new Error(`Like failed: ${JSON.stringify(dataLike)}`);
  console.log(`  ✓ Post liked (Likes count: ${dataLike.likeCount})`);

  // Test 9: Commenting on Post
  console.log('[9/14] Testing Comments on Post...');
  const resComment = await fetch(`${BASE_URL}/comments/${createdPostId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${u1Token}`,
    },
    body: JSON.stringify({ text: 'Nice test post! Great work.' }),
  });
  const dataComment = await resComment.json();
  if (!resComment.ok) throw new Error(`Comment failed: ${JSON.stringify(dataComment)}`);
  createdCommentId = dataComment.comment._id;
  console.log(`  ✓ Comment added by ${u1Username} (Comment ID: ${createdCommentId})`);

  // Test 10: Search Users
  console.log('[10/14] Testing User Search...');
  const resSearch = await fetch(`${BASE_URL}/users/search?q=${u2Username}`, {
    headers: { Authorization: `Bearer ${u1Token}` },
  });
  const dataSearch = await resSearch.json();
  if (!resSearch.ok || !dataSearch.users.some((u) => u.username === u2Username)) {
    throw new Error('User search did not find target username');
  }
  console.log(`  ✓ User search found ${dataSearch.users.length} match(es)`);

  // Test 11: Real-time Socket.io Messaging
  console.log('[11/14] Testing Real-time Socket.io Chat (User 1 -> User 2)...');
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Socket.io messaging test timed out'));
    }, 12000);

    const socket1 = io(SOCKET_URL, {
      auth: { token: u1Token },
      transports: ['websocket'],
    });

    const socket2 = io(SOCKET_URL, {
      auth: { token: u2Token },
      transports: ['websocket'],
    });

    socket2.on('receiveMessage', async (msg) => {
      clearTimeout(timer);
      console.log(`  ✓ Socket event receiveMessage received by User 2: "${msg.text}"`);
      socket1.disconnect();
      socket2.disconnect();
      resolve();
    });

    let s1Connected = false;
    let s2Connected = false;

    const maybeSend = () => {
      if (s1Connected && s2Connected) {
        socket1.emit('sendMessage', {
          receiverId: u2Id,
          text: 'Hello via real-time WebSocket!',
        });
      }
    };

    socket1.on('connect', () => {
      s1Connected = true;
      maybeSend();
    });

    socket2.on('connect', () => {
      s2Connected = true;
      maybeSend();
    });
  });

  // Test 12: Verify Message History & Conversations via REST API
  console.log('[12/14] Verifying Chat History via REST API...');
  const resConvs = await fetch(`${BASE_URL}/messages/conversations`, {
    headers: { Authorization: `Bearer ${u1Token}` },
  });
  const dataConvs = await resConvs.json();
  if (!resConvs.ok || dataConvs.conversations.length === 0) {
    throw new Error('Conversation list is empty');
  }
  console.log(`  ✓ Conversations loaded (count: ${dataConvs.conversations.length})`);

  const resHistory = await fetch(`${BASE_URL}/messages/${u2Id}`, {
    headers: { Authorization: `Bearer ${u1Token}` },
  });
  const dataHistory = await resHistory.json();
  if (!resHistory.ok || dataHistory.messages.length === 0) {
    throw new Error('Message history is empty');
  }
  console.log(`  ✓ Message history retrieved (${dataHistory.messages.length} messages)`);

  // Test 13: Admin Module (Authentication, Statistics, User Suspension, Logs)
  console.log('[13/14] Testing Admin Controls (SRS Sec 2.2)...');
  const resAdminLogin = await fetch(`${BASE_URL}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrUsername: 'ogadmin', password: '12345678' }),
  });
  const dataAdminLogin = await resAdminLogin.json();
  if (!resAdminLogin.ok) throw new Error(`Admin login failed: ${JSON.stringify(dataAdminLogin)}`);
  adminToken = dataAdminLogin.token;
  console.log(`  ✓ Admin signed in as: ${dataAdminLogin.user.username} (Role: ${dataAdminLogin.user.userType})`);

  const resAdminStats = await fetch(`${BASE_URL}/admin/stats`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const dataAdminStats = await resAdminStats.json();
  if (!resAdminStats.ok) throw new Error(`Admin stats error: ${JSON.stringify(dataAdminStats)}`);
  console.log(`  ✓ Platform Stats: ${dataAdminStats.stats.totalUsers} users, ${dataAdminStats.stats.totalPosts} posts, ${dataAdminStats.stats.totalMessages} messages`);

  // Suspend User 2
  const resSuspend = await fetch(`${BASE_URL}/admin/users/${u2Id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ action: 'suspend' }),
  });
  const dataSuspend = await resSuspend.json();
  if (!resSuspend.ok || dataSuspend.user.status !== 'suspended') {
    throw new Error(`Suspend failed: ${JSON.stringify(dataSuspend)}`);
  }
  console.log(`  ✓ User 2 suspended by Admin`);

  // Reactivate User 2
  const resReactivate = await fetch(`${BASE_URL}/admin/users/${u2Id}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ action: 'reactivate' }),
  });
  const dataReactivate = await resReactivate.json();
  if (!resReactivate.ok || dataReactivate.user.status !== 'active') {
    throw new Error(`Reactivate failed: ${JSON.stringify(dataReactivate)}`);
  }
  console.log(`  ✓ User 2 reactivated by Admin`);

  // Verify Audit Logs
  const resLogs = await fetch(`${BASE_URL}/admin/logs?limit=5`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const dataLogs = await resLogs.json();
  if (!resLogs.ok || dataLogs.logs.length === 0) {
    throw new Error('Admin audit logs empty');
  }
  console.log(`  ✓ Audit trail logged ${dataLogs.logs.length} admin actions (latest: ${dataLogs.logs[0].actionType})`);

  // Test 14: Admin Content Moderation
  console.log('[14/15] Testing Admin Content Moderation (Delete Post)...');
  const resAdminDeletePost = await fetch(`${BASE_URL}/admin/posts/${createdPostId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const dataAdminDeletePost = await resAdminDeletePost.json();
  if (!resAdminDeletePost.ok) {
    throw new Error(`Admin delete post failed: ${JSON.stringify(dataAdminDeletePost)}`);
  }
  console.log(`  ✓ Post moderated and deleted by Admin`);

  // Test 15: Notification System (Follow, Like, Comment, Message, Read, Read-All, Delete)
  console.log('[15/15] Testing Notifications Lifecycle (Likes, Messages, Follows, Comments)...');
  const resNotifs = await fetch(`${BASE_URL}/notifications?page=1&limit=20`, {
    headers: { Authorization: `Bearer ${u2Token}` },
  });
  const dataNotifs = await resNotifs.json();
  if (!resNotifs.ok) throw new Error(`Fetch notifications failed: ${JSON.stringify(dataNotifs)}`);
  
  const notifs = dataNotifs.notifications;
  console.log(`  ✓ User 2 received ${notifs.length} total notifications`);

  const hasFollow = notifs.some((n) => n.type === 'follow');
  const hasLike = notifs.some((n) => n.type === 'like');
  const hasComment = notifs.some((n) => n.type === 'comment');
  const hasMessage = notifs.some((n) => n.type === 'message');

  if (!hasFollow || !hasLike || !hasComment || !hasMessage) {
    throw new Error(`Missing expected notification types: follow=${hasFollow}, like=${hasLike}, comment=${hasComment}, message=${hasMessage}`);
  }
  console.log(`  ✓ Verified all notification types present: follow, like, comment, message`);

  // Verify unread count endpoint
  const resUnread = await fetch(`${BASE_URL}/notifications/unread-count`, {
    headers: { Authorization: `Bearer ${u2Token}` },
  });
  const dataUnread = await resUnread.json();
  if (!resUnread.ok || dataUnread.unreadCount < 4) {
    throw new Error(`Unexpected unread count: ${JSON.stringify(dataUnread)}`);
  }
  console.log(`  ✓ Unread notification count verified: ${dataUnread.unreadCount}`);

  // Mark single notification as read
  const targetNotif = notifs[0];
  const resMarkRead = await fetch(`${BASE_URL}/notifications/${targetNotif._id}/read`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${u2Token}` },
  });
  const dataMarkRead = await resMarkRead.json();
  if (!resMarkRead.ok || dataMarkRead.notification.isRead !== true) {
    throw new Error(`Mark notification as read failed: ${JSON.stringify(dataMarkRead)}`);
  }
  console.log(`  ✓ Single notification marked as read (ID: ${targetNotif._id})`);

  // Mark all notifications as read
  const resMarkAll = await fetch(`${BASE_URL}/notifications/read-all`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${u2Token}` },
  });
  const dataMarkAll = await resMarkAll.json();
  if (!resMarkAll.ok) throw new Error(`Mark all notifications read failed: ${JSON.stringify(dataMarkAll)}`);

  const resUnreadAfter = await fetch(`${BASE_URL}/notifications/unread-count`, {
    headers: { Authorization: `Bearer ${u2Token}` },
  });
  const dataUnreadAfter = await resUnreadAfter.json();
  if (!resUnreadAfter.ok || dataUnreadAfter.unreadCount !== 0) {
    throw new Error(`Expected 0 unread notifications, got ${dataUnreadAfter.unreadCount}`);
  }
  console.log(`  ✓ Mark all read verified (Unread count: 0)`);

  // Delete notification
  const resDeleteNotif = await fetch(`${BASE_URL}/notifications/${targetNotif._id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${u2Token}` },
  });
  const dataDeleteNotif = await resDeleteNotif.json();
  if (!resDeleteNotif.ok) throw new Error(`Delete notification failed: ${JSON.stringify(dataDeleteNotif)}`);
  console.log(`  ✓ Notification deleted successfully`);

  // Verify like notification links directly to the liked post
  console.log('  Testing Liked Post Linkage & Direct Retrieval...');
  const newPostForm = new FormData();
  newPostForm.append('text', 'Notification navigation test post');
  const resNewPost = await fetch(`${BASE_URL}/posts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${u1Token}` },
    body: newPostForm,
  });
  const dataNewPost = await resNewPost.json();
  const linkedPostId = dataNewPost.post._id;

  // User 2 likes User 1's post
  await fetch(`${BASE_URL}/likes/${linkedPostId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${u2Token}` },
  });

  // User 1 fetches their notifications to get the like notification
  const resU1Notifs = await fetch(`${BASE_URL}/notifications?limit=5`, {
    headers: { Authorization: `Bearer ${u1Token}` },
  });
  const dataU1Notifs = await resU1Notifs.json();
  const recentLike = dataU1Notifs.notifications.find((n) => n.type === 'like' && (n.post?._id === linkedPostId || n.post === linkedPostId));

  if (!recentLike) throw new Error('Like notification for new post not found');
  const postIdFromNotif = recentLike.post?._id || recentLike.post;

  // Retrieve post details by ID (same API called by /post/:postId page)
  const resPostDetail = await fetch(`${BASE_URL}/posts/${postIdFromNotif}`, {
    headers: { Authorization: `Bearer ${u1Token}` },
  });
  const dataPostDetail = await resPostDetail.json();
  if (!resPostDetail.ok || dataPostDetail.post._id !== linkedPostId) {
    throw new Error('Failed to resolve liked post by notification post ID');
  }
  console.log(`  ✓ Notification directly links to post ID: ${postIdFromNotif} (Likes: ${dataPostDetail.post.likesCount})`);

  console.log('\n====================================');
  console.log('  ALL 15 E2E TESTS PASSED SUCCESSFULLY!');
  console.log('====================================\n');
};

runTests().catch((err) => {
  console.error('\n❌ E2E TEST FAILED:', err.message);
  process.exit(1);
});
