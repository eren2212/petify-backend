const supabase = require("../database/supabase");
const Response = require("../lib/Response");
const CustomError = require("../lib/Error");
const Enum = require("../config/Enum");

/**
 * Middleware to verify JWT token from Supabase Auth
 */
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new CustomError(
        Enum.HTTP_CODES.UNAUTHORIZED,
        "Kimlik doğrulama gerekli",
        "Lütfen geçerli bir Bearer token sağlayın."
      );
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify the JWT token with Supabase
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      throw new CustomError(
        Enum.HTTP_CODES.UNAUTHORIZED,
        "Geçersiz veya süresi dolmuş token",
        "Oturumunuz sonlanmış. Lütfen tekrar giriş yapın."
      );
    }

    // Add user info to request object
    req.user = user;
    req.token = token;

    next();
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    return res.status(errorResponse.code).json(errorResponse);
  }
};

/**
 * Optional auth middleware - doesn't fail if no token provided
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);

      if (!error && user) {
        req.user = user;
        req.token = token;
      }
    }

    next();
  } catch (error) {
    // Silently continue without auth for optional middleware
    next();
  }
};

/**
 * Check if user has specific role
 */
const requireRole = (requiredRole) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new CustomError(
          Enum.HTTP_CODES.UNAUTHORIZED,
          "Kimlik doğrulama gerekli",
          "Lütfen önce giriş yapın."
        );
      }

      const userRole = req.user.user_metadata?.role || "user";

      if (userRole !== requiredRole && userRole !== "admin") {
        throw new CustomError(
          Enum.HTTP_CODES.FORBIDDEN,
          "Yetersiz yetki",
          `Bu işlem için ${requiredRole} rolüne sahip olmanız gerekiyor. Mevcut rolünüz: ${userRole}`
        );
      }

      next();
    } catch (error) {
      const errorResponse = Response.errorResponse(error);
      return res.status(errorResponse.code).json(errorResponse);
    }
  };
};

module.exports = {
  verifyToken,
  optionalAuth,
  requireRole,
};
