// server.js
// Entry point: connects to MongoDB and registers all models.
// Route/controller logic for R.1-R.7 gets added on top of this next.

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

// Models are registered with Mongoose simply by requiring them once.
// Admin must be required AFTER User since it extends User's schema.
require("./models/User");
require("./models/Admin");
require("./models/Post");
require("./models/Comment");
require("./models/Like");
require("./models/Follow");
require("./models/Message");
require("./models/AdminActionLog");

const app = express();
app.use(cors());
app.use(express.json());

// Quick health check route to confirm the server is up
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "PixelThread API is running" });
});

const startServer = async () => {
  await connectDB();

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`PixelThread API running on port ${PORT}`);
  });
};

startServer();
