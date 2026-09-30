const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const AppError = require("../utils/AppError");
const { asyncHandler } = require("../middleware/errorHandler");

const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='50' fill='%23334155'/><circle cx='50' cy='38' r='18' fill='%2394a3b8'/><path d='M20 84c0-16.57 13.43-30 30-30s30 13.43 30 30z' fill='%2394a3b8'/></svg>";

const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  username: user.username,
  email: user.email,
  bio: user.bio || "",
  profilePicture: user.profilePicture || DEFAULT_AVATAR,
  status: user.status,
  userType: user.userType || "User",
  createdAt: user.createdAt,
});

const signup = asyncHandler(async (req, res) => {
  const { name, username, email, password } = req.body;
  if (!name || !username || !email || !password) {
    throw new AppError("name, username, email and password are required", 400);
  }

  const profilePicture = req.file ? req.file.path : (req.body.profilePicture || DEFAULT_AVATAR);
  const user = await User.create({
    name,
    username,
    email,
    password,
    profilePicture,
  });

  const token = generateToken(user._id, user.userType || "User");
  res.status(201).json({ user: sanitizeUser(user), token });
});

const signin = asyncHandler(async (req, res) => {
  const identifier = req.body.identifier || req.body.emailOrUsername || req.body.email || req.body.username;
  const password = req.body.password;
  if (!identifier || !password) {
    throw new AppError("identifier and password are required", 400);
  }
  const user = await User.findOne({
    $or: [{ email: identifier.toLowerCase() }, { username: identifier.toLowerCase() }],
  }).select("+password");

  if (!user) throw new AppError("Invalid credentials", 401);
  if (user.status === "suspended") throw new AppError("This account has been suspended", 403);

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw new AppError("Invalid credentials", 401);

  const token = generateToken(user._id, user.userType || "User");
  res.json({ user: sanitizeUser(user), token });
});

const getMe = asyncHandler(async (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

const updateProfile = asyncHandler(async (req, res) => {
  const { name, bio, password } = req.body;
  const user = req.user;

  if (name !== undefined) user.name = name;
  if (bio !== undefined) user.bio = bio;
  if (req.file) user.profilePicture = req.file.path;
  if (password) user.password = password; // pre-save hook rehashes it

  await user.save();
  res.json({ user: sanitizeUser(user) });
});

const logout = asyncHandler(async (req, res) => {
  // Stateless JWT — client discards token
  res.json({ message: "Logged out successfully" });
});

module.exports = { signup, signin, getMe, updateProfile, logout };