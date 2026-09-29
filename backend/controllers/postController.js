const Post = require("../models/Post");
const Comment = require("../models/Comment");
const Like = require("../models/Like");
const Follow = require("../models/Follow");
const AppError = require("../utils/AppError");
const { asyncHandler } = require("../middleware/errorHandler");

const formatPostsWithEngagement = async (posts, currentUserId) => {
  if (!posts || posts.length === 0) return [];
  const postIds = posts.map((p) => p._id);

  const [likeCounts, commentCounts, userLikes] = await Promise.all([
    Like.aggregate([
      { $match: { postId: { $in: postIds } } },
      { $group: { _id: "$postId", count: { $sum: 1 } } },
    ]),
    Comment.aggregate([
      { $match: { postId: { $in: postIds } } },
      { $group: { _id: "$postId", count: { $sum: 1 } } },
    ]),
    Like.find({ postId: { $in: postIds }, userId: currentUserId }).select("postId"),
  ]);

  const likeCountMap = new Map(likeCounts.map((l) => [l._id.toString(), l.count]));
  const commentCountMap = new Map(commentCounts.map((c) => [c._id.toString(), c.count]));
  const userLikedSet = new Set(userLikes.map((l) => l.postId.toString()));

  return posts.map((post) => {
    const postObj = post.toObject ? post.toObject() : { ...post };
    const pid = postObj._id.toString();
    return {
      ...postObj,
      likesCount: likeCountMap.get(pid) || 0,
      commentsCount: commentCountMap.get(pid) || 0,
      isLiked: userLikedSet.has(pid),
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

  const populated = await Post.findById(post._id).populate("authorId", "name username profilePicture");
  res.status(201).json({
    post: {
      ...populated.toObject(),
      likesCount: 0,
      commentsCount: 0,
      isLiked: false,
    },
  });
});

const getPostById = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.postId).populate("authorId", "name username profilePicture");
  if (!post) throw new AppError("Post not found", 404);

  const [formatted] = await formatPostsWithEngagement([post], req.user._id);
  const comments = await Comment.find({ postId: post._id })
    .sort({ createdAt: 1 })
    .populate("authorId", "name username profilePicture");

  res.json({ post: formatted, comments });
});

const deletePost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.postId);
  if (!post) throw new AppError("Post not found", 404);

  const isAuthor = post.authorId.toString() === req.user._id.toString();
  const isAdmin = req.user.userType === "Admin";
  if (!isAuthor && !isAdmin) {
    throw new AppError("Not authorized to delete this post", 403);
  }

  // Delete associated comments and likes
  await Promise.all([
    Comment.deleteMany({ postId: post._id }),
    Like.deleteMany({ postId: post._id }),
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

  let posts = await Post.find({ authorId: { $in: authorIds } })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("authorId", "name username profilePicture");

  // Fallback to recent posts if feed has no content
  if (posts.length === 0 && page === 1) {
    posts = await Post.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("authorId", "name username profilePicture");
  }

  const formattedPosts = await formatPostsWithEngagement(posts, req.user._id);

  res.json({ posts: formattedPosts, page, limit });
});

const getUserPosts = asyncHandler(async (req, res) => {
  const posts = await Post.find({ authorId: req.params.userId })
    .sort({ createdAt: -1 })
    .populate("authorId", "name username profilePicture");

  const formattedPosts = await formatPostsWithEngagement(posts, req.user._id);
  res.json({ posts: formattedPosts });
});

module.exports = { createPost, getPostById, deletePost, getFeed, getUserPosts };