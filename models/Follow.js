// models/Follow.js
// Covers R.5: Follow Management (Follow, Unfollow, View Followers, View Following).
// Self-referencing many-to-many join between User and User.

const mongoose = require("mongoose");

const followSchema = new mongoose.Schema(
  {
    followerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    followingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Prevent following the same user twice
followSchema.index({ followerId: 1, followingId: 1 }, { unique: true });
// Speeds up R.5.3 View Followers / R.5.4 View Following lookups
followSchema.index({ followingId: 1 });

module.exports = mongoose.model("Follow", followSchema);
