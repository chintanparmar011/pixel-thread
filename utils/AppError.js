// utils/AppError.js
// Lets controllers throw a typed, client-safe error instead of a raw
// Error or an ad-hoc res.status(...).json(...) in every route.
// Usage: throw new AppError("User not found", 404);

class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // distinguishes expected errors from bugs
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;