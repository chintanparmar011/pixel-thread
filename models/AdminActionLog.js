// models/AdminActionLog.js
// Covers R.1.5: Suspend/Reactivate User Account, whose Processing step states
// the system "logs the admin action." This collection is that audit trail.
// adminId references an Admin (a User document with userType: "Admin").

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
      required: true,
    },
    actionType: {
      type: String,
      enum: ["suspend", "reactivate"],
      required: true,
    },
  },
  { timestamps: true }
);

adminActionLogSchema.index({ targetUserId: 1, createdAt: -1 });

module.exports = mongoose.model("AdminActionLog", adminActionLogSchema);
