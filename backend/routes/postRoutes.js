const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");
const { createPost, getPostById, deletePost, getFeed, getUserPosts } = require("../controllers/postController");

router.post("/", protect, upload.single("image"), createPost);
router.get("/feed", protect, getFeed);
router.get("/user/:userId", protect, getUserPosts);
router.get("/:postId", protect, getPostById);
router.delete("/:postId", protect, deletePost);

module.exports = router;