const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  checkFollowStatus,
} = require("../controllers/followController");

router.post("/:userId", protect, followUser);
router.delete("/:userId", protect, unfollowUser);
router.get("/:userId/followers", protect, getFollowers);
router.get("/:userId/following", protect, getFollowing);
router.get("/:userId/status", protect, checkFollowStatus);

module.exports = router;