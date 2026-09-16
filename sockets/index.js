const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Message = require("../models/Message");

let io;

const initializeSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: { origin: "*" }, // tighten to your frontend origin in production
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
      next();
    } catch (err) {
      next(new Error("Not authorized, invalid token"));
    }
  });

  io.on("connection", (socket) => {
    // Personal room per user — lets any code emit to a user by ID,
    // and covers multiple open tabs/devices for the same account.
    socket.join(socket.userId);

    socket.on("sendMessage", async ({ receiverId, text }, callback) => {
      try {
        if (!receiverId || !text) {
          if (callback) callback({ error: "receiverId and text are required" });
          return;
        }
        const message = await Message.create({ senderId: socket.userId, receiverId, text });

        io.to(receiverId).emit("receiveMessage", message);
        io.to(socket.userId).emit("receiveMessage", message); // echo to sender's other tabs

        if (callback) callback({ success: true, message });
      } catch (err) {
        if (callback) callback({ error: "Failed to send message" });
      }
    });

    socket.on("typing", ({ receiverId }) => {
      if (receiverId) io.to(receiverId).emit("userTyping", { userId: socket.userId });
    });

    socket.on("disconnect", () => {
      // Add presence tracking here later if needed.
    });
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
};

module.exports = { initializeSocket, getIO };