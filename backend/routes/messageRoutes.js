const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");
const {
  getConversations,
  getChatHistory,
  uploadChatMedia,
  reactToMessage,
} = require("../controllers/messageController");

router.get("/conversations", protect, getConversations);
router.post("/upload", protect, upload.single("file"), uploadChatMedia);
router.post("/:messageId/react", protect, reactToMessage);
router.get("/:userId", protect, getChatHistory);

module.exports = router;