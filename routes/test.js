var express = require("express");
var supabase = require("../database/supabase");
var Response = require("../lib/Response");
var CustomError = require("../lib/Error");
var Enum = require("../config/Enum");
var router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     HealthCheck:
 *       type: object
 *       properties:
 *         code:
 *           type: integer
 *           example: 200
 *         data:
 *           type: object
 *           properties:
 *             message:
 *               type: string
 *               example: "Petfiy API is running!"
 *             timestamp:
 *               type: string
 *               format: date-time
 *             version:
 *               type: string
 *               example: "1.0.0"
 *     DatabaseTest:
 *       type: object
 *       properties:
 *         code:
 *           type: integer
 *           example: 200
 *         data:
 *           type: object
 *           properties:
 *             message:
 *               type: string
 *               example: "Supabase connection successful!"
 *             connected:
 *               type: boolean
 *               example: true
 *             timestamp:
 *               type: string
 *               format: date-time
 *             credentials:
 *               type: object
 *               properties:
 *                 SUPABASE_URL:
 *                   type: boolean
 *                 SUPABASE_ANON_KEY:
 *                   type: boolean
 */

/**
 * @swagger
 * /test:
 *   get:
 *     summary: Health check endpoint
 *     description: Check if the API is running and healthy
 *     tags: [Testing]
 *     responses:
 *       200:
 *         description: API is running successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthCheck'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/", function (req, res, next) {
  try {
    const response = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Petfiy API is running!",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    });
    res.status(response.code).json(response);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @swagger
 * /test/db:
 *   get:
 *     summary: Database connection test
 *     description: Test Supabase database connection and credentials
 *     tags: [Testing]
 *     responses:
 *       200:
 *         description: Database connection successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DatabaseTest'
 *       500:
 *         description: Database connection failed or credentials missing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/db", async function (req, res, next) {
  try {
    // Check if Supabase credentials are configured
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Supabase credentials not configured",
        "Please set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file"
      );
    }

    // Test basic connection using Supabase health check
    const { data, error } = await supabase.rpc("version");

    if (error) {
      console.error("Supabase connection error:", error);
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Database connection failed",
        error.message + (error.hint ? ` - ${error.hint}` : "")
      );
    }

    const response = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Supabase connection successful!",
      connected: true,
      timestamp: new Date().toISOString(),
      credentials: {
        SUPABASE_URL: !!process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
      },
    });

    res.status(response.code).json(response);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @swagger
 * /test/env:
 *   get:
 *     summary: Environment variables check
 *     description: Check which environment variables are configured
 *     tags: [Testing]
 *     responses:
 *       200:
 *         description: Environment variables status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 */
router.get("/env", function (req, res, next) {
  try {
    const response = Response.successResponse(Enum.HTTP_CODES.OK, {
      environment: process.env.NODE_ENV || "development",
      configured: {
        SUPABASE_URL: !!process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
        NODE_ENV: !!process.env.NODE_ENV,
      },
      timestamp: new Date().toISOString(),
    });
    res.status(response.code).json(response);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

module.exports = router;
