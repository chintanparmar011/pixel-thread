const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");
const {
  searchUsers,
  getSuggestedUsers,
  getUserProfile,
  suspendUser,
  reactivateUser,
} = require("../controllers/userController");

router.get("/search", protect, searchUsers);
router.get("/suggested", protect, getSuggestedUsers);
router.get("/:username", protect, getUserProfile);
router.patch("/:userId/suspend", protect, requireAdmin, suspendUser);
router.patch("/:userId/reactivate", protect, requireAdmin, reactivateUser);

module.exports = router;