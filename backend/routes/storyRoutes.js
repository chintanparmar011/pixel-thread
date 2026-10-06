const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");
const {
  createStory,
  getStoriesFeed,
  recordStoryView,
  deleteStory,
} = require("../controllers/storyController");

router.post("/", protect, upload.single("media"), createStory);
router.get("/feed", protect, getStoriesFeed);
router.post("/:id/view", protect, recordStoryView);
router.delete("/:id", protect, deleteStory);

module.exports = router;
