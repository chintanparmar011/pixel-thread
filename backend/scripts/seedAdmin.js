// Seed initial administrator account


require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const validateEnv = require("../config/validateEnv");
require("../models/User");
require("../models/Admin");

const Admin = mongoose.model("Admin");

const ADMIN_DATA = {
  name: process.env.SEED_ADMIN_NAME || "Admin",
  username: process.env.SEED_ADMIN_USERNAME,
  email: process.env.SEED_ADMIN_EMAIL,
  password: process.env.SEED_ADMIN_PASSWORD,
};

const run = async () => {
  validateEnv();

  if (!ADMIN_DATA.username || !ADMIN_DATA.email || !ADMIN_DATA.password) {
    console.error(
      "Missing SEED_ADMIN_USERNAME, SEED_ADMIN_EMAIL or SEED_ADMIN_PASSWORD in .env. " +
      "Set these temporarily before running this script."
    );
    process.exit(1);
  }

  await connectDB();

  const existing = await Admin.findOne({
    $or: [{ username: ADMIN_DATA.username.toLowerCase() }, { email: ADMIN_DATA.email.toLowerCase() }],
  });

  if (existing) {
    console.log(`Admin already exists: ${existing.username} (${existing.email})`);
    process.exit(0);
  }

  const admin = await Admin.create(ADMIN_DATA);
  console.log(`Admin created: ${admin.username} (${admin._id})`);
  process.exit(0);
};

run().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});