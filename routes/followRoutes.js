const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const { followUser, unfollowUser, getFollowers, getFollowing } = require("../controllers/followController");

router.post("/:userId", protect, followUser);
router.delete("/:userId", protect, unfollowUser);
router.get("/:userId/followers", protect, getFollowers);
router.get("/:userId/following", protect, getFollowing);

module.exports = router;