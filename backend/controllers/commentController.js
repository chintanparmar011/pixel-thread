const Comment = require("../models/Comment");
const Post = require("../models/Post");
const AppError = require("../utils/AppError");
const { asyncHandler } = require("../middleware/errorHandler");

const addComment = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { text, parentId } = req.body;
  if (!text || !text.trim()) throw new AppError("Comment text is required", 400);

  const post = await Post.findById(postId);
  if (!post) throw new AppError("Post not found", 404);

  let verifiedParentId = null;
  let parentComment = null;
  if (parentId) {
    parentComment = await Comment.findById(parentId);
    if (!parentComment) throw new AppError("Parent comment not found", 404);
    verifiedParentId = parentComment._id;
  }

  const comment = await Comment.create({
    text: text.trim(),
    authorId: req.user._id,
    postId,
    parentId: verifiedParentId,
  });

  const populated = await Comment.findById(comment._id).populate(
    "authorId",
    "name username profilePicture"
  );

  // Dispatch notification
  try {
    const Notification = require("../models/Notification");
    const { getIO } = require("../sockets");

    if (verifiedParentId && parentComment) {
      // Reply notification to parent comment author
      if (parentComment.authorId.toString() !== req.user._id.toString()) {
        const notif = await Notification.create({
          recipient: parentComment.authorId,
          sender: req.user._id,
          type: "reply",
          post: post._id,
          message: `@${req.user.username} replied to your comment: "${text.trim().substring(0, 40)}"`,
        });
        const populatedNotif = await Notification.findById(notif._id)
          .populate("sender", "name username profilePicture")
          .populate("post", "text image");
        getIO().to(parentComment.authorId.toString()).emit("newNotification", populatedNotif);
      }
    } else {
      // Comment notification to post author
      if (post.authorId.toString() !== req.user._id.toString()) {
        const notif = await Notification.create({
          recipient: post.authorId,
          sender: req.user._id,
          type: "comment",
          post: post._id,
          message: `@${req.user.username} commented on your post: "${text.trim().substring(0, 40)}"`,
        });
        const populatedNotif = await Notification.findById(notif._id)
          .populate("sender", "name username profilePicture")
          .populate("post", "text image");
        getIO().to(post.authorId.toString()).emit("newNotification", populatedNotif);
      }
    }
  } catch (e) {
    // Non-blocking notification dispatch
  }

  res.status(201).json({ comment: populated });
});

const deleteComment = asyncHandler(async (req, res) => {
  const comment = await Comment.findById(req.params.commentId);
  if (!comment) throw new AppError("Comment not found", 404);

  const post = await Post.findById(comment.postId);
  const isCommentAuthor = comment.authorId.toString() === req.user._id.toString();
  const isPostAuthor = post && post.authorId.toString() === req.user._id.toString();
  const isAdmin = req.user.userType === "Admin";

  if (!isCommentAuthor && !isPostAuthor && !isAdmin) {
    throw new AppError("Not authorized to delete this comment", 403);
  }

  // Delete comment and its child replies
  await Promise.all([
    comment.deleteOne(),
    Comment.deleteMany({ parentId: comment._id }),
  ]);

  res.json({ message: "Comment deleted successfully", commentId: req.params.commentId });
});

const getComments = asyncHandler(async (req, res) => {
  const comments = await Comment.find({ postId: req.params.postId })
    .sort({ createdAt: 1 })
    .populate("authorId", "name username profilePicture");

  res.json({ comments, count: comments.length });
});

module.exports = { addComment, deleteComment, getComments };