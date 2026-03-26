const express = require("express");
const supabase = require("../database/supabase");
const Response = require("../lib/Response");
const CustomError = require("../lib/Error");
const Enum = require("../config/Enum");
const { verifyToken } = require("../middleware/auth");
const router = express.Router();

const VALID_FAVORITE_TYPES = [
  "product",
  "pet_shop",
  "pet_sitter",
  "pet_clinic",
  "pet_hotel",
];

// Her favorite_type için tablo ve alan bilgileri
const TYPE_CONFIG = {
  product: {
    table: "products",
    nameField: "name",
    imageField: "image_url",
    extraFields: "price, stock_quantity",
    routePrefix: "products",
  },
  pet_shop: {
    table: "pet_shop_profiles",
    nameField: "shop_name",
    imageField: "logo_url",
    extraFields: "address, phone_number",
    routePrefix: "shops",
  },
  pet_sitter: {
    table: "pet_sitter_profiles",
    nameField: "display_name",
    imageField: "logo_url",
    extraFields: "bio, is_available",
    routePrefix: "sitters",
  },
  pet_clinic: {
    table: "clinic_profiles",
    nameField: "clinic_name",
    imageField: "logo_url",
    extraFields: "address, phone_number",
    routePrefix: "clinics",
  },
  pet_hotel: {
    table: "pet_hotel_profiles",
    nameField: "hotel_name",
    imageField: "logo_url",
    extraFields: "address, phone_number",
    routePrefix: "hotels",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /favorites/toggle
// Favori ekle veya kaldır (toggle)
// Body: { favorite_type, target_id }
// ─────────────────────────────────────────────────────────────────────────────
router.post("/toggle", verifyToken, async (req, res) => {
  try {
    const { favorite_type, target_id } = req.body;
    const userId = req.user.id;

    if (!favorite_type || !target_id) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Eksik alan",
        "favorite_type ve target_id zorunludur."
      );
    }

    if (!VALID_FAVORITE_TYPES.includes(favorite_type)) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Geçersiz favori tipi",
        `favorite_type şunlardan biri olmalı: ${VALID_FAVORITE_TYPES.join(", ")}`
      );
    }

    // Favori var mı kontrol et
    const { data: existing, error: checkError } = await supabase
      .from("favorites")
      .select("id")
      .eq("user_id", userId)
      .eq("favorite_type", favorite_type)
      .eq("target_id", target_id)
      .maybeSingle();

    if (checkError) throw checkError;

    if (existing) {
      // Favoriden kaldır
      const { error: deleteError } = await supabase
        .from("favorites")
        .delete()
        .eq("id", existing.id);

      if (deleteError) throw deleteError;

      const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
        message: "Favorilerden kaldırıldı.",
        is_favorited: false,
        favorite_type,
        target_id,
      });
      return res.status(successResponse.code).json(successResponse);
    } else {
      // Favorilere ekle
      const { data, error: insertError } = await supabase
        .from("favorites")
        .insert({
          user_id: userId,
          favorite_type,
          target_id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const successResponse = Response.successResponse(Enum.HTTP_CODES.CREATED, {
        message: "Favorilere eklendi.",
        is_favorited: true,
        favorite_type,
        target_id,
        favorite: data,
      });
      return res.status(successResponse.code).json(successResponse);
    }
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    return res.status(errorResponse.code).json(errorResponse);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /favorites
// Kullanıcının favorilerini listele (opsiyonel: ?favorite_type=... ile filtrele)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { favorite_type } = req.query;

    if (favorite_type && !VALID_FAVORITE_TYPES.includes(favorite_type)) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Geçersiz favori tipi",
        `favorite_type şunlardan biri olmalı: ${VALID_FAVORITE_TYPES.join(", ")}`
      );
    }

    // Favori kayıtlarını çek
    let query = supabase
      .from("favorites")
      .select("id, favorite_type, target_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (favorite_type) {
      query = query.eq("favorite_type", favorite_type);
    }

    const { data: favorites, error: favError } = await query;
    if (favError) throw favError;

    if (!favorites || favorites.length === 0) {
      const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
        message: "Favoriler başarıyla getirildi.",
        data: [],
      });
      return res.status(successResponse.code).json(successResponse);
    }

    // Her favorite_type için ayrı ayrı target bilgilerini zenginleştir
    const typesToFetch = favorite_type
      ? [favorite_type]
      : [...new Set(favorites.map((f) => f.favorite_type))];

    const detailsMap = {};

    for (const type of typesToFetch) {
      const config = TYPE_CONFIG[type];
      if (!config) continue;

      const ids = favorites
        .filter((f) => f.favorite_type === type)
        .map((f) => f.target_id);

      if (ids.length === 0) continue;

      const selectFields = `id, ${config.nameField}, ${config.imageField}, ${config.extraFields}`;

      const { data: items, error: itemsError } = await supabase
        .from(config.table)
        .select(selectFields)
        .in("id", ids);

      if (!itemsError && items) {
        items.forEach((item) => {
          detailsMap[`${type}_${item.id}`] = {
            ...item,
            _name: item[config.nameField],
            _image: item[config.imageField],
            _route_prefix: config.routePrefix,
          };
        });
      }
    }

    // Favori listesini zenginleştir
    const enrichedFavorites = favorites.map((fav) => {
      const detail = detailsMap[`${fav.favorite_type}_${fav.target_id}`] || null;
      return {
        id: fav.id,
        favorite_type: fav.favorite_type,
        target_id: fav.target_id,
        created_at: fav.created_at,
        detail,
      };
    });

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Favoriler başarıyla getirildi.",
      data: enrichedFavorites,
    });
    return res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    return res.status(errorResponse.code).json(errorResponse);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /favorites/check/:favoriteType/:targetId
// Belirli bir öğenin favori durumunu kontrol et
// ─────────────────────────────────────────────────────────────────────────────
router.get("/check/:favoriteType/:targetId", verifyToken, async (req, res) => {
  try {
    const { favoriteType, targetId } = req.params;
    const userId = req.user.id;

    if (!VALID_FAVORITE_TYPES.includes(favoriteType)) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Geçersiz favori tipi",
        `favorite_type şunlardan biri olmalı: ${VALID_FAVORITE_TYPES.join(", ")}`
      );
    }

    const { data, error } = await supabase
      .from("favorites")
      .select("id")
      .eq("user_id", userId)
      .eq("favorite_type", favoriteType)
      .eq("target_id", targetId)
      .maybeSingle();

    if (error) throw error;

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      is_favorited: !!data,
      favorite_type: favoriteType,
      target_id: targetId,
    });
    return res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    return res.status(errorResponse.code).json(errorResponse);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /favorites/counts/:favoriteType/:targetId
// Bir öğenin toplam favori sayısını getir
// ─────────────────────────────────────────────────────────────────────────────
router.get("/counts/:favoriteType/:targetId", verifyToken, async (req, res) => {
  try {
    const { favoriteType, targetId } = req.params;

    if (!VALID_FAVORITE_TYPES.includes(favoriteType)) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Geçersiz favori tipi",
        `favorite_type şunlardan biri olmalı: ${VALID_FAVORITE_TYPES.join(", ")}`
      );
    }

    const { data, error } = await supabase
      .from("favorite_counts")
      .select("count")
      .eq("favorite_type", favoriteType)
      .eq("target_id", targetId)
      .maybeSingle();

    if (error) throw error;

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      favorite_type: favoriteType,
      target_id: targetId,
      count: data?.count ?? 0,
    });
    return res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    return res.status(errorResponse.code).json(errorResponse);
  }
});

module.exports = router;
