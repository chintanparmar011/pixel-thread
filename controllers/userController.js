const User = require("../models/User");
const Post = require("../models/Post");
const AdminActionLog = require("../models/AdminActionLog");
const AppError = require("../utils/AppError");
const { asyncHandler } = require("../middleware/errorHandler");

const searchUsers = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q) throw new AppError("Query param 'q' is required", 400);
  const users = await User.find({
    status: "active",
    $or: [
      { name: { $regex: q, $options: "i" } },
      { username: { $regex: q, $options: "i" } },
    ],
  }).select("name username profilePicture bio");
  res.json({ users });
});

const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findOne({ username: req.params.username });
  if (!user) throw new AppError("User not found", 404);
  const posts = await Post.find({ authorId: user._id }).sort({ createdAt: -1 });
  res.json({
    user: {
      id: user._id,
      name: user.name,
      username: user.username,
      bio: user.bio,
      profilePicture: user.profilePicture,
      status: user.status,
    },
    posts,
  });
});

const suspendUser = asyncHandler(async (req, res) => {
  const target = await User.findById(req.params.userId);
  if (!target) throw new AppError("User not found", 404);
  target.status = "suspended";
  await target.save();
  await AdminActionLog.create({ adminId: req.user._id, targetUserId: target._id, actionType: "suspend" });
  res.json({ message: "User suspended", userId: target._id });
});

const reactivateUser = asyncHandler(async (req, res) => {
  const target = await User.findById(req.params.userId);
  if (!target) throw new AppError("User not found", 404);
  target.status = "active";
  await target.save();
  await AdminActionLog.create({ adminId: req.user._id, targetUserId: target._id, actionType: "reactivate" });
  res.json({ message: "User reactivated", userId: target._id });
});

module.exports = { searchUsers, getUserProfile, suspendUser, reactivateUser };