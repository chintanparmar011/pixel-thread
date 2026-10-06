const Story = require("../models/Story");
const Follow = require("../models/Follow");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const { asyncHandler } = require("../middleware/errorHandler");

// Create a new 24h story
const createStory = asyncHandler(async (req, res) => {
  const mediaUrl = req.file ? req.file.path : req.body.mediaUrl;
  if (!mediaUrl) {
    throw new AppError("Story requires an image or video file", 400);
  }

  const mediaType = req.body.mediaType || (req.file?.mimetype?.startsWith("video") ? "video" : "image");
  const caption = req.body.caption ? req.body.caption.trim() : "";

  const story = await Story.create({
    authorId: req.user._id,
    mediaUrl,
    mediaType,
    caption,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours TTL
  });

  const populated = await Story.findById(story._id).populate(
    "authorId",
    "name username profilePicture"
  );

  res.status(201).json({
    message: "Story published successfully",
    story: populated,
  });
});

// Get stories tray grouped by user
const getStoriesFeed = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id.toString();

  // Find users current user follows
  const follows = await Follow.find({ followerId: req.user._id }).select("followingId");
  const followedIds = follows.map((f) => f.followingId.toString());

  // Active stories (not expired)
  const activeStories = await Story.find({
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: 1 })
    .populate("authorId", "name username profilePicture")
    .populate("viewers.user", "name username profilePicture");

  const trayMap = new Map();

  for (const story of activeStories) {
    if (!story.authorId) continue;
    const authorId = story.authorId._id.toString();
    const isOwner = authorId === currentUserId;
    const hasViewed = story.viewers.some(
      (v) => v.user && (v.user._id?.toString() === currentUserId || v.user.toString() === currentUserId)
    );

    if (!trayMap.has(authorId)) {
      trayMap.set(authorId, {
        user: {
          id: story.authorId._id,
          name: story.authorId.name,
          username: story.authorId.username,
          profilePicture: story.authorId.profilePicture || "",
        },
        isOwner,
        isFollowing: followedIds.includes(authorId),
        hasUnseen: false,
        stories: [],
        latestCreatedAt: story.createdAt,
      });
    }

    const entry = trayMap.get(authorId);
    entry.stories.push(story);
    entry.latestCreatedAt = story.createdAt;

    if (!isOwner && !hasViewed) {
      entry.hasUnseen = true;
    }
  }

  // Sort: Owner first, followed users with unseen, followed users seen, others unseen, others seen
  const trayList = Array.from(trayMap.values()).sort((a, b) => {
    if (a.isOwner) return -1;
    if (b.isOwner) return 1;
    if (a.hasUnseen && !b.hasUnseen) return -1;
    if (!a.hasUnseen && b.hasUnseen) return 1;
    if (a.isFollowing && !b.isFollowing) return -1;
    if (!a.isFollowing && b.isFollowing) return 1;
    return new Date(b.latestCreatedAt) - new Date(a.latestCreatedAt);
  });

  res.json({ tray: trayList });
});

// Record a view on a story
const recordStoryView = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const currentUserId = req.user._id;

  const story = await Story.findById(id);
  if (!story) throw new AppError("Story not found or expired", 404);

  const alreadyViewed = story.viewers.some(
    (v) => v.user && v.user.toString() === currentUserId.toString()
  );

  if (!alreadyViewed) {
    story.viewers.push({
      user: currentUserId,
      viewedAt: new Date(),
    });
    await story.save();
  }

  res.json({ success: true, message: "Story view recorded" });
});

// Delete a story
const deleteStory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const story = await Story.findById(id);

  if (!story) throw new AppError("Story not found", 404);

  const isAuthor = story.authorId.toString() === req.user._id.toString();
  const isAdmin = req.user.userType === "Admin";

  if (!isAuthor && !isAdmin) {
    throw new AppError("Not authorized to delete this story", 403);
  }

  await Story.findByIdAndDelete(id);

  res.json({ success: true, message: "Story deleted successfully" });
});

module.exports = {
  createStory,
  getStoriesFeed,
  recordStoryView,
  deleteStory,
};
