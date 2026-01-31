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
        error.message,
      );
    }

    // Fetch user role for the owner
    const { data: userRole, error: roleError } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", data.user_id)
      .single();

    // Attach user_roles to the response data to match frontend expectation
    if (userRole) {
      data.user_roles = userRole;
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

    // 1. Kullanıcının kayıp hayvan ilanlarını getir
    const { data: listingsData, error: listingsError } = await supabase
      .from("lost_pet_listings")
      .select(`*,pet_type:pet_types(id, name, name_tr)`)
      .eq("user_id", userId)
      .eq("is_active", true);

    if (listingsError) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Kayıp hayvan ilanları getirilirken hata oluştu",
        listingsError.message,
      );
    }

    // 2. Eğer ilan yoksa boş array döndür
    if (!listingsData || listingsData.length === 0) {
      const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
        message: "Kayıp hayvan ilanları başarıyla getirildi",
        listings: [],
        total_count: 0,
      });
      return res.status(successResponse.code).json(successResponse);
    }

    // 3. Tüm ilan ID'lerini topla
    const listingIds = listingsData.map((listing) => listing.id);

    // 4. profile_images'leri ayrı sorguda getir
    const { data: profileImages, error: imagesError } = await supabase
      .from("profile_images")
      .select("profile_id, image_url, id")
      .in("profile_id", listingIds)
      .eq("profile_type", "lost_pet")
      .eq("is_active", true);

    if (imagesError) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Resimler getirilirken hata oluştu",
        imagesError.message,
      );
    }

    // 5. Image'ları profile_id'ye göre map'le (her ilan için ilk resmi al)
    const imageMap = {};
    if (profileImages && profileImages.length > 0) {
      profileImages.forEach((img) => {
        // Her profile_id için sadece ilk resmi al
        if (!imageMap[img.profile_id]) {
          imageMap[img.profile_id] = {
            id: img.id,
            image_url: img.image_url,
          };
        }
      });
    }

    // 6. Listing'leri image bilgisiyle birleştir
    const listingsWithImages = listingsData.map((listing) => ({
      ...listing,
      profile_images: imageMap[listing.id] ? [imageMap[listing.id]] : [],
    }));

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Kayıp hayvan ilanları başarıyla getirildi",
      listings: listingsWithImages,
      total_count: listingsWithImages.length,
    });

    return res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route PUT /lostpet/:id
 * @desc Kayıp hayvan ilanı bulundu
 * @access Private
 */
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    if (!userId) {
      throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, "User ID is required");
    }

    const { data, error } = await supabase
      .from("lost_pet_listings")
      .update({
        status: "found",
        found_date: new Date(),
      })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Kayıp hayvan ilanı bulunduğunda hata oluştu",
        error.message,
      );
    }
    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Kayıp hayvan ilanı başarıyla bulundu",
      listing: data,
    });
    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route DELETE /lostpet/:id
 * @desc Kayıp hayvan ilanı sil
 * @access Private
 */
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    if (!userId) {
      throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, "User ID is required");
    }

    const { data, error } = await supabase
      .from("lost_pet_listings")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Kayıp hayvan ilanı silinirken hata oluştu",
        error.message,
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Kayıp hayvan ilanı başarıyla silindi",
      listing: data,
    });
    res.status(successResponse.code).json(successResponse);
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
        "ID gerekli",
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
        error.message,
      );
    }
    const { image_url } = data;

    // Güvenlik: Sadece avatar dosyalarına izin ver
    if (!image_url || image_url.includes("..") || image_url.includes("/")) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Geçersiz dosya adı",
        "Dosya adı geçersiz karakterler içeriyor.",
      );
    }

    const { data: imageData, error: imageError } = await supabase.storage
      .from("lostpets")
      .download(data.image_url);

    if (imageError) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Kayıp hayvan ilanı resmi getirilirken hata oluştu",
        imageError.message,
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
