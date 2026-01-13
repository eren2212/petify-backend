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
 * @desc Ana sayfa için rastgele ürünler getir (pagination destekli)
 * @access Private
 * @query page - Sayfa numarası (default: 1)
 * @query limit - Sayfa başına ürün sayısı (default: 10)
 */
router.get("/featured-products", verifyToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    // Pagination için offset hesapla
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Toplam ürün sayısını al
    const { count, error: countError } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .gt("stock_quantity", 0);

    if (countError) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Ürün sayısı alınırken hata oluştu",
        countError.message
      );
    }

    // Page 1 için rastgele ürünler, diğer sayfalar için sıralı ürünler
    if (page === 1) {
      // Ana sayfa için rastgele ürünler
      const { data, error } = await supabase.rpc("get_random_products", {
        limit_count: limit,
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
            image_url
          `
          )
          .eq("is_active", true)
          .gt("stock_quantity", 0)
          .order("created_at", { ascending: false })
          .range(from, to);

        if (fallbackError) {
          throw new CustomError(
            Enum.HTTP_CODES.BAD_REQUEST,
            "Ürünler getirilirken bir hata oluştu",
            fallbackError.message
          );
        }

        const formattedData = (fallbackData || []).map((product) => ({
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          stock_quantity: product.stock_quantity,
          is_featured: product.is_featured,
          image_url: product.image_url || null,
        }));

        const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
          message: "Ürünler başarıyla getirildi",
          data: formattedData,
          pagination: {
            page,
            limit,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit),
            hasMore: to < (count || 0) - 1,
          },
        });

        return res.status(successResponse.code).json(successResponse);
      }

      const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
        message: "Ürünler başarıyla getirildi",
        data: data || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
          hasMore: to < (count || 0) - 1,
        },
      });

      return res.status(successResponse.code).json(successResponse);
    }

    // Diğer sayfalar için normal sıralama
    const { data: productsData, error: productsError } = await supabase
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
        image_url
      `
      )
      .eq("is_active", true)
      .gt("stock_quantity", 0)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (productsError) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Ürünler getirilirken bir hata oluştu",
        productsError.message
      );
    }

    const formattedData = (productsData || []).map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      stock_quantity: product.stock_quantity,
      is_featured: product.is_featured,
      image_url: product.image_url || null,
    }));

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Ürünler başarıyla getirildi",
      data: formattedData,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasMore: to < (count || 0) - 1,
      },
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
      .from("clinic_profiles")
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
        created_at
      `
      )
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
        created_at
      `
      )
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
        display_name,
        bio,
        experience_years,
        logo_url,
        phone_number,
        instagram_url,
        is_available,
        created_at
      `
      )
      .eq("is_available", true)
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

/**
 * @route GET /home/shops
 * @desc Ana sayfa için rastgele pet mağaza'ları getir
 * @access Private
 */
router.get("/shops", verifyToken, async (req, res) => {
  try {
    // PostgreSQL RANDOM() ile rastgele 10 bakıcı seç
    const { data, error } = await supabase
      .from("pet_shop_profiles")
      .select(
        `
        id,
        shop_name,
        description,
        address,
        latitude,
        longitude,
        phone_number,
        email,
        website_url,
        instagram_url,
        logo_url,
        cover_image_url,
        working_hours,
        created_at
      `
      )
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Mağazalar getirilirken bir hata oluştu",
        error.message
      );
    }

    // Rastgele sıralama için JavaScript ile shuffle
    const shuffledData = (data || []).sort(() => Math.random() - 0.5);

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Mağazalar başarıyla getirildi",
      data: shuffledData,
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route GET /home/shops/:id/products
 * @desc Mağazanın ürünlerini getir (Public - herkes görebilir)
 * @access Private
 */
router.get("/shops/:id/products", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Mağaza ID gerekli",
        "ID parametresi eksik"
      );
    }

    // Mağazanın ürünlerini getir (aktif ve stokta olanlar)
    const { data: productsData, error: productsError } = await supabase
      .from("products")
      .select(
        `
        id,
        name,
        description,
        image_url,
        price,
        stock_quantity,
        weight_kg,
        age_group,
        low_stock_threshold,
        is_featured,
        created_at,
        updated_at,
        product_categories!inner(id, name, name_tr),
        pet_types!inner(id, name, name_tr)
        pet_shop_profiles!inner(id, shop_name, logo_url)
      `
      )
      .eq("pet_shop_profile_id", id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (productsError) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Ürünler getirilirken bir hata oluştu",
        productsError.message
      );
    }

    // Eğer ürün yoksa boş array döndür
    if (!productsData || productsData.length === 0) {
      const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
        message: "Ürünler başarıyla getirildi",
        data: [],
        total: 0,
      });
      return res.status(successResponse.code).json(successResponse);
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Ürünler başarıyla getirildi",
      data: productsData,
      total: productsData.length,
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route GET /home/clinic/:id
 * @desc Klinik detayını getir (Public - herkes görebilir)
 * @access Private
 */
router.get("/clinic/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Klinik ID gerekli",
        "ID parametresi eksik"
      );
    }

    // Klinik profilini getir
    const { data: clinicData, error: clinicError } = await supabase
      .from("clinic_profiles")
      .select(
        `
        id,
        clinic_name,
        description,
        address,
        latitude,
        longitude,
        phone_number,
        emergency_phone,
        email,
        website_url,
        instagram_url,
        logo_url,
        cover_image_url,
        working_hours,
        created_at,
        updated_at
      `
      )
      .eq("id", id)
      .single();

    if (clinicError || !clinicData) {
      throw new CustomError(
        Enum.HTTP_CODES.NOT_FOUND,
        "Klinik bulunamadı",
        clinicError?.message || "İstenen klinik bulunamadı"
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Klinik detayı başarıyla getirildi",
      data: clinicData,
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route GET /home/hotel/:id
 * @desc Pet otel detayını getir (Public - herkes görebilir)
 * @access Private
 */
router.get("/hotel/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Otel ID gerekli",
        "ID parametresi eksik"
      );
    }

    // Otel profilini getir
    const { data: hotelData, error: hotelError } = await supabase
      .from("pet_hotel_profiles")
      .select(
        `
        id,
        hotel_name,
        description,
        address,
        latitude,
        longitude,
        phone_number,
        emergency_phone,
        email,
        website_url,
        instagram_url,
        logo_url,
        cover_image_url,
        capacity,
        check_in_time,
        check_out_time,
        working_hours,
        created_at,
        updated_at
      `
      )
      .eq("id", id)
      .single();

    if (hotelError || !hotelData) {
      throw new CustomError(
        Enum.HTTP_CODES.NOT_FOUND,
        "Otel bulunamadı",
        hotelError?.message || "İstenen otel bulunamadı"
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Otel detayı başarıyla getirildi",
      data: hotelData,
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route GET /home/hotel/:id/services
 * @desc Pet hotel hizmetlerini getir (Public - herkes görebilir)
 * @access Private
 */
router.get("/hotel/:id/services", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Otel ID gerekli",
        "ID parametresi eksik"
      );
    }

    // Otelin hizmetlerini getir
    const { data: servicesData, error: servicesError } = await supabase
      .from("pet_hotel_services")
      .select(
        "*, pet_hotel_service_categories!inner(id, name, name_tr, icon_url, description)"
      )
      .eq("pet_hotel_profile_id", id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (servicesError) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Hizmetler getirilirken bir hata oluştu",
        servicesError.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Hizmetler başarıyla getirildi",
      data: servicesData || [],
      total: (servicesData || []).length,
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route GET /home/shop/:id
 * @desc Pet shop detayını getir (Public - herkes görebilir)
 * @access Private
 */
router.get("/shop/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Mağaza ID gerekli",
        "ID parametresi eksik"
      );
    }

    // Shop profilini getir
    const { data: shopData, error: shopError } = await supabase
      .from("pet_shop_profiles")
      .select(
        `
        id,
        shop_name,
        description,
        address,
        latitude,
        longitude,
        phone_number,
        email,
        website_url,
        instagram_url,
        logo_url,
        cover_image_url,
        working_hours,
        created_at,
        updated_at
      `
      )
      .eq("id", id)
      .single();

    if (shopError || !shopData) {
      throw new CustomError(
        Enum.HTTP_CODES.NOT_FOUND,
        "Mağaza bulunamadı",
        shopError?.message || "İstenen mağaza bulunamadı"
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Mağaza detayı başarıyla getirildi",
      data: shopData,
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route GET /home/clinic/:clinicId/services
 * @desc Kliniğin hizmetlerini getir (Public - herkes görebilir)
 * @access Private
 */
router.get("/clinic/:clinicId/services", verifyToken, async (req, res) => {
  try {
    const { clinicId } = req.params;

    if (!clinicId) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Klinik ID gerekli",
        "ID parametresi eksik"
      );
    }

    // Kliniğin hizmetlerini getir
    const { data: servicesData, error: servicesError } = await supabase
      .from("clinic_services")
      .select(
        "*, clinic_service_categories!inner(id, name, name_tr, icon_url, description)"
      )
      .eq("clinic_profile_id", clinicId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (servicesError) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Hizmetler getirilirken bir hata oluştu",
        servicesError.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Hizmetler başarıyla getirildi",
      data: servicesData || [],
      total: (servicesData || []).length,
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route GET /home/clinic/:clinicId/doctors
 * @desc Kliniğin doktorlarını getir (Public - herkes görebilir)
 * @access Private
 */
router.get("/clinic/:clinicId/doctors", verifyToken, async (req, res) => {
  try {
    const { clinicId } = req.params;

    if (!clinicId) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Klinik ID gerekli",
        "ID parametresi eksik"
      );
    }

    // Kliniğin doktorlarını getir
    const { data: doctorsData, error: doctorsError } = await supabase
      .from("clinic_veterinarians")
      .select("*")
      .eq("clinic_profile_id", clinicId)
      .order("created_at", { ascending: false });

    if (doctorsError) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Doktorlar getirilirken bir hata oluştu",
        doctorsError.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Doktorlar başarıyla getirildi",
      data: doctorsData || [],
      total: (doctorsData || []).length,
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route GET /home/clinic/:clinicId/doctors/:doctorId
 * @desc Kliniğin doktor detayını getir (Public - herkes görebilir)
 * @access Private
 */
router.get(
  "/clinic/:clinicId/doctor/:doctorId",
  verifyToken,
  async (req, res) => {
    try {
      const { clinicId, doctorId } = req.params;
      if (!clinicId || !doctorId) {
        throw new CustomError(
          Enum.HTTP_CODES.BAD_REQUEST,
          "Klinik ID ve Doktor ID gerekli",
          "ID parametreleri eksik"
        );
      }
      const { data: doctorData, error: doctorError } = await supabase
        .from("clinic_veterinarians")
        .select("*")
        .eq("id", doctorId)
        .eq("clinic_profile_id", clinicId)
        .single();
      if (doctorError || !doctorData) {
        throw new CustomError(
          Enum.HTTP_CODES.NOT_FOUND,
          "Doktor bulunamadı",
          doctorError?.message || "İstenen doktor bulunamadı"
        );
      }
      const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
        message: "Doktor detayı başarıyla getirildi",
        data: doctorData,
      });
      res.status(successResponse.code).json(successResponse);
    } catch (error) {
      const errorResponse = Response.errorResponse(error);
      res.status(errorResponse.code).json(errorResponse);
    }
  }
);

/**
 * @route GET /home/sitter/:id
 * @desc Pet sitter detayını getir (Public - herkes görebilir)
 * @access Private
 */
router.get("/sitter/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Bakıcı ID gerekli",
        "ID parametresi eksik"
      );
    }

    // Sitter profilini getir
    const { data: sitterData, error: sitterError } = await supabase
      .from("pet_sitter_profiles")
      .select(
        `
        id,
        display_name,
        bio,
        experience_years,
        logo_url,
        cover_image_url,
        phone_number,
        instagram_url,
        is_available,
        created_at,
        updated_at
      `
      )
      .eq("id", id)
      .eq("is_available", true)
      .single();

    if (sitterError || !sitterData) {
      throw new CustomError(
        Enum.HTTP_CODES.NOT_FOUND,
        "Bakıcı bulunamadı",
        sitterError?.message || "İstenen bakıcı bulunamadı"
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Bakıcı detayı başarıyla getirildi",
      data: sitterData,
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route GET /home/sitter/:id/services
 * @desc Pet sitter hizmetlerini getir (Public - herkes görebilir)
 * @access Private
 */
router.get("/sitter/:id/services", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Klinik ID gerekli",
        "ID parametresi eksik"
      );
    }

    // Kliniğin hizmetlerini getir
    const { data: servicesData, error: servicesError } = await supabase
      .from("pet_sitter_services")
      .select(
        "*, pet_sitter_service_categories!inner(id, name, name_tr, icon_url, description)"
      )
      .eq("pet_sitter_profile_id", id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (servicesError) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Hizmetler getirilirken bir hata oluştu",
        servicesError.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Hizmetler başarıyla getirildi",
      data: servicesData || [],
      total: (servicesData || []).length,
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route GET /home/lost-pets
 * @desc Ana sayfa için son kayıp hayvan ilanlarını getir (en fazla 3 adet)
 * @access Private
 */
router.get("/lost-pets", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Son 3 kayıp hayvan ilanını getir (kendi ilanları hariç)
    const { data: lostPetsData, error: lostPetsError } = await supabase
      .from("lost_pet_listings")
      .select(
        `
        id,
        pet_name,
        pet_type_id,
        gender,
        breed,
        description,
        last_seen_location,
        lost_date,
        lost_time,
        last_seen_latitude,
        last_seen_longitude,
        status,
        reward_amount,
        created_at,
        pet_type:pet_types(id, name, name_tr)
      `
      )
      .eq("is_active", true)
      .eq("status", "active")
      .neq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(3);

    if (lostPetsError) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Kayıp hayvan ilanları getirilirken bir hata oluştu",
        lostPetsError.message
      );
    }

    // Eğer ilan yoksa boş array döndür
    if (!lostPetsData || lostPetsData.length === 0) {
      const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
        message: "Kayıp hayvan ilanları başarıyla getirildi",
        data: [],
        total_count: 0,
      });
      return res.status(successResponse.code).json(successResponse);
    }

    // Tüm ilan ID'lerini topla
    const listingIds = lostPetsData.map((listing) => listing.id);

    // profile_images'leri ayrı sorguda getir (her ilan için ilk resmi al)
    const { data: profileImages, error: imagesError } = await supabase
      .from("profile_images")
      .select("profile_id, image_url")
      .in("profile_id", listingIds)
      .eq("profile_type", "lost_pet")
      .eq("is_active", true);

    // Image'ları profile_id'ye göre map'le
    const imageMap = {};
    if (profileImages && !imagesError) {
      profileImages.forEach((img) => {
        // Her profile_id için sadece ilk resmi al
        if (!imageMap[img.profile_id]) {
          imageMap[img.profile_id] = img.image_url;
        }
      });
    }

    // Listing'leri image_url ile birleştir
    const listingsWithImages = lostPetsData.map((listing) => ({
      ...listing,
      image_url: imageMap[listing.id] || null,
    }));

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Kayıp hayvan ilanları başarıyla getirildi",
      data: listingsWithImages,
      total_count: listingsWithImages.length,
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

router.get("/adoption-pets", verifyToken, async (req, res) => {
  try {
    const { data: adoptionPetsData, error: adoptionPetsError } = await supabase
      .from("adoption_listings")
      .select("*")
      .eq("is_active", true)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(3);
    if (adoptionPetsError) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Sahiplenme ilanları getirilirken bir hata oluştu",
        adoptionPetsError.message
      );
    }
    if (!adoptionPetsData || adoptionPetsData.length === 0) {
      const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
        message: "Sahiplenme ilanları başarıyla getirildi",
        data: [],
        total_count: 0,
      });
      return res.status(successResponse.code).json(successResponse);
    }
    const listingIds = adoptionPetsData.map((listing) => listing.id);
    const { data: profileImages, error: imagesError } = await supabase
      .from("profile_images")
      .select("profile_id, image_url")
      .in("profile_id", listingIds)
      .eq("profile_type", "adoption_pet")
      .eq("is_active", true);
    const imageMap = {};
    if (profileImages && !imagesError) {
      profileImages.forEach((img) => {
        if (!imageMap[img.profile_id]) {
          imageMap[img.profile_id] = img.image_url;
        }
      });
    }
    const listingsWithImages = adoptionPetsData.map((listing) => ({
      ...listing,
      image_url: imageMap[listing.id] || null,
    }));

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Kayıp hayvan ilanları başarıyla getirildi",
      data: listingsWithImages,
      total_count: listingsWithImages.length,
    });
    return res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    return res.status(errorResponse.code).json(errorResponse);
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
      .from("products")
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
      .from("avatars")
      .download(`petclinicprofiles/${filename}`);

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

/**
 * @route GET /home/images/lost-pet/:filename
 * @desc Kayıp hayvan resmini serve et
 * @access Public
 */
router.get("/images/lost-pet/:filename", async (req, res) => {
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
      .from("lostpets")
      .download(filename);

    if (error || !data) {
      throw new CustomError(
        Enum.HTTP_CODES.NOT_FOUND,
        "Kayıp hayvan resmi bulunamadı",
        "İstenen kayıp hayvan resmi bulunamadı."
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
 * @route GET /home/sitter/:id/services
 * @desc Pet sitter hizmetlerini getir (Public - herkes görebilir)
 * @access Private
 */
router.get("/sitter/:id/services", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Klinik ID gerekli",
        "ID parametresi eksik"
      );
    }

    // Kliniğin hizmetlerini getir
    const { data: servicesData, error: servicesError } = await supabase
      .from("pet_sitter_services")
      .select(
        "*, pet_sitter_service_categories!inner(id, name, name_tr, icon_url, description)"
      )
      .eq("pet_sitter_profile_id", id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (servicesError) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Hizmetler getirilirken bir hata oluştu",
        servicesError.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Hizmetler başarıyla getirildi",
      data: servicesData || [],
      total: (servicesData || []).length,
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

module.exports = router;
