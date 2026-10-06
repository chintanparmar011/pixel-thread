const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Message = require("../models/Message");
const Conversation = require("../models/Conversation");

let io;
const userSocketMap = new Map();

const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Not authorized, no token"));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (!user) return next(new Error("Not authorized, invalid user"));
      if (user.status === "suspended") return next(new Error("Account suspended"));
      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (err) {
      next(new Error("Not authorized, invalid token"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(socket.userId);

    // Online presence tracking
    if (!userSocketMap.has(socket.userId)) {
      userSocketMap.set(socket.userId, new Set());
      socket.broadcast.emit("userOnline", { userId: socket.userId });
    }
    userSocketMap.get(socket.userId).add(socket.id);

    socket.emit("onlineUsers", Array.from(userSocketMap.keys()));

    socket.on("getOnlineUsers", (callback) => {
      if (typeof callback === "function") {
        callback(Array.from(userSocketMap.keys()));
      }
    });

    // 1-on-1 Direct Messaging
    socket.on("sendMessage", async ({ receiverId, text, mediaUrl, mediaType, audioDuration }, callback) => {
      try {
        if (!receiverId || (!text?.trim() && !mediaUrl)) {
          if (callback) callback({ error: "receiverId and message content or media are required" });
          return;
        }

        const receiver = await User.findById(receiverId);
        if (!receiver) {
          if (callback) callback({ error: "Receiver does not exist" });
          return;
        }

        const message = await Message.create({
          senderId: socket.userId,
          receiverId,
          text: text ? text.trim() : "",
          mediaUrl: mediaUrl || null,
          mediaType: mediaType || null,
          audioDuration: audioDuration || 0,
        });

        const populated = await Message.findById(message._id)
          .populate("senderId", "name username profilePicture")
          .populate("receiverId", "name username profilePicture")
          .populate("reactions.user", "name username profilePicture");

        io.to(receiverId).emit("receiveMessage", populated);
        io.to(socket.userId).emit("receiveMessage", populated);

        // Persistent notification
        try {
          const Notification = require("../models/Notification");
          const snippet = mediaType === "audio" 
            ? "🎤 Sent you a voice note" 
            : mediaType === "image" 
            ? "📷 Sent you a photo" 
            : `sent you a message: "${text.trim().substring(0, 50)}${text.trim().length > 50 ? "..." : ""}"`;

          const notif = await Notification.create({
            recipient: receiverId,
            sender: socket.userId,
            type: "message",
            message: `@${socket.user?.username || "user"} ${snippet}`,
          });
          const populatedNotif = await Notification.findById(notif._id).populate(
            "sender",
            "name username profilePicture"
          );
          io.to(receiverId).emit("newNotification", populatedNotif);
        } catch (ne) {
          // Non-blocking
        }

        if (callback) callback({ success: true, message: populated });
      } catch (err) {
        if (callback) callback({ error: "Failed to send message" });
      }
    });

    // Group Chat & Broadcast Channel Messaging
    socket.on(
      "sendGroupMessage",
      async ({ groupId, text, mediaUrl, mediaType, audioDuration, isBroadcast, targetUserId }, callback) => {
        try {
          if (!groupId || (!text?.trim() && !mediaUrl)) {
            if (callback) callback({ error: "groupId and message content or media are required" });
            return;
          }

          const group = await Conversation.findById(groupId);
          if (!group) {
            if (callback) callback({ error: "Group not found" });
            return;
          }

          const isMember = group.participants.some(
            (p) => p.toString() === socket.userId
          );
          if (!isMember) {
            if (callback) callback({ error: "Not a group member" });
            return;
          }

          const isAdmin = group.admin.toString() === socket.userId;

          const message = await Message.create({
            senderId: socket.userId,
            conversationId: group._id,
            text: text ? text.trim() : "",
            mediaUrl: mediaUrl || null,
            mediaType: mediaType || null,
            audioDuration: audioDuration || 0,
            isBroadcast: isAdmin && !!isBroadcast,
            targetUserId: isAdmin && targetUserId ? targetUserId : null,
          });

          group.lastMessage = {
            text: text ? text.trim() : (mediaType === "audio" ? "🎤 Voice note" : "📷 Photo"),
            senderId: socket.userId,
            createdAt: new Date(),
          };
          await group.save();

          const populated = await Message.findById(message._id)
            .populate("senderId", "name username profilePicture")
            .populate("targetUserId", "name username profilePicture")
            .populate("reactions.user", "name username profilePicture");

          if (group.groupType === "standard") {
            // Instagram-style: all members receive the message
            group.participants.forEach((pId) => {
              io.to(pId.toString()).emit("receiveGroupMessage", {
                groupId: group._id,
                message: populated,
              });
            });
          } else if (group.groupType === "broadcast") {
            // WhatsApp-style broadcast/channel
            if (isAdmin && isBroadcast) {
              // Admin broadcast announcement to everyone
              group.participants.forEach((pId) => {
                io.to(pId.toString()).emit("receiveGroupMessage", {
                  groupId: group._id,
                  message: populated,
                });
              });
            } else if (isAdmin && targetUserId) {
              // Admin reply to specific user
              io.to(targetUserId.toString()).emit("receiveGroupMessage", {
                groupId: group._id,
                message: populated,
              });
              io.to(socket.userId).emit("receiveGroupMessage", {
                groupId: group._id,
                message: populated,
              });
            } else {
              // Regular user sends to admin: only Admin and sender see it
              io.to(group.admin.toString()).emit("receiveGroupMessage", {
                groupId: group._id,
                message: populated,
              });
              if (socket.userId !== group.admin.toString()) {
                io.to(socket.userId).emit("receiveGroupMessage", {
                  groupId: group._id,
                  message: populated,
                });
              }
            }
          }

          if (callback) callback({ success: true, message: populated });
        } catch (err) {
          if (callback) callback({ error: "Failed to send group message" });
        }
      }
    );

    // Real-time Message Reactions
    socket.on("reactMessage", async ({ messageId, emoji }, callback) => {
      try {
        if (!messageId || !emoji) {
          if (callback) callback({ error: "messageId and emoji are required" });
          return;
        }

        const msg = await Message.findById(messageId);
        if (!msg) {
          if (callback) callback({ error: "Message not found" });
          return;
        }

        const existingIndex = msg.reactions.findIndex(
          (r) => r.user.toString() === socket.userId
        );

        if (existingIndex > -1) {
          if (msg.reactions[existingIndex].emoji === emoji) {
            // Toggle off
            msg.reactions.splice(existingIndex, 1);
          } else {
            // Update emoji
            msg.reactions[existingIndex].emoji = emoji;
          }
        } else {
          msg.reactions.push({ user: socket.userId, emoji });
        }

        await msg.save();

        const populated = await Message.findById(msg._id)
          .populate("senderId", "name username profilePicture")
          .populate("receiverId", "name username profilePicture")
          .populate("reactions.user", "name username profilePicture");

        const reactionPayload = {
          messageId: msg._id,
          reactions: populated.reactions,
        };

        if (msg.conversationId) {
          const grp = await Conversation.findById(msg.conversationId);
          if (grp && grp.participants) {
            grp.participants.forEach((pId) => {
              io.to(pId.toString()).emit("messageReactionUpdated", reactionPayload);
            });
          }
        } else {
          if (msg.receiverId) io.to(msg.receiverId.toString()).emit("messageReactionUpdated", reactionPayload);
          if (msg.senderId) io.to(msg.senderId.toString()).emit("messageReactionUpdated", reactionPayload);
        }

        if (callback) callback({ success: true, reactions: populated.reactions });
      } catch (err) {
        if (callback) callback({ error: "Failed to update reaction" });
      }
    });

    // WebRTC Audio/Video Call Signaling
    socket.on("callUser", ({ userToCall, signalData, from, callerName, callerAvatar, callType }) => {
      const targetRoom = (userToCall?._id || userToCall?.id || userToCall)?.toString();
      if (!targetRoom) return;

      io.to(targetRoom).emit("incomingCall", {
        signal: signalData,
        from: (from?._id || from?.id || from || socket.userId)?.toString(),
        callerName: callerName || socket.user?.name || "Caller",
        callerAvatar: callerAvatar || socket.user?.profilePicture || "",
        callType: callType || "video",
      });
    });

    socket.on("answerCall", ({ to, signal }) => {
      const targetRoom = (to?._id || to?.id || to)?.toString();
      if (targetRoom) {
        io.to(targetRoom).emit("callAccepted", { signal });
      }
    });

    socket.on("rejectCall", ({ to }) => {
      const targetRoom = (to?._id || to?.id || to)?.toString();
      if (targetRoom) {
        io.to(targetRoom).emit("callRejected");
      }
    });

    socket.on("endCall", ({ to }) => {
      const targetRoom = (to?._id || to?.id || to)?.toString();
      if (targetRoom) {
        io.to(targetRoom).emit("callEnded");
      }
    });

    socket.on("iceCandidate", ({ to, candidate }) => {
      const targetRoom = (to?._id || to?.id || to)?.toString();
      if (targetRoom) {
        io.to(targetRoom).emit("iceCandidate", { candidate });
      }
    });

    socket.on("typing", ({ receiverId }) => {
      if (receiverId) {
        io.to(receiverId).emit("userTyping", { userId: socket.userId });
      }
    });

    socket.on("stopTyping", ({ receiverId }) => {
      if (receiverId) {
        io.to(receiverId).emit("userStopTyping", { userId: socket.userId });
      }
    });

    socket.on("disconnect", () => {
      const userSockets = userSocketMap.get(socket.userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          userSocketMap.delete(socket.userId);
          io.emit("userOffline", { userId: socket.userId });
        }
      }
    });
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
};

module.exports = { initializeSocket, getIO };