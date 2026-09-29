const AppError = require("../utils/AppError");

const requireAdmin = (req, res, next) => {
  if (req.user.userType !== "Admin") {
    return next(new AppError("Admin access required", 403));
  }
  next();
};

module.exports = requireAdmin;