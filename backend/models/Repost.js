// Repost Model
const mongoose = require("mongoose");

const repostSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

repostSchema.index({ userId: 1, postId: 1 }, { unique: true });
repostSchema.index({ postId: 1, createdAt: -1 });

module.exports = mongoose.model("Repost", repostSchema);
