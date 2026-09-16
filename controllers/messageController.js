const Message = require("../models/Message");
const { asyncHandler } = require("../middleware/errorHandler");

const getChatHistory = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 50;

  const messages = await Message.find({
    $or: [
      { senderId: req.user._id, receiverId: userId },
      { senderId: userId, receiverId: req.user._id },
    ],
  })
    .sort({ createdAt: 1 })
    .skip((page - 1) * limit)
    .limit(limit);

  await Message.updateMany(
    { senderId: userId, receiverId: req.user._id, isRead: false },
    { isRead: true }
  );

  res.json({ messages, page, limit });
});

module.exports = { getChatHistory };