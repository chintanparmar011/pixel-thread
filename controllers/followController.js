const Follow = require("../models/Follow");
const AppError = require("../utils/AppError");
const { asyncHandler } = require("../middleware/errorHandler");

const followUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (userId === req.user._id.toString()) throw new AppError("You can't follow yourself", 400);
  await Follow.create({ followerId: req.user._id, followingId: userId });
  res.status(201).json({ message: "Followed successfully" });
});

const unfollowUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const result = await Follow.findOneAndDelete({ followerId: req.user._id, followingId: userId });
  if (!result) throw new AppError("You are not following this user", 400);
  res.json({ message: "Unfollowed successfully" });
});

const getFollowers = asyncHandler(async (req, res) => {
  const followers = await Follow.find({ followingId: req.params.userId }).populate("followerId", "name username profilePicture");
  res.json({ followers: followers.map((f) => f.followerId) });
});

const getFollowing = asyncHandler(async (req, res) => {
  const following = await Follow.find({ followerId: req.params.userId }).populate("followingId", "name username profilePicture");
  res.json({ following: following.map((f) => f.followingId) });
});

module.exports = { followUser, unfollowUser, getFollowers, getFollowing };