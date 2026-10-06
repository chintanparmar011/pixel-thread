const Message = require("../models/Message");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const { asyncHandler } = require("../middleware/errorHandler");

const getConversations = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;

  const messages = await Message.find({
    $or: [{ senderId: currentUserId }, { receiverId: currentUserId }],
  })
    .sort({ createdAt: -1 })
    .populate("senderId", "name username profilePicture status")
    .populate("receiverId", "name username profilePicture status")
    .populate("reactions.user", "name username profilePicture");

  const conversationMap = new Map();

  for (const msg of messages) {
    if (!msg.senderId || !msg.receiverId) continue;
    const isSender = msg.senderId._id.toString() === currentUserId.toString();
    const partner = isSender ? msg.receiverId : msg.senderId;
    if (!partner) continue;

    const partnerId = partner._id.toString();

    if (!conversationMap.has(partnerId)) {
      conversationMap.set(partnerId, {
        partner: {
          id: partner._id,
          name: partner.name,
          username: partner.username,
          profilePicture: partner.profilePicture || "",
          status: partner.status,
        },
        lastMessage: {
          id: msg._id,
          text: msg.text || (msg.mediaType === "audio" ? "🎤 Voice note" : msg.mediaType === "image" ? "📷 Photo" : ""),
          senderId: msg.senderId._id,
          mediaUrl: msg.mediaUrl,
          mediaType: msg.mediaType,
          audioDuration: msg.audioDuration,
          createdAt: msg.createdAt,
        },
        unreadCount: 0,
      });
    }

    if (!isSender && !msg.isRead) {
      const convo = conversationMap.get(partnerId);
      convo.unreadCount += 1;
    }
  }

  const conversations = Array.from(conversationMap.values());
  res.json({ conversations });
});

const getChatHistory = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const targetUser = await User.findById(userId);
  if (!targetUser) throw new AppError("User not found", 404);

  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 50));

  const messages = await Message.find({
    $or: [
      { senderId: req.user._id, receiverId: userId },
      { senderId: userId, receiverId: req.user._id },
    ],
  })
    .sort({ createdAt: 1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("senderId", "name username profilePicture")
    .populate("receiverId", "name username profilePicture")
    .populate("reactions.user", "name username profilePicture");

  await Message.updateMany(
    { senderId: userId, receiverId: req.user._id, isRead: false },
    { isRead: true }
  );

  res.json({
    partner: {
      id: targetUser._id,
      name: targetUser.name,
      username: targetUser.username,
      profilePicture: targetUser.profilePicture || "",
      status: targetUser.status,
    },
    messages,
    page,
    limit,
  });
});

const uploadChatMedia = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError("No file uploaded", 400);

  const isAudio =
    req.file.mimetype.startsWith("audio/") ||
    (req.file.originalname && req.file.originalname.match(/\.(webm|mp3|wav|m4a|ogg)$/i));

  res.json({
    url: req.file.path,
    mediaType: isAudio ? "audio" : "image",
    mimetype: req.file.mimetype,
    filename: req.file.originalname,
  });
});

const reactToMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const { emoji } = req.body;
  const userId = req.user._id;

  if (!emoji) throw new AppError("Emoji is required", 400);

  const message = await Message.findById(messageId);
  if (!message) throw new AppError("Message not found", 404);

  const existingIdx = message.reactions.findIndex(
    (r) => r.user.toString() === userId.toString()
  );

  if (existingIdx > -1) {
    if (message.reactions[existingIdx].emoji === emoji) {
      // Toggle off
      message.reactions.splice(existingIdx, 1);
    } else {
      // Update emoji
      message.reactions[existingIdx].emoji = emoji;
    }
  } else {
    message.reactions.push({ user: userId, emoji });
  }

  await message.save();
  const populated = await Message.findById(message._id)
    .populate("senderId", "name username profilePicture")
    .populate("receiverId", "name username profilePicture")
    .populate("reactions.user", "name username profilePicture");

  res.json({ success: true, message: populated });
});

module.exports = {
  getConversations,
  getChatHistory,
  uploadChatMedia,
  reactToMessage,
};