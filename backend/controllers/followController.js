const Follow = require("../models/Follow");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const { asyncHandler } = require("../middleware/errorHandler");

const followUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (userId === req.user._id.toString()) {
    throw new AppError("You cannot follow yourself", 400);
  }

  const target = await User.findById(userId);
  if (!target) throw new AppError("User not found", 404);
  if (target.status === "suspended") throw new AppError("Cannot follow a suspended account", 400);

  const existing = await Follow.findOne({ followerId: req.user._id, followingId: userId });
  if (existing) throw new AppError("You are already following this user", 400);

  await Follow.create({ followerId: req.user._id, followingId: userId });

  const followersCount = await Follow.countDocuments({ followingId: userId });
  res.status(201).json({ message: "Followed successfully", isFollowing: true, followersCount });
});

const unfollowUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const result = await Follow.findOneAndDelete({ followerId: req.user._id, followingId: userId });
  if (!result) throw new AppError("You are not following this user", 400);

  const followersCount = await Follow.countDocuments({ followingId: userId });
  res.json({ message: "Unfollowed successfully", isFollowing: false, followersCount });
});

const getFollowers = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const target = await User.findById(userId);
  if (!target) throw new AppError("User not found", 404);

  const followersDocs = await Follow.find({ followingId: userId })
    .populate("followerId", "name username profilePicture bio");

  const followerUsers = followersDocs
    .filter((f) => f.followerId)
    .map((f) => f.followerId);

  // Check which of these the current user is following
  const currentUserFollowing = await Follow.find({
    followerId: req.user._id,
    followingId: { $in: followerUsers.map((u) => u._id) },
  }).select("followingId");

  const followingSet = new Set(currentUserFollowing.map((f) => f.followingId.toString()));

  const followersWithStatus = followerUsers.map((user) => {
    const u = user.toObject ? user.toObject() : { ...user };
    return {
      ...u,
      isFollowing: followingSet.has(u._id.toString()),
    };
  });

  res.json({ followers: followersWithStatus, count: followersWithStatus.length });
});

const getFollowing = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const target = await User.findById(userId);
  if (!target) throw new AppError("User not found", 404);

  const followingDocs = await Follow.find({ followerId: userId })
    .populate("followingId", "name username profilePicture bio");

  const followingUsers = followingDocs
    .filter((f) => f.followingId)
    .map((f) => f.followingId);

  // Check which of these the current user is following
  const currentUserFollowing = await Follow.find({
    followerId: req.user._id,
    followingId: { $in: followingUsers.map((u) => u._id) },
  }).select("followingId");

  const followingSet = new Set(currentUserFollowing.map((f) => f.followingId.toString()));

  const followingWithStatus = followingUsers.map((user) => {
    const u = user.toObject ? user.toObject() : { ...user };
    return {
      ...u,
      isFollowing: followingSet.has(u._id.toString()),
    };
  });

  res.json({ following: followingWithStatus, count: followingWithStatus.length });
});

const checkFollowStatus = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const isFollowing = await Follow.exists({ followerId: req.user._id, followingId: userId });
  res.json({ isFollowing: !!isFollowing });
});

module.exports = { followUser, unfollowUser, getFollowers, getFollowing, checkFollowStatus };