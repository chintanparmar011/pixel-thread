const Like = require("../models/Like");
const Post = require("../models/Post");
const AppError = require("../utils/AppError");
const { asyncHandler } = require("../middleware/errorHandler");

const toggleLike = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const post = await Post.findById(postId);
  if (!post) throw new AppError("Post not found", 404);

  const existing = await Like.findOne({ userId: req.user._id, postId });
  if (existing) {
    await existing.deleteOne();
    const count = await Like.countDocuments({ postId });
    return res.json({ liked: false, likeCount: count });
  }
  await Like.create({ userId: req.user._id, postId });
  const count = await Like.countDocuments({ postId });
  res.json({ liked: true, likeCount: count });
});

const getLikes = asyncHandler(async (req, res) => {
  const likes = await Like.find({ postId: req.params.postId }).populate("userId", "name username profilePicture");
  res.json({ likes, count: likes.length });
});

module.exports = { toggleLike, getLikes };