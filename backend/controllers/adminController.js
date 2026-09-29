const User = require("../models/User");
const Post = require("../models/Post");
const Comment = require("../models/Comment");
const Like = require("../models/Like");
const Follow = require("../models/Follow");
const Message = require("../models/Message");
const AdminActionLog = require("../models/AdminActionLog");
const AppError = require("../utils/AppError");
const { asyncHandler } = require("../middleware/errorHandler");
const { getIO } = require("../sockets");

const getDashboardStats = asyncHandler(async (req, res) => {
  const [
    totalUsers,
    activeUsers,
    suspendedUsers,
    totalPosts,
    totalComments,
    totalMessages,
    recentUsers,
    recentLogs,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ status: "active" }),
    User.countDocuments({ status: "suspended" }),
    Post.countDocuments(),
    Comment.countDocuments(),
    Message.countDocuments(),
    User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select("name username email userType status profilePicture createdAt"),
    AdminActionLog.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("adminId", "name username email")
      .populate("targetUserId", "name username email"),
  ]);

  res.json({
    stats: {
      totalUsers,
      activeUsers,
      suspendedUsers,
      totalPosts,
      totalComments,
      totalMessages,
    },
    recentUsers,
    recentLogs,
  });
});

const getAllUsers = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 15));
  const { search, status, role } = req.query;

  const query = {};

  if (status && status !== "all") {
    query.status = status;
  }

  if (role && role !== "all") {
    query.userType = role;
  }

  if (search && search.trim()) {
    const s = search.trim();
    query.$or = [
      { name: { $regex: s, $options: "i" } },
      { username: { $regex: s, $options: "i" } },
      { email: { $regex: s, $options: "i" } },
    ];
  }

  const [total, users] = await Promise.all([
    User.countDocuments(query),
    User.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("name username email userType status profilePicture bio createdAt"),
  ]);

  // Attach post and follower counts for each user
  const userIds = users.map((u) => u._id);
  const [postCounts, followerCounts] = await Promise.all([
    Post.aggregate([
      { $match: { authorId: { $in: userIds } } },
      { $group: { _id: "$authorId", count: { $sum: 1 } } },
    ]),
    Follow.aggregate([
      { $match: { followingId: { $in: userIds } } },
      { $group: { _id: "$followingId", count: { $sum: 1 } } },
    ]),
  ]);

  const postCountMap = new Map(postCounts.map((p) => [p._id.toString(), p.count]));
  const followerCountMap = new Map(followerCounts.map((f) => [f._id.toString(), f.count]));

  const usersWithCounts = users.map((user) => {
    const u = user.toObject ? user.toObject() : { ...user };
    const id = u._id.toString();
    return {
      ...u,
      postsCount: postCountMap.get(id) || 0,
      followersCount: followerCountMap.get(id) || 0,
    };
  });

  res.json({
    users: usersWithCounts,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

const updateUserStatus = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { action } = req.body; // "suspend" | "reactivate"

  if (!action || !["suspend", "reactivate"].includes(action)) {
    throw new AppError("Action must be 'suspend' or 'reactivate'", 400);
  }

  if (userId === req.user._id.toString()) {
    throw new AppError("You cannot modify your own administrator account status", 400);
  }

  const target = await User.findById(userId);
  if (!target) throw new AppError("User not found", 404);

  const newStatus = action === "suspend" ? "suspended" : "active";
  target.status = newStatus;
  await target.save();

  await AdminActionLog.create({
    adminId: req.user._id,
    targetUserId: target._id,
    actionType: action,
    details: `Admin ${req.user.username} set user ${target.username} status to ${newStatus}`,
  });

  // If suspended, notify via socket to immediately log out / disconnect
  try {
    const io = getIO();
    if (newStatus === "suspended") {
      io.to(target._id.toString()).emit("accountSuspended", {
        message: "Your account has been suspended by an administrator.",
      });
      io.in(target._id.toString()).disconnectSockets(true);
    }
  } catch (socketErr) {
    // Socket emit is best-effort
  }

  res.json({
    message: `User ${action === "suspend" ? "suspended" : "reactivated"} successfully`,
    user: {
      id: target._id,
      name: target.name,
      username: target.username,
      email: target.email,
      status: target.status,
      userType: target.userType,
    },
  });
});

const getAllPosts = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
  const { search } = req.query;

  const query = {};
  if (search && search.trim()) {
    query.text = { $regex: search.trim(), $options: "i" };
  }

  const [total, posts] = await Promise.all([
    Post.countDocuments(query),
    Post.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("authorId", "name username email profilePicture status"),
  ]);

  const postIds = posts.map((p) => p._id);
  const [likeCounts, commentCounts] = await Promise.all([
    Like.aggregate([
      { $match: { postId: { $in: postIds } } },
      { $group: { _id: "$postId", count: { $sum: 1 } } },
    ]),
    Comment.aggregate([
      { $match: { postId: { $in: postIds } } },
      { $group: { _id: "$postId", count: { $sum: 1 } } },
    ]),
  ]);

  const likeCountMap = new Map(likeCounts.map((l) => [l._id.toString(), l.count]));
  const commentCountMap = new Map(commentCounts.map((c) => [c._id.toString(), c.count]));

  const formattedPosts = posts.map((post) => {
    const p = post.toObject ? post.toObject() : { ...post };
    const pid = p._id.toString();
    return {
      ...p,
      likesCount: likeCountMap.get(pid) || 0,
      commentsCount: commentCountMap.get(pid) || 0,
    };
  });

  res.json({
    posts: formattedPosts,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

const deletePostAsAdmin = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const post = await Post.findById(postId);
  if (!post) throw new AppError("Post not found", 404);

  await Promise.all([
    Comment.deleteMany({ postId: post._id }),
    Like.deleteMany({ postId: post._id }),
    post.deleteOne(),
  ]);

  await AdminActionLog.create({
    adminId: req.user._id,
    targetUserId: post.authorId,
    actionType: "delete_post",
    details: `Admin ${req.user.username} deleted post ${postId}`,
  });

  res.json({ message: "Post deleted by administrator", postId });
});

const getAdminLogs = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));

  const [total, logs] = await Promise.all([
    AdminActionLog.countDocuments(),
    AdminActionLog.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("adminId", "name username email profilePicture")
      .populate("targetUserId", "name username email profilePicture"),
  ]);

  res.json({
    logs,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

module.exports = {
  getDashboardStats,
  getAllUsers,
  updateUserStatus,
  getAllPosts,
  deletePostAsAdmin,
  getAdminLogs,
};
