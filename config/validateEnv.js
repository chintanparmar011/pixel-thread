// config/validateEnv.js
// Fails fast on startup if required env vars are missing, instead of
// letting the app boot into a broken state (e.g. JWT_SECRET undefined
// silently signing tokens with "undefined").

const REQUIRED_VARS = ["MONGO_URI", "JWT_SECRET", "JWT_EXPIRES_IN", "BCRYPT_SALT_ROUNDS"];

const validateEnv = () => {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        `Copy .env.example to .env and fill these in.`
    );
    process.exit(1);
  }
};

module.exports = validateEnv;