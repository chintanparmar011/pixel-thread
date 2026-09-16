const express = require("express");
const router = express.Router();
const { signup, signin, updateProfile, logout } = require("../controllers/authController");
const protect = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");

router.post("/signup", signup);
router.post("/signin", signin);
router.put("/profile", protect, upload.single("profilePicture"), updateProfile);
router.post("/logout", protect, logout);

module.exports = router;