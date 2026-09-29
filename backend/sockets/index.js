const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Message = require("../models/Message");

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
        io.to(socket.userId).emit("receiveMessage", populated); // echo to sender's other tabs

        if (callback) callback({ success: true, message: populated });
      } catch (err) {
        if (callback) callback({ error: "Failed to send message" });
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