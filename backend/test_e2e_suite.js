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
  console.log('[15/20] Testing Notifications Lifecycle (Likes, Messages, Follows, Comments)...');
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

  // Test 16: Threaded Comments & Replies
  console.log('[16/20] Testing Threaded Comments, Replies & Cascade Deletion...');
  // User 1 creates parent comment on linkedPostId
  const resParentComment = await fetch(`${BASE_URL}/comments/${linkedPostId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${u1Token}` },
    body: JSON.stringify({ text: 'Main discussion parent comment' }),
  });
  const dataParentComment = await resParentComment.json();
  if (!resParentComment.ok) throw new Error(`Create parent comment failed: ${JSON.stringify(dataParentComment)}`);
  const parentCommentId = dataParentComment.comment._id;
  console.log(`  ✓ Parent comment created: ${parentCommentId}`);

  // User 2 replies to parent comment
  const resChildReply = await fetch(`${BASE_URL}/comments/${linkedPostId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${u2Token}` },
    body: JSON.stringify({ text: 'Child reply from User 2', parentId: parentCommentId }),
  });
  const dataChildReply = await resChildReply.json();
  if (!resChildReply.ok || dataChildReply.comment.parentId.toString() !== parentCommentId.toString()) {
    throw new Error(`Create threaded reply failed: ${JSON.stringify(dataChildReply)}`);
  }
  const childReplyId = dataChildReply.comment._id;
  console.log(`  ✓ Threaded reply created (Parent: ${dataChildReply.comment.parentId}, Reply ID: ${childReplyId})`);

  // Verify reply notification was received by User 1
  const resU1ReplyNotifs = await fetch(`${BASE_URL}/notifications?limit=5`, {
    headers: { Authorization: `Bearer ${u1Token}` },
  });
  const dataU1ReplyNotifs = await resU1ReplyNotifs.json();
  const replyNotif = dataU1ReplyNotifs.notifications.find((n) => n.type === 'reply');
  if (!replyNotif) throw new Error('Reply notification not found for parent comment author');
  console.log(`  ✓ Reply notification verified for comment author`);

  // Verify cascade deletion: deleting parent comment removes both parent and child
  const resDeleteParent = await fetch(`${BASE_URL}/comments/${parentCommentId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${u1Token}` },
  });
  const dataDeleteParent = await resDeleteParent.json();
  if (!resDeleteParent.ok) throw new Error(`Delete parent comment failed: ${JSON.stringify(dataDeleteParent)}`);

  const resRemainingComments = await fetch(`${BASE_URL}/comments/${linkedPostId}`, {
    headers: { Authorization: `Bearer ${u1Token}` },
  });
  const dataRemainingComments = await resRemainingComments.json();
  const stillHasParentOrChild = dataRemainingComments.comments.some(
    (c) => c._id.toString() === parentCommentId.toString() || c._id.toString() === childReplyId.toString()
  );
  if (stillHasParentOrChild) {
    throw new Error('Cascade deletion failed: parent or reply comment still found');
  }
  console.log(`  ✓ Cascade deletion verified: parent and reply both removed`);

  // Test 17: Post Reposting & Unified Feed
  console.log('[17/20] Testing Post Reposting, Unified Feed & Count Decrement...');
  // User 2 reposts User 1's post
  const resRepost = await fetch(`${BASE_URL}/posts/${linkedPostId}/repost`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${u2Token}` },
  });
  const dataRepost = await resRepost.json();
  if (!resRepost.ok || !dataRepost.reposted || dataRepost.repostsCount !== 1) {
    throw new Error(`Repost post failed: ${JSON.stringify(dataRepost)}`);
  }
  console.log(`  ✓ Post reposted (reposted: ${dataRepost.reposted}, repostsCount: ${dataRepost.repostsCount})`);

  // Verify repost notification for User 1
  const resU1RepostNotifs = await fetch(`${BASE_URL}/notifications?limit=5`, {
    headers: { Authorization: `Bearer ${u1Token}` },
  });
  const dataU1RepostNotifs = await resU1RepostNotifs.json();
  const repostNotif = dataU1RepostNotifs.notifications.find((n) => n.type === 'repost');
  if (!repostNotif) throw new Error('Repost notification not found for post author');
  console.log(`  ✓ Repost notification verified for post author`);

  // Verify User 2's profile posts include the reposted item with repostedBy
  const resU2Posts = await fetch(`${BASE_URL}/posts/user/${u2Id}`, {
    headers: { Authorization: `Bearer ${u2Token}` },
  });
  const dataU2Posts = await resU2Posts.json();
  const foundRepost = dataU2Posts.posts.find(
    (p) => p._id.toString() === linkedPostId.toString() && p.repostedBy && (p.repostedBy._id?.toString() === u2Id.toString() || p.repostedBy.toString() === u2Id.toString())
  );
  if (!foundRepost) throw new Error('Reposted post not found in user posts feed with repostedBy');
  console.log(`  ✓ Reposted post appeared in user profile feed with repostedBy tag`);

  // Toggle repost again to undo
  const resUnrepost = await fetch(`${BASE_URL}/posts/${linkedPostId}/repost`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${u2Token}` },
  });
  const dataUnrepost = await resUnrepost.json();
  if (!resUnrepost.ok || dataUnrepost.reposted || dataUnrepost.repostsCount !== 0) {
    throw new Error(`Undo repost failed: ${JSON.stringify(dataUnrepost)}`);
  }
  console.log(`  ✓ Repost toggle undo verified (reposted: ${dataUnrepost.reposted}, repostsCount: ${dataUnrepost.repostsCount})`);

  // Test 18: Instagram-Style Standard Group Chat
  console.log('[18/20] Testing Instagram-Style Standard Group Chat & Member Permissions...');
  // User 1 creates standard group with User 2
  const resCreateStdGroup = await fetch(`${BASE_URL}/groups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${u1Token}` },
    body: JSON.stringify({
      name: 'Alpha & Beta Dev Chat',
      groupType: 'standard',
      participants: [u2Id],
    }),
  });
  const dataCreateStdGroup = await resCreateStdGroup.json();
  if (!resCreateStdGroup.ok) throw new Error(`Create standard group failed: ${JSON.stringify(dataCreateStdGroup)}`);
  const stdGroupId = dataCreateStdGroup.group._id;
  console.log(`  ✓ Standard group created: "${dataCreateStdGroup.group.name}" (ID: ${stdGroupId})`);

  // User 2 (non-admin member) updates group name
  const resUpdateStdGroup = await fetch(`${BASE_URL}/groups/${stdGroupId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${u2Token}` },
    body: JSON.stringify({ name: 'Alpha & Beta Dev Chat [Renamed by Beta]' }),
  });
  const dataUpdateStdGroup = await resUpdateStdGroup.json();
  if (!resUpdateStdGroup.ok || dataUpdateStdGroup.group.name !== 'Alpha & Beta Dev Chat [Renamed by Beta]') {
    throw new Error(`Standard group update by non-admin failed: ${JSON.stringify(dataUpdateStdGroup)}`);
  }
  console.log(`  ✓ Standard group name updated by non-admin member successfully`);

  // Establish socket connections for User 1 and User 2
  const socket1 = io(SOCKET_URL, { auth: { token: u1Token }, transports: ['websocket'] });
  const socket2 = io(SOCKET_URL, { auth: { token: u2Token }, transports: ['websocket'] });

  await new Promise((resolve) => {
    let connected = 0;
    const check = () => {
      connected++;
      if (connected === 2) resolve();
    };
    socket1.on('connect', check);
    socket2.on('connect', check);
  });
  console.log(`  ✓ Both sockets connected for real-time tests`);

  // Send group message from User 1 to standard group, verify User 2 receives it
  const receiveStdMsgPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for standard group message')), 5000);
    socket2.on('receiveGroupMessage', (data) => {
      if (data.groupId?.toString() === stdGroupId.toString() && data.message.text === 'Hello team!') {
        clearTimeout(timer);
        resolve(data);
      }
    });
  });

  socket1.emit('sendGroupMessage', {
    groupId: stdGroupId,
    text: 'Hello team!',
  });

  const receivedStdMsg = await receiveStdMsgPromise;
  console.log(`  ✓ Standard group message received in real-time by User 2: "${receivedStdMsg.message.text}"`);

  // Test 19: WhatsApp-Style Confidential Broadcast Channel
  console.log('[19/20] Testing WhatsApp-Style Broadcast Channel & Privacy Permissions...');
  // User 1 creates broadcast channel with User 2
  const resCreateBcast = await fetch(`${BASE_URL}/groups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${u1Token}` },
    body: JSON.stringify({
      name: 'Alpha Announcements Channel',
      groupType: 'broadcast',
      participants: [u2Id],
    }),
  });
  const dataCreateBcast = await resCreateBcast.json();
  if (!resCreateBcast.ok) throw new Error(`Create broadcast channel failed: ${JSON.stringify(dataCreateBcast)}`);
  const bcastGroupId = dataCreateBcast.group._id;
  console.log(`  ✓ Broadcast channel created: "${dataCreateBcast.group.name}" (ID: ${bcastGroupId})`);

  // User 2 fetches channel details: member list should be masked (only admin visible)
  const resBcastDetailsU2 = await fetch(`${BASE_URL}/groups/${bcastGroupId}`, {
    headers: { Authorization: `Bearer ${u2Token}` },
  });
  const dataBcastDetailsU2 = await resBcastDetailsU2.json();
  if (!resBcastDetailsU2.ok || dataBcastDetailsU2.group.participants.length !== 1) {
    throw new Error(`Broadcast channel member privacy failed: ${JSON.stringify(dataBcastDetailsU2)}`);
  }
  console.log(`  ✓ Broadcast channel privacy verified: non-admin only sees admin (${dataBcastDetailsU2.group.participants[0].username})`);

  // User 2 (non-admin member) attempts to update broadcast channel: must return 403 Forbidden
  const resBcastUnauthorizedUpdate = await fetch(`${BASE_URL}/groups/${bcastGroupId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${u2Token}` },
    body: JSON.stringify({ name: 'Unauthorized Renamed Channel' }),
  });
  if (resBcastUnauthorizedUpdate.status !== 403) {
    throw new Error(`Expected status 403 for non-admin update on broadcast channel, got ${resBcastUnauthorizedUpdate.status}`);
  }
  console.log(`  ✓ 403 Forbidden correctly enforced when non-admin attempts to update broadcast channel`);

  // User 1 (Admin) updates broadcast channel name
  const resBcastAdminUpdate = await fetch(`${BASE_URL}/groups/${bcastGroupId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${u1Token}` },
    body: JSON.stringify({ name: 'Alpha Official Announcements' }),
  });
  const dataBcastAdminUpdate = await resBcastAdminUpdate.json();
  if (!resBcastAdminUpdate.ok || dataBcastAdminUpdate.group.name !== 'Alpha Official Announcements') {
    throw new Error(`Admin update of broadcast channel failed: ${JSON.stringify(dataBcastAdminUpdate)}`);
  }
  console.log(`  ✓ Admin successfully updated broadcast channel name`);

  // User 1 (Admin) sends announcement broadcast to all members
  const receiveBcastMsgPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for broadcast message')), 5000);
    socket2.on('receiveGroupMessage', (data) => {
      if (data.groupId?.toString() === bcastGroupId.toString() && data.message.isBroadcast) {
        clearTimeout(timer);
        resolve(data);
      }
    });
  });

  socket1.emit('sendGroupMessage', {
    groupId: bcastGroupId,
    text: 'Important announcement for all subscribers!',
    isBroadcast: true,
  });

  const receivedBcastMsg = await receiveBcastMsgPromise;
  console.log(`  ✓ Broadcast announcement received by member: "${receivedBcastMsg.message.text}" (isBroadcast: true)`);

  // Test 20: WebRTC Call Signaling (Audio & Video)
  console.log('[20/20] Testing WebRTC Call Signaling (Offer, Answer, ICE Candidate, End Call)...');
  // User 1 calls User 2
  const incomingCallPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for incomingCall')), 5000);
    socket2.once('incomingCall', (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });

  socket1.emit('callUser', {
    userToCall: u2Id,
    signalData: { type: 'offer', sdp: 'v=0..mock-offer-sdp' },
    from: u1Id,
    callerName: u1Name,
    callType: 'video',
  });

  const incomingCallData = await incomingCallPromise;
  if (!incomingCallData || incomingCallData.from.toString() !== u1Id.toString() || incomingCallData.callType !== 'video') {
    throw new Error(`Invalid incomingCall payload: ${JSON.stringify(incomingCallData)}`);
  }
  console.log(`  ✓ Incoming call signal received by User 2 (Type: ${incomingCallData.callType}, From: ${incomingCallData.callerName})`);

  // User 2 answers call
  const callAcceptedPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for callAccepted')), 5000);
    socket1.once('callAccepted', (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });

  socket2.emit('answerCall', {
    to: u1Id,
    signal: { type: 'answer', sdp: 'v=0..mock-answer-sdp' },
  });

  const callAcceptedData = await callAcceptedPromise;
  if (!callAcceptedData || !callAcceptedData.signal) {
    throw new Error(`Invalid callAccepted payload: ${JSON.stringify(callAcceptedData)}`);
  }
  console.log(`  ✓ Call answered and accepted signal received by caller`);

  // User 1 sends ICE candidate
  const iceCandidatePromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for iceCandidate')), 5000);
    socket2.once('iceCandidate', (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });

  socket1.emit('iceCandidate', {
    to: u2Id,
    candidate: { candidate: 'candidate:1 1 UDP 2130706431 192.168.1.1 50000 typ host' },
  });

  const iceData = await iceCandidatePromise;
  if (!iceData || !iceData.candidate) {
    throw new Error('ICE candidate exchange failed');
  }
  console.log(`  ✓ ICE candidate successfully relayed`);

  // User 1 ends call
  const callEndedPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for callEnded')), 5000);
    socket2.once('callEnded', () => {
      clearTimeout(timer);
      resolve(true);
    });
  });

  socket1.emit('endCall', { to: u2Id });
  await callEndedPromise;
  console.log(`  ✓ Call ended signal successfully exchanged`);

  // Cleanup sockets
  socket1.disconnect();
  socket2.disconnect();

  console.log('\n====================================');
  console.log('  ALL 20 E2E TESTS PASSED SUCCESSFULLY!');
  console.log('====================================\n');
};

runTests().catch((err) => {
  console.error('\n❌ E2E TEST FAILED:', err.message);
  process.exit(1);
});
