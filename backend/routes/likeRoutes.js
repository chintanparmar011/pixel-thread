const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const { toggleLike, getLikes } = require("../controllers/likeController");

router.post("/:postId", protect, toggleLike);
router.get("/:postId", protect, getLikes);

module.exports = router;