const Post = require("../models/Post");
const Comment = require("../models/Comment");
const Like = require("../models/Like");
const Follow = require("../models/Follow");
const Repost = require("../models/Repost");
const AppError = require("../utils/AppError");
const { asyncHandler } = require("../middleware/errorHandler");

const formatPostsWithEngagement = async (posts, currentUserId) => {
  if (!posts || posts.length === 0) return [];
  const postIds = posts.map((p) => p._id);

  const [likeCounts, commentCounts, repostCounts, userLikes, userReposts] =
    await Promise.all([
      Like.aggregate([
        { $match: { postId: { $in: postIds } } },
        { $group: { _id: "$postId", count: { $sum: 1 } } },
      ]),
      Comment.aggregate([
        { $match: { postId: { $in: postIds } } },
        { $group: { _id: "$postId", count: { $sum: 1 } } },
      ]),
      Repost.aggregate([
        { $match: { postId: { $in: postIds } } },
        { $group: { _id: "$postId", count: { $sum: 1 } } },
      ]),
      Like.find({ postId: { $in: postIds }, userId: currentUserId }).select("postId"),
      Repost.find({ postId: { $in: postIds }, userId: currentUserId }).select("postId"),
    ]);

  const likeCountMap = new Map(likeCounts.map((l) => [l._id.toString(), l.count]));
  const commentCountMap = new Map(commentCounts.map((c) => [c._id.toString(), c.count]));
  const repostCountMap = new Map(repostCounts.map((r) => [r._id.toString(), r.count]));
  const userLikedSet = new Set(userLikes.map((l) => l.postId.toString()));
  const userRepostedSet = new Set(userReposts.map((r) => r.postId.toString()));

  return posts.map((post) => {
    const postObj = post.toObject ? post.toObject() : { ...post };
    const pid = postObj._id.toString();
    return {
      ...postObj,
      likesCount: likeCountMap.get(pid) || 0,
      commentsCount: commentCountMap.get(pid) || 0,
      repostsCount: repostCountMap.get(pid) || 0,
      isLiked: userLikedSet.has(pid),
      isReposted: userRepostedSet.has(pid),
    };
  });
};

const createPost = asyncHandler(async (req, res) => {
  const { text } = req.body;
  if (!text && !req.file) throw new AppError("Post must have text or an image", 400);

  const post = await Post.create({
    text: text ? text.trim() : "",
    image: req.file ? req.file.path : "",
    authorId: req.user._id,
  });

  const populated = await Post.findById(post._id).populate(
    "authorId",
    "name username profilePicture"
  );

  res.status(201).json({
    post: {
      ...populated.toObject(),
      likesCount: 0,
      commentsCount: 0,
      repostsCount: 0,
      isLiked: false,
      isReposted: false,
    },
  });
});

const getPostById = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.postId).populate(
    "authorId",
    "name username profilePicture"
  );
  if (!post) throw new AppError("Post not found", 404);

  const [formatted] = await formatPostsWithEngagement([post], req.user._id);
  const comments = await Comment.find({ postId: post._id })
    .sort({ createdAt: 1 })
    .populate("authorId", "name username profilePicture");

  res.json({ post: formatted, comments });
});

const toggleRepost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const post = await Post.findById(postId);
  if (!post) throw new AppError("Post not found", 404);

  const existing = await Repost.findOne({ userId: req.user._id, postId });
  if (existing) {
    await existing.deleteOne();
    const count = await Repost.countDocuments({ postId });
    return res.json({ reposted: false, repostsCount: count });
  }

  await Repost.create({ userId: req.user._id, postId });
  const count = await Repost.countDocuments({ postId });

  // Notify post author if not reposting own post
  if (post.authorId.toString() !== req.user._id.toString()) {
    try {
      const Notification = require("../models/Notification");
      const notif = await Notification.create({
        recipient: post.authorId,
        sender: req.user._id,
        type: "repost",
        post: post._id,
        message: `@${req.user.username} reposted your post`,
      });
      const populated = await Notification.findById(notif._id)
        .populate("sender", "name username profilePicture")
        .populate("post", "text image");

      const { getIO } = require("../sockets");
      getIO().to(post.authorId.toString()).emit("newNotification", populated);
    } catch (e) {
      // Non-blocking notification dispatch
    }
  }

  res.json({ reposted: true, repostsCount: count });
});

const deletePost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.postId);
  if (!post) throw new AppError("Post not found", 404);

  const isAuthor = post.authorId.toString() === req.user._id.toString();
  const isAdmin = req.user.userType === "Admin";
  if (!isAuthor && !isAdmin) {
    throw new AppError("Not authorized to delete this post", 403);
  }

  // Delete associated comments, likes, and reposts
  await Promise.all([
    Comment.deleteMany({ postId: post._id }),
    Like.deleteMany({ postId: post._id }),
    Repost.deleteMany({ postId: post._id }),
    post.deleteOne(),
  ]);

  res.json({ message: "Post deleted successfully", postId: req.params.postId });
});

const getFeed = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Math.min(50, Number(req.query.limit) || 20));

  const following = await Follow.find({ followerId: req.user._id }).select("followingId");
  const authorIds = following.map((f) => f.followingId);
  authorIds.push(req.user._id);

  // Original posts from followed users + self
  const posts = await Post.find({ authorId: { $in: authorIds } })
    .sort({ createdAt: -1 })
    .limit(limit * 2)
    .populate("authorId", "name username profilePicture");

  // Reposts from followed users + self
  const reposts = await Repost.find({ userId: { $in: authorIds } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("userId", "name username")
    .populate({
      path: "postId",
      populate: { path: "authorId", select: "name username profilePicture" },
    });

  // Combine items
  const feedItems = [];
  const seenKeys = new Set();

  for (const p of posts) {
    feedItems.push({
      item: p,
      sortDate: p.createdAt,
      repostedBy: null,
    });
    seenKeys.add(`post-${p._id}`);
  }

  for (const r of reposts) {
    if (r.postId) {
      feedItems.push({
        item: r.postId,
        sortDate: r.createdAt,
        repostedBy: r.userId,
      });
    }
  }

  // Fallback to recent posts if empty
  if (feedItems.length === 0 && page === 1) {
    const recents = await Post.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("authorId", "name username profilePicture");
    for (const r of recents) {
      feedItems.push({ item: r, sortDate: r.createdAt, repostedBy: null });
    }
  }

  // Sort unified feed by newest action
  feedItems.sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate));

  const paginated = feedItems.slice((page - 1) * limit, page * limit);
  const postsToFormat = paginated.map((p) => p.item);
  const formatted = await formatPostsWithEngagement(postsToFormat, req.user._id);

  const result = formatted.map((post, index) => ({
    ...post,
    repostedBy: paginated[index]?.repostedBy || null,
  }));

  res.json({ posts: result, page, limit });
});

const getUserPosts = asyncHandler(async (req, res) => {
  const targetUserId = req.params.userId;
  const posts = await Post.find({ authorId: targetUserId })
    .sort({ createdAt: -1 })
    .populate("authorId", "name username profilePicture");

  const reposts = await Repost.find({ userId: targetUserId })
    .sort({ createdAt: -1 })
    .populate("userId", "name username")
    .populate({
      path: "postId",
      populate: { path: "authorId", select: "name username profilePicture" },
    });

  const combined = [];
  for (const p of posts) {
    combined.push({ item: p, sortDate: p.createdAt, repostedBy: null });
  }
  for (const r of reposts) {
    if (r.postId) {
      combined.push({ item: r.postId, sortDate: r.createdAt, repostedBy: r.userId });
    }
  }

  combined.sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate));
  const postsToFormat = combined.map((c) => c.item);
  const formatted = await formatPostsWithEngagement(postsToFormat, req.user._id);

  const result = formatted.map((post, idx) => ({
    ...post,
    repostedBy: combined[idx]?.repostedBy || null,
  }));

  res.json({ posts: result });
});

module.exports = {
  createPost,
  getPostById,
  toggleRepost,
  deletePost,
  getFeed,
  getUserPosts,
};