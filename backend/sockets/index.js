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
    socket.on("sendMessage", async ({ receiverId, text }, callback) => {
      try {
        if (!receiverId || !text || !text.trim()) {
          if (callback) callback({ error: "receiverId and text are required" });
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
          text: text.trim(),
        });

        const populated = await Message.findById(message._id)
          .populate("senderId", "name username profilePicture")
          .populate("receiverId", "name username profilePicture");

        io.to(receiverId).emit("receiveMessage", populated);
        io.to(socket.userId).emit("receiveMessage", populated);

        // Persistent notification
        try {
          const Notification = require("../models/Notification");
          const notif = await Notification.create({
            recipient: receiverId,
            sender: socket.userId,
            type: "message",
            message: `@${socket.user?.username || "user"} sent you a message: "${text.trim().substring(0, 50)}${text.trim().length > 50 ? "..." : ""}"`,
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
      async ({ groupId, text, isBroadcast, targetUserId }, callback) => {
        try {
          if (!groupId || !text || !text.trim()) {
            if (callback) callback({ error: "groupId and text are required" });
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
            text: text.trim(),
            isBroadcast: isAdmin && !!isBroadcast,
            targetUserId: isAdmin && targetUserId ? targetUserId : null,
          });

          group.lastMessage = {
            text: text.trim(),
            senderId: socket.userId,
            createdAt: new Date(),
          };
          await group.save();

          const populated = await Message.findById(message._id)
            .populate("senderId", "name username profilePicture")
            .populate("targetUserId", "name username profilePicture");

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

    // WebRTC Audio/Video Call Signaling
    socket.on("callUser", ({ userToCall, signalData, from, callerName, callerAvatar, callType }) => {
      io.to(userToCall).emit("incomingCall", {
        signal: signalData,
        from: from || socket.userId,
        callerName: callerName || socket.user?.name || "Caller",
        callerAvatar: callerAvatar || socket.user?.profilePicture || "",
        callType: callType || "video",
      });
    });

    socket.on("answerCall", ({ to, signal }) => {
      io.to(to).emit("callAccepted", { signal });
    });

    socket.on("rejectCall", ({ to }) => {
      io.to(to).emit("callRejected");
    });

    socket.on("endCall", ({ to }) => {
      io.to(to).emit("callEnded");
    });

    socket.on("iceCandidate", ({ to, candidate }) => {
      io.to(to).emit("iceCandidate", { candidate });
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