// Centralized error handler and async wrapper
const AppError = require("../utils/AppError");

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const errorHandler = (err, req, res, next) => {
  let error = err;

  // Handle Mongoose cast errors
  if (err.name === "CastError") {
    error = new AppError(`Invalid ${err.path}: ${err.value}`, 400);
  }

  // Handle duplicate key errors
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0];
    error = new AppError(`${field} already exists`, 409);
  }

  // Handle validation errors
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    error = new AppError(messages.join(", "), 400);
  }

  // Handle Multer upload errors
  if (err.name === "MulterError") {
    error = new AppError(err.message, 400);
  }

  const statusCode = error.statusCode || 500;
  const message = error.isOperational ? error.message : "Something went wrong";

  if (!error.isOperational) {
    console.error(err);
  }

  res.status(statusCode).json({
    status: "error",
    message,
  });
};

module.exports = { errorHandler, asyncHandler };