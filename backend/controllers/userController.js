const User = require("../models/User");
const Post = require("../models/Post");
const Follow = require("../models/Follow");
const Like = require("../models/Like");
const Comment = require("../models/Comment");
const AdminActionLog = require("../models/AdminActionLog");
const AppError = require("../utils/AppError");
const { asyncHandler } = require("../middleware/errorHandler");

const searchUsers = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q || !q.trim()) {
    return res.json({ users: [] });
  }

  const query = q.trim();
  const users = await User.find({
    status: "active",
    _id: { $ne: req.user._id },
    $or: [
      { name: { $regex: query, $options: "i" } },
      { username: { $regex: query, $options: "i" } },
    ],
  })
    .select("name username profilePicture bio")
    .limit(20);

  const userIds = users.map((u) => u._id);
  const followingDocs = await Follow.find({
    followerId: req.user._id,
    followingId: { $in: userIds },
  }).select("followingId");

  const followingSet = new Set(followingDocs.map((f) => f.followingId.toString()));

  const formattedUsers = users.map((u) => {
    const obj = u.toObject ? u.toObject() : { ...u };
    return {
      ...obj,
      isFollowing: followingSet.has(obj._id.toString()),
    };
  });

  res.json({ users: formattedUsers });
});

const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findOne({ username: req.params.username.toLowerCase() });
  if (!user) throw new AppError("User not found", 404);

  if (user.status === "suspended" && req.user.userType !== "Admin") {
    throw new AppError("This user account has been suspended", 404);
  }

  const [postsCount, followersCount, followingCount, isFollowingCheck, posts] = await Promise.all([
    Post.countDocuments({ authorId: user._id }),
    Follow.countDocuments({ followingId: user._id }),
    Follow.countDocuments({ followerId: user._id }),
    Follow.exists({ followerId: req.user._id, followingId: user._id }),
    Post.find({ authorId: user._id })
      .sort({ createdAt: -1 })
      .populate("authorId", "name username profilePicture"),
  ]);

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
    Like.find({ postId: { $in: postIds }, userId: req.user._id }).select("postId"),
  ]);

  const likeCountMap = new Map(likeCounts.map((l) => [l._id.toString(), l.count]));
  const commentCountMap = new Map(commentCounts.map((c) => [c._id.toString(), c.count]));
  const userLikedSet = new Set(userLikes.map((l) => l.postId.toString()));

  const formattedPosts = posts.map((post) => {
    const p = post.toObject ? post.toObject() : { ...post };
    const pid = p._id.toString();
    return {
      ...p,
      likesCount: likeCountMap.get(pid) || 0,
      commentsCount: commentCountMap.get(pid) || 0,
      isLiked: userLikedSet.has(pid),
    };
  });

  res.json({
    user: {
      id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      bio: user.bio || "",
      profilePicture: user.profilePicture || "",
      status: user.status,
      userType: user.userType || "User",
      createdAt: user.createdAt,
      postsCount,
      followersCount,
      followingCount,
      isFollowing: !!isFollowingCheck,
      isSelf: user._id.toString() === req.user._id.toString(),
    },
    posts: formattedPosts,
  });
});

const getSuggestedUsers = asyncHandler(async (req, res) => {
  const followingDocs = await Follow.find({ followerId: req.user._id }).select("followingId");
  const excludedIds = followingDocs.map((f) => f.followingId);
  excludedIds.push(req.user._id);

  const suggested = await User.find({
    _id: { $nin: excludedIds },
    status: "active",
  })
    .select("name username profilePicture bio")
    .limit(10);

  res.json({ users: suggested });
});

const suspendUser = asyncHandler(async (req, res) => {
  const target = await User.findById(req.params.userId);
  if (!target) throw new AppError("User not found", 404);
  target.status = "suspended";
  await target.save();
  await AdminActionLog.create({ adminId: req.user._id, targetUserId: target._id, actionType: "suspend" });
  res.json({ message: "User suspended successfully", userId: target._id, status: "suspended" });
});

const reactivateUser = asyncHandler(async (req, res) => {
  const target = await User.findById(req.params.userId);
  if (!target) throw new AppError("User not found", 404);
  target.status = "active";
  await target.save();
  await AdminActionLog.create({ adminId: req.user._id, targetUserId: target._id, actionType: "reactivate" });
  res.json({ message: "User reactivated successfully", userId: target._id, status: "active" });
});

module.exports = { searchUsers, getUserProfile, getSuggestedUsers, suspendUser, reactivateUser };