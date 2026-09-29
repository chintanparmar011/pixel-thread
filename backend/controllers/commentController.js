const Comment = require("../models/Comment");
const Post = require("../models/Post");
const AppError = require("../utils/AppError");
const { asyncHandler } = require("../middleware/errorHandler");

const addComment = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { text } = req.body;
  if (!text || !text.trim()) throw new AppError("Comment text is required", 400);

  const post = await Post.findById(postId);
  if (!post) throw new AppError("Post not found", 404);

  const comment = await Comment.create({
    text: text.trim(),
    authorId: req.user._id,
    postId,
  });

  const populated = await Comment.findById(comment._id).populate("authorId", "name username profilePicture");
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

  await comment.deleteOne();
  res.json({ message: "Comment deleted successfully", commentId: req.params.commentId });
});

const getComments = asyncHandler(async (req, res) => {
  const comments = await Comment.find({ postId: req.params.postId })
    .sort({ createdAt: 1 })
    .populate("authorId", "name username profilePicture");

  res.json({ comments, count: comments.length });
});

module.exports = { addComment, deleteComment, getComments };