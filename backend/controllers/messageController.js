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
    .populate("receiverId", "name username profilePicture status");

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
          text: msg.text,
          senderId: msg.senderId._id,
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
    .populate("receiverId", "name username profilePicture");

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

module.exports = { getConversations, getChatHistory };