const express = require("express");
const multer = require("multer");
const supabase = require("../database/supabase");
const Response = require("../lib/Response");
const CustomError = require("../lib/Error");
const Enum = require("../config/Enum");
const { verifyToken } = require("../middleware/auth");
const router = express.Router();
const z = require("zod");

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB maksimum
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Sadece resim dosyaları yüklenebilir!"));
    }
  },
});

/**
 * @route GET /petsitterservices/categories
 * @desc Pet sitter service categories
 * @access Private
 */

router.get("/categories", verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("pet_sitter_service_categories")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Pet sitter service categories not found",
        error.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Pet sitter service categories fetched successfully",
      data: data,
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

module.exports = router;
