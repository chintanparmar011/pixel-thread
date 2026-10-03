const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");
const {
  createGroup,
  getUserGroups,
  getGroupDetails,
  updateGroup,
  getGroupMessages,
  joinGroup,
  leaveGroup,
} = require("../controllers/groupController");

router.use(protect);

router.post("/", upload.single("icon"), createGroup);
router.get("/", getUserGroups);
router.get("/:groupId", getGroupDetails);
router.put("/:groupId", upload.single("icon"), updateGroup);
router.get("/:groupId/messages", getGroupMessages);
router.post("/:groupId/join", joinGroup);
router.post("/:groupId/leave", leaveGroup);

module.exports = router;
