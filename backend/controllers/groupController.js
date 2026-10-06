const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const { asyncHandler } = require("../middleware/errorHandler");

const createGroup = asyncHandler(async (req, res) => {
  const { name, groupType } = req.body;
  if (!name || !name.trim()) {
    throw new AppError("Group name is required", 400);
  }

  let participantIds = [];
  if (req.body.participants) {
    try {
      participantIds = typeof req.body.participants === "string"
        ? JSON.parse(req.body.participants)
        : req.body.participants;
    } catch (e) {
      participantIds = req.body.participants.split(",").map((id) => id.trim());
    }
  }

  // Ensure current user (admin) is included
  const uniqueParticipants = Array.from(
    new Set([req.user._id.toString(), ...participantIds])
  );

  const group = await Conversation.create({
    name: name.trim(),
    icon: req.file ? req.file.path : "",
    groupType: groupType === "broadcast" ? "broadcast" : "standard",
    admin: req.user._id,
    participants: uniqueParticipants,
  });

  const populated = await Conversation.findById(group._id)
    .populate("admin", "name username profilePicture")
    .populate("participants", "name username profilePicture");

  // Real-time socket notification to all members
  try {
    const { getIO } = require("../sockets");
    const io = getIO();
    uniqueParticipants.forEach((pId) => {
      io.to(pId.toString()).emit("newGroup", populated);
    });
  } catch (e) {
    // Non-blocking
  }

  res.status(201).json({ group: populated });
});

const getUserGroups = asyncHandler(async (req, res) => {
  const groups = await Conversation.find({ participants: req.user._id })
    .sort({ updatedAt: -1 })
    .populate("admin", "name username profilePicture")
    .populate("participants", "name username profilePicture");

  // Privacy filter for broadcast channels
  const sanitized = groups.map((g) => {
    const gObj = g.toObject();
    const adminId = gObj.admin?._id ? gObj.admin._id.toString() : (gObj.admin ? gObj.admin.toString() : null);
    const isAdmin = adminId === req.user._id.toString();
    if (gObj.groupType === "broadcast" && !isAdmin) {
      gObj.participants = gObj.admin ? [gObj.admin] : [];
    }
    return gObj;
  });

  res.json({ groups: sanitized });
});

const getGroupDetails = asyncHandler(async (req, res) => {
  const group = await Conversation.findById(req.params.groupId)
    .populate("admin", "name username profilePicture")
    .populate("participants", "name username profilePicture");

  if (!group) throw new AppError("Group not found", 404);

  const isMember = group.participants.some(
    (p) => p._id.toString() === req.user._id.toString()
  );
  if (!isMember) throw new AppError("Not authorized to view this group", 403);

  const gObj = group.toObject();
  const adminId = gObj.admin?._id ? gObj.admin._id.toString() : (gObj.admin ? gObj.admin.toString() : null);
  const isAdmin = adminId === req.user._id.toString();

  // Hide members in broadcast channels from non-admins
  if (gObj.groupType === "broadcast" && !isAdmin) {
    gObj.participants = gObj.admin ? [gObj.admin] : [];
  }

  res.json({ group: gObj });
});

const updateGroup = asyncHandler(async (req, res) => {
  const group = await Conversation.findById(req.params.groupId);
  if (!group) throw new AppError("Group not found", 404);

  const isMember = group.participants.some(
    (p) => p.toString() === req.user._id.toString()
  );
  if (!isMember) throw new AppError("Not authorized to modify this group", 403);

  const isAdmin = group.admin?.toString() === req.user._id.toString();

  // Permission check: WhatsApp broadcast can only be updated by admin
  // Instagram standard group can be updated by any member
  if (group.groupType === "broadcast" && !isAdmin) {
    throw new AppError("Only the group admin can update this channel", 403);
  }

  if (req.body.name && req.body.name.trim()) {
    group.name = req.body.name.trim();
  }

  if (req.file) {
    group.icon = req.file.path;
  }

  await group.save();

  const populated = await Conversation.findById(group._id)
    .populate("admin", "name username profilePicture")
    .populate("participants", "name username profilePicture");

  // Broadcast update to all participants in real time
  try {
    const { getIO } = require("../sockets");
    const io = getIO();
    group.participants.forEach((pId) => {
      io.to(pId.toString()).emit("groupUpdated", populated);
    });
  } catch (e) {
    // Non-blocking
  }

  res.json({ group: populated });
});

const getGroupMessages = asyncHandler(async (req, res) => {
  const group = await Conversation.findById(req.params.groupId);
  if (!group) throw new AppError("Group not found", 404);

  const isMember = group.participants.some(
    (p) => p.toString() === req.user._id.toString()
  );
  if (!isMember) throw new AppError("Not authorized to view messages", 403);

  const isAdmin = group.admin?.toString() === req.user._id.toString();

  let query = { conversationId: group._id };

  // Confidential privacy filter for broadcast channels
  if (group.groupType === "broadcast" && !isAdmin) {
    query.$or = [
      { isBroadcast: true },
      { senderId: req.user._id },
      { targetUserId: req.user._id },
    ];
  }

  const messages = await Message.find(query)
    .sort({ createdAt: 1 })
    .populate("senderId", "name username profilePicture")
    .populate("targetUserId", "name username profilePicture");

  res.json({ messages });
});

const joinGroup = asyncHandler(async (req, res) => {
  const group = await Conversation.findById(req.params.groupId);
  if (!group) throw new AppError("Group not found", 404);

  const isAlreadyMember = group.participants.some(
    (p) => p.toString() === req.user._id.toString()
  );
  if (!isAlreadyMember) {
    group.participants.push(req.user._id);
    await group.save();
  }

  res.json({ message: "Joined group successfully", group });
});

const leaveGroup = asyncHandler(async (req, res) => {
  const group = await Conversation.findById(req.params.groupId);
  if (!group) throw new AppError("Group not found", 404);

  group.participants = group.participants.filter(
    (p) => p.toString() !== req.user._id.toString()
  );
  await group.save();

  res.json({ message: "Left group successfully" });
});

module.exports = {
  createGroup,
  getUserGroups,
  getGroupDetails,
  updateGroup,
  getGroupMessages,
  joinGroup,
  leaveGroup,
};
