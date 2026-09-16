const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");
const { createPost, deletePost, getFeed, getUserPosts } = require("../controllers/postController");

router.post("/", protect, upload.single("image"), createPost);
router.delete("/:postId", protect, deletePost);
router.get("/feed", protect, getFeed);
router.get("/user/:userId", protect, getUserPosts);

module.exports = router;