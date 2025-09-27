var express = require("express");
var supabase = require("../database/supabase");
var Response = require("../lib/Response");
var CustomError = require("../lib/Error");
var Enum = require("../config/Enum");
var router = express.Router();

/* GET users listing */
router.get("/", async function (req, res, next) {
  try {
    // Bu endpoint henüz implement edilmedi
    // Gelecekte user CRUD işlemleri burada olacak
    const response = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Users endpoint - Coming soon!",
      timestamp: new Date().toISOString(),
    });
    res.status(response.code).json(response);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

module.exports = router;
