// models/Message.js
// Covers R.7: Private Messaging (Send Message, Receive Message, View Chat History)
// delivered/stored via Socket.io as per the SRS.

const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Speeds up R.7.3 View Chat History (all messages between two users, in order)
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: 1 });

module.exports = mongoose.model("Message", messageSchema);
