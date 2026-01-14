const express = require("express");
const supabase = require("../database/supabase");
const Response = require("../lib/Response");
const CustomError = require("../lib/Error");
const Enum = require("../config/Enum");
const { verifyToken } = require("../middleware/auth");
const router = express.Router();
const z = require("zod");

/**
 * @route GET /map/nearby
 * @desc Harita için yakındaki tüm ilanları ve profilleri getir
 * @access Private
 * @query {number} latitude - Kullanıcının enlemi (required)
 * @query {number} longitude - Kullanıcının boylamı (required)
 * @query {number} radius - Arama yarıçapı metre cinsinden (optional, default: 50000 = 50km)
 * @query {string} types - Getir edilecek tipler (optional, comma separated: adoption,lost_pet,clinic,hotel,shop)
 */
router.get("/nearby", verifyToken, async (req, res) => {
  // Query paramları için Zod validasyonu
  const nearbySchema = z.object({
    latitude: z.coerce
      .number()
      .min(-90, "Geçersiz enlem değeri")
      .max(90, "Geçersiz enlem değeri"),
    longitude: z.coerce
      .number()
      .min(-180, "Geçersiz boylam değeri")
      .max(180, "Geçersiz boylam değeri"),
    radius: z.coerce
      .number()
      .min(100, "Arama yarıçapı en az 100m olmalı")
      .max(50000, "Arama yarıçapı en fazla 50km olmalı")
      .optional(),
    types: z.string().optional(),
  });

  try {
    const userId = req.user.id;

    // Validation
    const parsed = nearbySchema.parse({
      latitude: req.query.latitude,
      longitude: req.query.longitude,
      radius: req.query.radius,
      types: req.query.types,
    });

    const lat = parsed.latitude;
    const lon = parsed.longitude;
    const searchRadius = parsed.radius ?? 50000; // default 50km

    // Types parsing (default olarak hepsini getir)
    const requestedTypes = parsed.types
      ? parsed.types.split(",").map((t) => t.trim())
      : ["adoption", "lost_pet", "clinic", "hotel", "shop"];

    const results = {
      adoptions: [],
      lost_pets: [],
      clinics: [],
      hotels: [],
      shops: [],
    };

    // =====================================================
    // 1. ADOPTION LISTINGS (SELECT * dönen RPC)
    // =====================================================
    if (requestedTypes.includes("adoption")) {
      try {
        const { data: adoptionData, error: adoptionError } = await supabase.rpc(
          "get_adoptions_nearby",
          {
            user_lat: lat,
            user_lon: lon,
            search_radius_meters: searchRadius,
          }
        );

        if (adoptionError) {
          console.error("Adoption listings error:", adoptionError);
        } else if (adoptionData && adoptionData.length > 0) {
          // RPC zaten tüm kolonları döndürüyor, sadece pet_type join ekleyelim
          const listingIds = adoptionData.map((item) => item.id);

          // Pet types bilgilerini çek
          const { data: adoptionsWithTypes, error: typesError } = await supabase
            .from("adoption_listings")
            .select("id, pet_type:pet_types(id, name, name_tr)")
            .in("id", listingIds);

          // Profile images çek
          const { data: adoptionImages, error: imagesError } = await supabase
            .from("profile_images")
            .select("profile_id, image_url")
            .in("profile_id", listingIds)
            .eq("profile_type", "adoption_pet")
            .eq("is_active", true);

          // Image map oluştur
          const imageMap = {};
          if (adoptionImages && !imagesError) {
            adoptionImages.forEach((img) => {
              if (!imageMap[img.profile_id]) {
                imageMap[img.profile_id] = img.image_url;
              }
            });
          }

          // Type map oluştur
          const typeMap = {};
          if (adoptionsWithTypes && !typesError) {
            adoptionsWithTypes.forEach((item) => {
              typeMap[item.id] = item.pet_type;
            });
          }

          // Her adoption item'a type ve image ekle
          results.adoptions = adoptionData.map((item) => ({
            ...item,
            item_type: "adoption",
            pet_type: typeMap[item.id] || null,
            image_url: imageMap[item.id] || null,
          }));
        }
      } catch (error) {
        console.error("Adoption fetch error:", error);
      }
    }

    // =====================================================
    // 2. LOST PET LISTINGS (SELECT * dönen RPC)
    // =====================================================
    if (requestedTypes.includes("lost_pet")) {
      try {
        const { data: lostPetData, error: lostPetError } = await supabase.rpc(
          "get_lost_pets_nearby",
          {
            user_lat: lat,
            user_lon: lon,
            search_radius_meters: searchRadius,
          }
        );

        if (lostPetError) {
          console.error("Lost pet listings error:", lostPetError);
        } else if (lostPetData && lostPetData.length > 0) {
          const listingIds = lostPetData.map((item) => item.id);

          // Pet types bilgilerini çek
          const { data: lostPetsWithTypes, error: typesError } = await supabase
            .from("lost_pet_listings")
            .select("id, pet_type:pet_types(id, name, name_tr)")
            .in("id", listingIds);

          // Profile images çek
          const { data: lostPetImages, error: imagesError } = await supabase
            .from("profile_images")
            .select("profile_id, image_url")
            .in("profile_id", listingIds)
            .eq("profile_type", "lost_pet")
            .eq("is_active", true);

          // Image map oluştur
          const imageMap = {};
          if (lostPetImages && !imagesError) {
            lostPetImages.forEach((img) => {
              if (!imageMap[img.profile_id]) {
                imageMap[img.profile_id] = img.image_url;
              }
            });
          }

          // Type map oluştur
          const typeMap = {};
          if (lostPetsWithTypes && !typesError) {
            lostPetsWithTypes.forEach((item) => {
              typeMap[item.id] = item.pet_type;
            });
          }

          // Her lost pet item'a type ve image ekle
          results.lost_pets = lostPetData.map((item) => ({
            ...item,
            item_type: "lost_pet",
            pet_type: typeMap[item.id] || null,
            image_url: imageMap[item.id] || null,
          }));
        }
      } catch (error) {
        console.error("Lost pet fetch error:", error);
      }
    }

    // =====================================================
    // 3. CLINIC PROFILES (Sadece ID + distance dönen RPC)
    // =====================================================
    if (requestedTypes.includes("clinic")) {
      try {
        const { data: clinicIds, error: clinicError } = await supabase.rpc(
          "get_clinics_nearby",
          {
            user_lat: lat,
            user_lon: lon,
            search_radius_meters: searchRadius,
          }
        );

        if (clinicError) {
          console.error("Clinic profiles error:", clinicError);
        } else if (clinicIds && clinicIds.length > 0) {
          const ids = clinicIds.map((item) => item.id);

          // Detayları çek
          const { data: clinics, error: detailError } = await supabase
            .from("clinic_profiles")
            .select(
              "id, clinic_name, address, latitude, longitude, phone_number, logo_url"
            )
            .in("id", ids);

          if (clinics && !detailError) {
            // Mesafeleri birleştir
            results.clinics = clinics.map((clinic) => {
              const clinicWithDistance = clinicIds.find(
                (c) => c.id === clinic.id
              );
              return {
                ...clinic,
                item_type: "clinic",
                distance: clinicWithDistance?.distance || null,
              };
            });

            // Mesafeye göre sırala
            results.clinics.sort(
              (a, b) => (a.distance || 0) - (b.distance || 0)
            );
          }
        }
      } catch (error) {
        console.error("Clinic fetch error:", error);
      }
    }

    // =====================================================
    // 4. PET HOTEL PROFILES (Sadece ID + distance dönen RPC)
    // =====================================================
    if (requestedTypes.includes("hotel")) {
      try {
        const { data: hotelIds, error: hotelError } = await supabase.rpc(
          "get_hotels_nearby",
          {
            user_lat: lat,
            user_lon: lon,
            search_radius_meters: searchRadius,
          }
        );

        if (hotelError) {
          console.error("Hotel profiles error:", hotelError);
        } else if (hotelIds && hotelIds.length > 0) {
          const ids = hotelIds.map((item) => item.id);

          // Detayları çek
          const { data: hotels, error: detailError } = await supabase
            .from("pet_hotel_profiles")
            .select(
              "id, hotel_name, address, latitude, longitude, phone_number, logo_url"
            )
            .in("id", ids);

          if (hotels && !detailError) {
            // Mesafeleri birleştir
            results.hotels = hotels.map((hotel) => {
              const hotelWithDistance = hotelIds.find((h) => h.id === hotel.id);
              return {
                ...hotel,
                item_type: "hotel",
                distance: hotelWithDistance?.distance || null,
              };
            });

            // Mesafeye göre sırala
            results.hotels.sort(
              (a, b) => (a.distance || 0) - (b.distance || 0)
            );
          }
        }
      } catch (error) {
        console.error("Hotel fetch error:", error);
      }
    }

    // =====================================================
    // 5. PET SHOP PROFILES (Sadece ID + distance dönen RPC)
    // =====================================================
    if (requestedTypes.includes("shop")) {
      try {
        const { data: shopIds, error: shopError } = await supabase.rpc(
          "get_shops_nearby",
          {
            user_lat: lat,
            user_lon: lon,
            search_radius_meters: searchRadius,
          }
        );

        if (shopError) {
          console.error("Shop profiles error:", shopError);
        } else if (shopIds && shopIds.length > 0) {
          const ids = shopIds.map((item) => item.id);

          // Detayları çek
          const { data: shops, error: detailError } = await supabase
            .from("pet_shop_profiles")
            .select(
              "id, shop_name, address, latitude, longitude, phone_number, logo_url"
            )
            .in("id", ids);

          if (shops && !detailError) {
            // Mesafeleri birleştir
            results.shops = shops.map((shop) => {
              const shopWithDistance = shopIds.find((s) => s.id === shop.id);
              return {
                ...shop,
                item_type: "shop",
                distance: shopWithDistance?.distance || null,
              };
            });

            // Mesafeye göre sırala
            results.shops.sort((a, b) => (a.distance || 0) - (b.distance || 0));
          }
        }
      } catch (error) {
        console.error("Shop fetch error:", error);
      }
    }

    // =====================================================
    // RESPONSE
    // =====================================================
    const totalCount =
      results.adoptions.length +
      results.lost_pets.length +
      results.clinics.length +
      results.hotels.length +
      results.shops.length;

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Yakındaki yerler başarıyla getirildi",
      data: results,
      total_count: totalCount,
      counts: {
        adoptions: results.adoptions.length,
        lost_pets: results.lost_pets.length,
        clinics: results.clinics.length,
        hotels: results.hotels.length,
        shops: results.shops.length,
      },
      params: {
        latitude: lat,
        longitude: lon,
        radius_meters: searchRadius,
        requested_types: requestedTypes,
      },
    });

    return res.status(successResponse.code).json(successResponse);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const allErrors = error.errors.map((e) => e.message);
      const validationError = new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Validasyon hatası",
        allErrors
      );
      const errorResponse = Response.errorResponse(validationError);
      return res.status(errorResponse.code).json(errorResponse);
    }

    const errorResponse = Response.errorResponse(error);
    return res.status(errorResponse.code).json(errorResponse);
  }
});

module.exports = router;
