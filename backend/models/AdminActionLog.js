// Admin Action Audit Log Model
const mongoose = require("mongoose");


const adminActionLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    actionType: {
      type: String,
      enum: ["suspend", "reactivate", "delete_post"],
      required: true,
    },
    details: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

adminActionLogSchema.index({ targetUserId: 1, createdAt: -1 });

module.exports = mongoose.model("AdminActionLog", adminActionLogSchema);

