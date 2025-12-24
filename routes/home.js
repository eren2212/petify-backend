const express = require("express");
const supabase = require("../database/supabase");
const Response = require("../lib/Response");
const CustomError = require("../lib/Error");
const Enum = require("../config/Enum");
const { verifyToken } = require("../middleware/auth");
const router = express.Router();

/**
 * @route GET /home/banners
 * @desc Ana sayfa slider/banner'ları getir
 * @access Private
 */
router.get("/banners", verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("home_banners")
      .select("*")
      .eq("is_active", true)
      .lte("start_date", new Date().toISOString())
      .or(`end_date.gte.${new Date().toISOString()},end_date.is.null`)
      .order("display_order", { ascending: true });

    if (error) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Banner'lar getirilirken bir hata oluştu",
        error.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Banner'lar başarıyla getirildi",
      data: data || [],
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route GET /home/featured-products
 * @desc Ana sayfa için rastgele ürünler getir
 * @access Private
 */
router.get("/featured-products", verifyToken, async (req, res) => {
  try {
    // Rastgele 10 aktif ürün seç (stokta olan)
    const { data, error } = await supabase.rpc("get_random_products", {
      limit_count: 10,
    });

    if (error) {
      // RPC fonksiyonu yoksa fallback olarak normal query kullan
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("products")
        .select(
          `
          id,
          name,
          description,
          price,
          stock_quantity,
          is_featured,
          created_at,
          product_images (
            image_url,
            display_order
          ),
          pet_shop_profiles (
            shop_name,
            logo_url
          )
        `
        )
        .eq("is_active", true)
        .gt("stock_quantity", 0)
        .order("created_at", { ascending: false })
        .limit(10);

      if (fallbackError) {
        throw new CustomError(
          Enum.HTTP_CODES.BAD_REQUEST,
          "Ürünler getirilirken bir hata oluştu",
          fallbackError.message
        );
      }

      // Her ürün için ilk resmi al
      const formattedData = (fallbackData || []).map((product) => ({
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        stock_quantity: product.stock_quantity,
        is_featured: product.is_featured,
        image_url: product.product_images?.[0]?.image_url || null,
        shop_name: product.pet_shop_profiles?.shop_name || "Bilinmeyen Mağaza",
        shop_logo: product.pet_shop_profiles?.logo_url || null,
      }));

      const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
        message: "Ürünler başarıyla getirildi",
        data: formattedData,
      });

      return res.status(successResponse.code).json(successResponse);
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Ürünler başarıyla getirildi",
      data: data || [],
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route GET /home/clinics
 * @desc Ana sayfa için rastgele pet clinic'leri getir
 * @access Private
 */
router.get("/clinics", verifyToken, async (req, res) => {
  try {
    // PostgreSQL RANDOM() ile rastgele 10 klinik seç
    const { data, error } = await supabase
      .from("pet_clinic_profiles")
      .select(
        `
        id,
        clinic_name,
        description,
        logo_url,
        address,
        latitude,
        longitude,
        phone_number,
        working_hours,
        average_rating,
        total_reviews,
        created_at
      `
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Klinikler getirilirken bir hata oluştu",
        error.message
      );
    }

    // Rastgele sıralama için JavaScript ile shuffle
    const shuffledData = (data || []).sort(() => Math.random() - 0.5);

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Klinikler başarıyla getirildi",
      data: shuffledData,
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route GET /home/hotels
 * @desc Ana sayfa için rastgele pet hotel'leri getir
 * @access Private
 */
router.get("/hotels", verifyToken, async (req, res) => {
  try {
    // PostgreSQL RANDOM() ile rastgele 10 otel seç
    const { data, error } = await supabase
      .from("pet_hotel_profiles")
      .select(
        `
        id,
        hotel_name,
        description,
        logo_url,
        address,
        latitude,
        longitude,
        phone_number,
        working_hours,
        average_rating,
        total_reviews,
        created_at
      `
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Oteller getirilirken bir hata oluştu",
        error.message
      );
    }

    // Rastgele sıralama için JavaScript ile shuffle
    const shuffledData = (data || []).sort(() => Math.random() - 0.5);

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Oteller başarıyla getirildi",
      data: shuffledData,
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route GET /home/sitters
 * @desc Ana sayfa için rastgele pet sitter'ları getir
 * @access Private
 */
router.get("/sitters", verifyToken, async (req, res) => {
  try {
    // PostgreSQL RANDOM() ile rastgele 10 bakıcı seç
    const { data, error } = await supabase
      .from("pet_sitter_profiles")
      .select(
        `
        id,
        sitter_name,
        description,
        profile_image_url,
        address,
        latitude,
        longitude,
        phone_number,
        experience_years,
        hourly_rate,
        average_rating,
        total_reviews,
        created_at
      `
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Bakıcılar getirilirken bir hata oluştu",
        error.message
      );
    }

    // Rastgele sıralama için JavaScript ile shuffle
    const shuffledData = (data || []).sort(() => Math.random() - 0.5);

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Bakıcılar başarıyla getirildi",
      data: shuffledData,
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

// ==================== IMAGE SERVING ENDPOINTS ====================

/**
 * @route GET /home/images/product/:filename
 * @desc Ürün resmini serve et
 * @access Public
 */
router.get("/images/product/:filename", async (req, res) => {
  try {
    const { filename } = req.params;

    // Güvenlik: Sadece geçerli dosya adlarına izin ver
    if (!filename || filename.includes("..") || filename.includes("/")) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Geçersiz dosya adı",
        "Dosya adı geçersiz karakterler içeriyor."
      );
    }

    // Supabase Storage'dan dosyayı download et
    const { data, error } = await supabase.storage
      .from("productimages")
      .download(filename);

    if (error || !data) {
      throw new CustomError(
        Enum.HTTP_CODES.NOT_FOUND,
        "Ürün resmi bulunamadı",
        "İstenen ürün resmi bulunamadı."
      );
    }

    // Dosya tipini belirle
    const contentType = filename.endsWith(".png")
      ? "image/png"
      : filename.endsWith(".webp")
      ? "image/webp"
      : "image/jpeg";

    // Buffer'a çevir ve gönder
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000"); // 1 yıl cache
    res.send(buffer);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    return res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route GET /home/images/banner/:filename
 * @desc Banner resmini serve et
 * @access Public
 */
router.get("/images/banner/:filename", async (req, res) => {
  try {
    const { filename } = req.params;

    // Güvenlik: Sadece geçerli dosya adlarına izin ver
    if (!filename || filename.includes("..") || filename.includes("/")) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Geçersiz dosya adı",
        "Dosya adı geçersiz karakterler içeriyor."
      );
    }

    // Supabase Storage'dan dosyayı download et
    const { data, error } = await supabase.storage
      .from("home-banners")
      .download(filename);

    if (error || !data) {
      throw new CustomError(
        Enum.HTTP_CODES.NOT_FOUND,
        "Banner resmi bulunamadı",
        "İstenen banner resmi bulunamadı."
      );
    }

    // Dosya tipini belirle
    const contentType = filename.endsWith(".png")
      ? "image/png"
      : filename.endsWith(".webp")
      ? "image/webp"
      : "image/jpeg";

    // Buffer'a çevir ve gönder
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000"); // 1 yıl cache
    res.send(buffer);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    return res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route GET /home/images/clinic-logo/:filename
 * @desc Pet clinic logo'sunu serve et
 * @access Public
 */
router.get("/images/clinic-logo/:filename", async (req, res) => {
  try {
    const { filename } = req.params;

    // Güvenlik: Sadece geçerli dosya adlarına izin ver
    if (!filename || filename.includes("..") || filename.includes("/")) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Geçersiz dosya adı",
        "Dosya adı geçersiz karakterler içeriyor."
      );
    }

    // Supabase Storage'dan dosyayı download et
    const { data, error } = await supabase.storage
      .from("petclinicprofiles")
      .download(filename);

    if (error || !data) {
      throw new CustomError(
        Enum.HTTP_CODES.NOT_FOUND,
        "Klinik logosu bulunamadı",
        "İstenen klinik logosu bulunamadı."
      );
    }

    // Dosya tipini belirle
    const contentType = filename.endsWith(".png")
      ? "image/png"
      : filename.endsWith(".webp")
      ? "image/webp"
      : "image/jpeg";

    // Buffer'a çevir ve gönder
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000"); // 1 yıl cache
    res.send(buffer);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    return res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route GET /home/images/hotel-logo/:filename
 * @desc Pet hotel logo'sunu serve et
 * @access Public
 */
router.get("/images/hotel-logo/:filename", async (req, res) => {
  try {
    const { filename } = req.params;

    // Güvenlik: Sadece geçerli dosya adlarına izin ver
    if (!filename || filename.includes("..") || filename.includes("/")) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Geçersiz dosya adı",
        "Dosya adı geçersiz karakterler içeriyor."
      );
    }

    // Supabase Storage'dan dosyayı download et
    const { data, error } = await supabase.storage
      .from("pethotelprofiles")
      .download(filename);

    if (error || !data) {
      throw new CustomError(
        Enum.HTTP_CODES.NOT_FOUND,
        "Otel logosu bulunamadı",
        "İstenen otel logosu bulunamadı."
      );
    }

    // Dosya tipini belirle
    const contentType = filename.endsWith(".png")
      ? "image/png"
      : filename.endsWith(".webp")
      ? "image/webp"
      : "image/jpeg";

    // Buffer'a çevir ve gönder
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000"); // 1 yıl cache
    res.send(buffer);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    return res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route GET /home/images/sitter-profile/:filename
 * @desc Pet sitter profil resmini serve et
 * @access Public
 */
router.get("/images/sitter-profile/:filename", async (req, res) => {
  try {
    const { filename } = req.params;

    // Güvenlik: Sadece geçerli dosya adlarına izin ver
    if (!filename || filename.includes("..") || filename.includes("/")) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Geçersiz dosya adı",
        "Dosya adı geçersiz karakterler içeriyor."
      );
    }

    // Supabase Storage'dan dosyayı download et
    const { data, error } = await supabase.storage
      .from("petsitterprofiles")
      .download(filename);

    if (error || !data) {
      throw new CustomError(
        Enum.HTTP_CODES.NOT_FOUND,
        "Bakıcı profil resmi bulunamadı",
        "İstenen bakıcı profil resmi bulunamadı."
      );
    }

    // Dosya tipini belirle
    const contentType = filename.endsWith(".png")
      ? "image/png"
      : filename.endsWith(".webp")
      ? "image/webp"
      : "image/jpeg";

    // Buffer'a çevir ve gönder
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000"); // 1 yıl cache
    res.send(buffer);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    return res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route GET /home/images/shop-logo/:filename
 * @desc Pet shop logo'sunu serve et
 * @access Public
 */
router.get("/images/shop-logo/:filename", async (req, res) => {
  try {
    const { filename } = req.params;

    // Güvenlik: Sadece geçerli dosya adlarına izin ver
    if (!filename || filename.includes("..") || filename.includes("/")) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Geçersiz dosya adı",
        "Dosya adı geçersiz karakterler içeriyor."
      );
    }

    // Supabase Storage'dan dosyayı download et
    const { data, error } = await supabase.storage
      .from("petshopprofiles")
      .download(filename);

    if (error || !data) {
      throw new CustomError(
        Enum.HTTP_CODES.NOT_FOUND,
        "Mağaza logosu bulunamadı",
        "İstenen mağaza logosu bulunamadı."
      );
    }

    // Dosya tipini belirle
    const contentType = filename.endsWith(".png")
      ? "image/png"
      : filename.endsWith(".webp")
      ? "image/webp"
      : "image/jpeg";

    // Buffer'a çevir ve gönder
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000"); // 1 yıl cache
    res.send(buffer);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    return res.status(errorResponse.code).json(errorResponse);
  }
});

module.exports = router;
