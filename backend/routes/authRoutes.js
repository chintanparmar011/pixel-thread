const express = require("express");
const router = express.Router();
const { signup, signin, getMe, updateProfile, logout } = require("../controllers/authController");
const protect = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");

router.post("/signup", upload.single("profilePicture"), signup);
router.post("/signin", signin);
router.get("/me", protect, getMe);
router.put("/profile", protect, upload.single("profilePicture"), updateProfile);
router.post("/logout", protect, logout);

module.exports = router;