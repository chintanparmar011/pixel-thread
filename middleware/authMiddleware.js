const jwt = require("jsonwebtoken");
const User = require("../models/User");
const AppError = require("../utils/AppError");
const { asyncHandler } = require("./errorHandler");

const protect = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  let token;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }
  if (!token) throw new AppError("Not authorized, no token", 401);

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    throw new AppError("Not authorized, invalid token", 401);
  }

  const user = await User.findById(decoded.id);
  if (!user) throw new AppError("User no longer exists", 401);
  if (user.status === "suspended") throw new AppError("Account suspended", 403);

  req.user = user;
  next();
});

module.exports = protect;