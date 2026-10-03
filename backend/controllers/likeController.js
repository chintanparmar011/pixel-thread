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

  // Notify post author if not liking own post
  if (post.authorId.toString() !== req.user._id.toString()) {
    try {
      const Notification = require("../models/Notification");
      const notif = await Notification.create({
        recipient: post.authorId,
        sender: req.user._id,
        type: "like",
        post: post._id,
        message: `@${req.user.username} liked your post`,
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

  res.json({ liked: true, likeCount: count });
});

const getLikes = asyncHandler(async (req, res) => {
  const likes = await Like.find({ postId: req.params.postId }).populate("userId", "name username profilePicture");
  res.json({ likes, count: likes.length });
});

module.exports = { toggleLike, getLikes };