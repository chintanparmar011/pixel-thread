// models/User.js
// Covers R.1: Account Management (Sign In, Sign Up, Update Profile, Log Out,
// Suspend/Reactivate Account). status supports R.1.5 soft suspend/reactivate.
// Admin is modeled as a separate class extending User (see Admin.js).

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
      select: false, // never return password by default on find queries
    },
    bio: {
      type: String,
      default: "",
      maxlength: 250,
    },
    profilePicture: {
      type: String, // Cloudinary URL
      default: "",
    },
    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
    },
  },
  {
    timestamps: true,
    discriminatorKey: "userType", // enables Admin to extend this schema
  }
);

// Hash password before saving (R.1.2, NFR 4.3 Security)
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 10;
  this.password = await bcrypt.hash(this.password, saltRounds);
  next();
});

// Used during Sign In (R.1.1) to verify credentials
userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
