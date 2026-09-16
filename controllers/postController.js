const Post = require("../models/Post");
const Comment = require("../models/Comment");
const Like = require("../models/Like");
const Follow = require("../models/Follow");
const AppError = require("../utils/AppError");
const { asyncHandler } = require("../middleware/errorHandler");

const createPost = asyncHandler(async (req, res) => {
  const { text } = req.body;
  if (!text && !req.file) throw new AppError("Post must have text or an image", 400);
  const post = await Post.create({
    text: text || "",
    image: req.file ? req.file.path : "",
    authorId: req.user._id,
  });
  res.status(201).json({ post });
});

const deletePost = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.postId);
  if (!post) throw new AppError("Post not found", 404);
  if (post.authorId.toString() !== req.user._id.toString()) {
    throw new AppError("Not authorized to delete this post", 403);
  }
  // Cascade delete — comments/likes shouldn't point at a dead post
  await Promise.all([
    Comment.deleteMany({ postId: post._id }),
    Like.deleteMany({ postId: post._id }),
    post.deleteOne(),
  ]);
  res.json({ message: "Post deleted" });
});

const getFeed = asyncHandler(async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;

  const following = await Follow.find({ followerId: req.user._id }).select("followingId");
  const authorIds = following.map((f) => f.followingId);
  authorIds.push(req.user._id); // include own posts

  const posts = await Post.find({ authorId: { $in: authorIds } })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("authorId", "name username profilePicture");

  res.json({ posts, page, limit });
});

const getUserPosts = asyncHandler(async (req, res) => {
  const posts = await Post.find({ authorId: req.params.userId }).sort({ createdAt: -1 });
  res.json({ posts });
});

module.exports = { createPost, deletePost, getFeed, getUserPosts };