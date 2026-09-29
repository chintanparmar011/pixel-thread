// Post Model
const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    image: {
      type: String,
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

postSchema.index({ authorId: 1, createdAt: -1 });

module.exports = mongoose.model("Post", postSchema);
