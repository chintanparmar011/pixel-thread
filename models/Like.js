// models/Like.js
// Covers R.4.1: Like Post (records or removes the user's like).
// A separate collection keeps toggling and duplicate-prevention cheap
// via a unique compound index.

const mongoose = require("mongoose");

const likeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },
  },
  { timestamps: true }
);

// A user can only like a given post once
likeSchema.index({ userId: 1, postId: 1 }, { unique: true });

module.exports = mongoose.model("Like", likeSchema);
