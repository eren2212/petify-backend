const express = require("express");
const multer = require("multer");
const supabase = require("../database/supabase");
const Response = require("../lib/Response");
const CustomError = require("../lib/Error");
const Enum = require("../config/Enum");
const { verifyToken } = require("../middleware/auth");
const router = express.Router();

/**
 * @route GET /lostpet/:id
 * @desc Kayıp hayvan ilanını getir
 * @access Private
 */
router.get("/detail/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!id) {
      throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, "ID is required");
    }

    if (!userId) {
      throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, "User ID is required");
    }

    const { data, error } = await supabase
      .from("lost_pet_listings")
      .select(`*,pet_type:pet_types(id, name, name_tr)`)
      .eq("id", id)
      .eq("is_active", true)
      .single();

    if (error) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Kayıp hayvan ilanı bulunamadı",
        error.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Kayıp hayvan ilanı başarıyla getirildi",
      listing: data,
    });

    return res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    return res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route GET /lostpet/my/listings
 * @desc Kayıp hayvan ilanlarını getir
 * @access Private
 */
router.get("/my/listings", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    if (!userId) {
      throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, "User ID is required");
    }

    const { data, error } = await supabase
      .from("lost_pet_listings")
      .select("*")
      .eq("user_id", userId);

    if (error) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Kayıp hayvan ilanları getirilirken hata oluştu",
        error.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Kayıp hayvan ilanları başarıyla getirildi",
      listings: data,
    });

    return res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route GET /lostpet/image/:id
 * @desc Kayıp hayvan ilanı resmini getir
 * @access Public
 */
router.get("/image/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "ID gerekli",
        "ID gerekli"
      );
    }

    const { data, error } = await supabase
      .from("profile_images")
      .select("image_url")
      .eq("profile_id", id)
      .eq("profile_type", "lost_pet")
      .single();

    if (error) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Kayıp hayvan ilanı resmi getirilirken hata oluştu",
        error.message
      );
    }
    const { image_url } = data;

    // Güvenlik: Sadece avatar dosyalarına izin ver
    if (!image_url || image_url.includes("..") || image_url.includes("/")) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Geçersiz dosya adı",
        "Dosya adı geçersiz karakterler içeriyor."
      );
    }

    const { data: imageData, error: imageError } = await supabase.storage
      .from("lostpets")
      .download(data.image_url);

    if (imageError) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Kayıp hayvan ilanı resmi getirilirken hata oluştu",
        imageError.message
      );
    }
    const contentType = image_url.endsWith(".png")
      ? "image/png"
      : image_url.endsWith(".webp")
      ? "image/webp"
      : "image/jpeg";

    const arrayBuffer = await imageData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000"); // 1 yıl cache
    res.send(buffer);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});
module.exports = router;
