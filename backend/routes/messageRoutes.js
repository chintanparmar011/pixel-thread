const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const { getConversations, getChatHistory } = require("../controllers/messageController");

router.get("/conversations", protect, getConversations);
router.get("/:userId", protect, getChatHistory);

module.exports = router;