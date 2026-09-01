// models/Admin.js
// Implements the Admin --|> User generalization from the class diagram using
// a Mongoose discriminator: Admin documents live in the same "users"
// collection as User, tagged with userType: "Admin", and inherit every
// User field/method (comparePassword, etc.) automatically.

const mongoose = require("mongoose");
const User = require("./User");

const adminSchema = new mongoose.Schema({
  // No additional fields for now - matches the class diagram.
  // Add admin-specific fields here later if needed.
});

const Admin = User.discriminator("Admin", adminSchema);

module.exports = Admin;
