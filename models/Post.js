// models/Post.js
// Covers R.2: Post Management (Upload Image, Create Post, Delete Post, View Posts)

const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    image: {
      type: String, // Cloudinary URL from R.2.1 Upload Image
      default: "",
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Speeds up R.3.1 Home Feed queries (posts from followed users, newest first)
postSchema.index({ authorId: 1, createdAt: -1 });

module.exports = mongoose.model("Post", postSchema);
