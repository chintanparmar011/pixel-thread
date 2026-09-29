const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");
const {
  getDashboardStats,
  getAllUsers,
  updateUserStatus,
  getAllPosts,
  deletePostAsAdmin,
  getAdminLogs,
} = require("../controllers/adminController");

// All admin routes require valid authentication and Admin role
router.use(protect, requireAdmin);

router.get("/stats", getDashboardStats);
router.get("/users", getAllUsers);
router.patch("/users/:userId/status", updateUserStatus);
router.get("/posts", getAllPosts);
router.delete("/posts/:postId", deletePostAsAdmin);
router.get("/logs", getAdminLogs);

module.exports = router;
