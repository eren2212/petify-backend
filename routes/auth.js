var express = require("express");
var supabase = require("../database/supabase");
var Response = require("../lib/Response");
var CustomError = require("../lib/Error");
var Enum = require("../config/Enum");
var { verifyToken } = require("../middleware/auth");
var router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     LoginRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: "user@example.com"
 *         password:
 *           type: string
 *           minLength: 6
 *           example: "password123"
 *     RegisterRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *         - fullName
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: "user@example.com"
 *         password:
 *           type: string
 *           minLength: 6
 *           example: "password123"
 *         fullName:
 *           type: string
 *           example: "John Doe"
 *         phone:
 *           type: string
 *           example: "+90 555 123 45 67"
 *     AuthResponse:
 *       type: object
 *       properties:
 *         code:
 *           type: integer
 *           example: 200
 *         data:
 *           type: object
 *           properties:
 *             user:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 email:
 *                   type: string
 *                 user_metadata:
 *                   type: object
 *             session:
 *               type: object
 *               properties:
 *                 access_token:
 *                   type: string
 *                 refresh_token:
 *                   type: string
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     description: Create a new user account with Supabase Auth
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Invalid input or user already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/register", async function (req, res, next) {
  try {
    const { email, password, fullName, phone } = req.body;

    // Validation
    if (!email || !password || !fullName) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Missing required fields",
        "Email, password, and fullName are required"
      );
    }

    if (password.length < 6) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Password too short",
        "Password must be at least 6 characters long"
      );
    }

    // Register with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone || null,
          role: "user",
        },
      },
    });

    if (error) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Registration failed",
        error.message
      );
    }

    const response = Response.successResponse(Enum.HTTP_CODES.CREATED, {
      user: data.user,
      session: data.session,
      message:
        "User registered successfully. Please check your email for verification.",
    });

    res.status(response.code).json(response);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     description: Authenticate user with email and password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/login", async function (req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Missing credentials",
        "Email and password are required"
      );
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new CustomError(
        Enum.HTTP_CODES.UNAUTHORIZED,
        "Login failed",
        error.message
      );
    }

    const response = Response.successResponse(Enum.HTTP_CODES.OK, {
      user: data.user,
      session: data.session,
      message: "Login successful",
    });

    res.status(response.code).json(response);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout user
 *     description: Sign out the current user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 */
router.post("/logout", verifyToken, async function (req, res, next) {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Logout failed",
        error.message
      );
    }

    const response = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Logout successful",
    });

    res.status(response.code).json(response);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current user
 *     description: Get the authenticated user's information
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/me", verifyToken, function (req, res, next) {
  try {
    const response = Response.successResponse(Enum.HTTP_CODES.OK, {
      user: req.user,
      message: "User information retrieved successfully",
    });

    res.status(response.code).json(response);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     description: Refresh the access token using refresh token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refresh_token
 *             properties:
 *               refresh_token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 */
router.post("/refresh", async function (req, res, next) {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Refresh token required",
        "Please provide a valid refresh token"
      );
    }

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token,
    });

    if (error) {
      throw new CustomError(
        Enum.HTTP_CODES.UNAUTHORIZED,
        "Token refresh failed",
        error.message
      );
    }

    const response = Response.successResponse(Enum.HTTP_CODES.OK, {
      user: data.user,
      session: data.session,
      message: "Token refreshed successfully",
    });

    res.status(response.code).json(response);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

module.exports = router;
