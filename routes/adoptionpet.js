const express = require("express");
const multer = require("multer");
const supabase = require("../database/supabase");
const Response = require("../lib/Response");
const CustomError = require("../lib/Error");
const Enum = require("../config/Enum");
const { verifyToken } = require("../middleware/auth");
const router = express.Router();
const z = require("zod");

// Multer memory storage (dosyalar buffer olarak saklanacak)
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
 * @route POST /adoptionpet/add
 * @desc Sahiplenme ilanı ekleme
 * @access Private
 */
router.post("/add", verifyToken, async (req, res) => {
  const adoptionPetSchema = z.object({
    user_id: z.string().min(1, "Kullanıcı ID zorunludur"),
    pet_type_id: z.string().min(1, "Hayvan tipi zorunludur"),
    pet_name: z
      .string()
      .min(2, "Hayvan adı en az 2 karakter olmalıdır")
      .max(100),
    description: z.string().min(10, "Açıklama en az 10 karakter olmalıdır"),
    breed: z.string().min(1, "Hayvan cinsi zorunludur"),
    gender: z.enum(["male", "female", "unknown"], "Geçersiz cinsiyet değeri"), // Sadece belirli değerleri kabul et
    color: z.string().min(1, "Renk zorunludur"),
    adoption_fee: z
      .number()
      .min(0, "Sahiplenme ücreti 0 veya daha fazla olmalıdır"), // 0'ı kabul eder!
    location_description: z.string().min(1, "Konum açıklaması zorunludur"),
    latitude: z.number(),
    longitude: z.number(),
    requirements: z.string().min(1, "Gereksinimler zorunludur"),

    // Boolean hatasını çözer: Sadece boolean kabul eder (true veya false)
    is_vaccinated: z.boolean({ required_error: "Aşılık durumu belirtilmemiş" }),
    is_neutered: z.boolean({ required_error: "Kısırlık durumu belirtilmemiş" }),
    is_house_trained: z.boolean({
      required_error: "Ev eğitimi durumu belirtilmemiş",
    }),
    good_with_kids: z.boolean({
      required_error: "Çocuklarla uyum durumu belirtilmemiş",
    }),
    good_with_pets: z.boolean({
      required_error: "Diğer hayvanlarla uyum durumu belirtilmemiş",
    }),

    contact_phone: z.string().min(10, "Geçersiz telefon numarası"),
    contact_email: z.string().email("Geçersiz e-posta adresi"), // E-posta formatını kontrol eder

    birthdate: z.string().datetime("Geçersiz tarih formatı"), // Tarih formatını kontrol eder
  });

  const {
    pet_type_id,
    pet_name,
    description,
    breed,
    gender,
    color,
    adoption_fee,
    location_description,
    latitude,
    longitude,
    requirements,
    is_vaccinated,
    is_neutered,
    is_house_trained,
    good_with_kids,
    good_with_pets,
    contact_phone,
    contact_email,
    birthdate,
  } = req.body;
  const userId = req.user.id;
  try {
    const newAdoptionPet = {
      user_id: userId,
      pet_type_id,
      pet_name,
      description,
      breed,
      gender,
      color,
      adoption_fee,
      location_description,
      latitude,
      longitude,
      requirements,
      is_vaccinated,
      is_neutered,
      is_house_trained,
      good_with_kids,
      good_with_pets,
      contact_phone,
      contact_email,
      birthdate,
    };
    const validatedData = adoptionPetSchema.parse(newAdoptionPet);

    //buraya yuva bekleyen hayvan ekleme işlemi yapılacak
    const { data: adoptionPetData, error: adoptionPetError } = await supabase
      .from("adoption_listings")
      .insert(validatedData)
      .select()
      .single();

    if (adoptionPetError) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Sahiplenme ilanı eklenemedi",
        adoptionPetError.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.CREATED, {
      message: "Sahiplenme ilanı başarıyla oluşturuldu",
      listing: adoptionPetData,
    });
    res.status(successResponse.code).json(successResponse);
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

/**
 * @route POST /pet/lost/image
 * @desc Kaybolmuş hayvan ilanı ekleme
 * @access Private
 */
router.post(
  "/image",
  verifyToken,
  upload.single("adoptionpets"),
  async (req, res) => {
    try {
      if (!req.file) {
        throw new CustomError(
          Enum.HTTP_CODES.BAD_REQUEST,
          "Dosya gerekli",
          "Lütfen bir pet resmi yükleyin."
        );
      }

      const userId = req.user.id;
      const file = req.file;
      const { petId } = req.body;

      // petId validasyonu
      if (!petId) {
        throw new CustomError(
          Enum.HTTP_CODES.BAD_REQUEST,
          "Pet ID gerekli",
          "Lütfen petId parametresini gönderin."
        );
      }

      // 1. Lost pet listing'in bu kullanıcıya ait olup olmadığını kontrol et
      const { data: listingData, error: listingError } = await supabase
        .from("adoption_listings")
        .select("id, pet_name")
        .eq("id", petId)
        .eq("user_id", userId)
        .single();

      if (listingError || !listingData) {
        throw new CustomError(
          Enum.HTTP_CODES.BAD_REQUEST,
          "Listing bulunamadı",
          "Bu kayıp pet ilanı size ait değil veya mevcut değil"
        );
      }

      // 2. Mevcut profile_images kaydını kontrol et
      const { data: existingImage, error: fetchError } = await supabase
        .from("profile_images")
        .select("image_url")
        .eq("profile_id", petId)
        .single();

      console.log(JSON.stringify(existingImage, null, 2));
      console.log(JSON.stringify(fetchError, null, 2));

      // 3. Eski resmi sil (eğer varsa)
      if (existingImage && existingImage.image_url) {
        const oldFileName = existingImage.image_url;

        const { data: oldDeleteData, error: oldDeleteError } =
          await supabase.storage.from("adoptionpets").remove([oldFileName]);

        if (oldDeleteError) {
          console.error("Eski pet resmi silinemedi:", oldDeleteError);
        }
      }

      // 4. Yeni dosya ismi oluşturma
      const timestamp = Date.now();
      const fileExtension = file.originalname.split(".").pop();
      const fileName = `adoption-pet-${userId}-${timestamp}.${fileExtension}`;

      // 5. Yeni lost pet resmi yükleme
      const { data: newImageData, error: newImageError } =
        await supabase.storage
          .from("adoptionpets")
          .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            cacheControl: "3600",
            upsert: false,
          });

      if (newImageError) {
        throw new CustomError(
          Enum.HTTP_CODES.INT_SERVER_ERROR,
          "Pet resmi yüklenemedi",
          newImageError.message
        );
      }

      if (existingImage) {
        // Kayıt varsa güncelle
        const { data: updateData, error: updateErr } = await supabase
          .from("profile_images")
          .update({
            image_url: fileName,
            is_active: true,
          })
          .eq("profile_id", petId)
          .select()
          .single();
      } else {
        // Kayıt yoksa yeni oluştur
        const { data: insertData, error: insertErr } = await supabase
          .from("profile_images")
          .insert({
            profile_type: "adoption_pet",
            profile_id: petId,
            image_url: fileName,
            is_active: true,
          })
          .select()
          .single();

        if (insertErr) {
          // Rollback: Storage'dan yüklenen dosyayı geri al
          await supabase.storage.from("adoptionpets").remove([fileName]);
          throw new CustomError(
            Enum.HTTP_CODES.INT_SERVER_ERROR,
            "Resim kaydedilemedi",
            insertErr.message
          );
        }

        const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
          message: "Kayıp pet resmi başarıyla yüklendi",
          image: insertData,
          listing_name: listingData.pet_name,
        });

        res.status(successResponse.code).json(successResponse);
      }

      // 7. Başarılı response
    } catch (error) {
      if (error.code === "LIMIT_FILE_SIZE") {
        const errorResponse = Response.errorResponse(
          new CustomError(
            Enum.HTTP_CODES.BAD_REQUEST,
            "Dosya çok büyük",
            "Pet resmi boyutu maksimum 5MB olabilir."
          )
        );
        return res.status(errorResponse.code).json(errorResponse);
      }

      const errorResponse = Response.errorResponse(error);
      return res.status(errorResponse.code).json(errorResponse);
    }
  }
);

/**
 * @route GET /adoptionpet/detail/:id
 * @desc Sahiplenme ilanını getir
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
      .from("adoption_listings")
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
 * @route GET /adoptionpet/nearby
 * @desc Yakındaki sahiplenme ilanlarını getir
 * @access Private
 */
router.get("/nearby", verifyToken, async (req, res) => {
  const userId = req.user.id;

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
    dynamicRadiusInMeters: z.coerce
      .number()
      .min(100, "Arama yarıçapı en az 100m olmalı")
      .max(50000, "Arama yarıçapı en fazla 50km olmalı")
      .optional(),
  });

  try {
    const parsed = nearbySchema.parse({
      latitude: req.query.latitude,
      longitude: req.query.longitude,
      dynamicRadiusInMeters: req.query.dynamicRadiusInMeters,
    });

    const lat = parsed.latitude;
    const lon = parsed.longitude;
    const searchRadius = parsed.dynamicRadiusInMeters ?? 5000; // varsayılan 5km

    const { data, error } = await supabase.rpc("get_adoptions_nearby", {
      user_lat: lat,
      user_lon: lon,
      search_radius_meters: searchRadius,
    });

    if (error) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Sahiplenme ilanları getirilirken hata oluştu",
        error.message
      );
    }

    if (!data || data.length === 0) {
      const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
        message: "Yakındaki sahiplenme ilanları başarıyla getirildi",
        data: [],
        total_count: 0,
      });
      return res.status(successResponse.code).json(successResponse);
    }

    const listingIds = data.map((item) => item.id);

    const { data: adoptionPetsData, error: adoptionPetsError } = await supabase
      .from("adoption_listings")
      .select(
        `
        *,
        pet_type:pet_types(id, name, name_tr)
      `
      )
      .in("id", listingIds)
      .eq("status", "active")
      .eq("is_active", true)
      .neq("user_id", userId);

    if (adoptionPetsError) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Sahiplenme ilanları bilgileri getirilirken hata oluştu",
        adoptionPetsError.message
      );
    }

    const { data: allProfileImages, error: imagesError } = await supabase
      .from("profile_images")
      .select("profile_id, image_url")
      .in("profile_id", listingIds)
      .eq("profile_type", "adoption_pet")
      .eq("is_active", true);

    const imageMap = {};
    if (allProfileImages && !imagesError) {
      allProfileImages.forEach((img) => {
        if (!imageMap[img.profile_id]) {
          imageMap[img.profile_id] = img.image_url;
        }
      });
    }

    const listingsWithImages = (adoptionPetsData || []).map((listing) => {
      const nearbyItem = data.find((item) => item.id === listing.id);
      const distance = nearbyItem?.distance || null;
      return {
        ...listing,
        image_url: imageMap[listing.id] || null,
        distance,
      };
    });

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Yakındaki sahiplenme ilanları başarıyla getirildi",
      data: listingsWithImages,
      total_count: listingsWithImages ? listingsWithImages.length : 0,
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

/**
 * @route GET /adoptionpet/my/listings
 * @desc Sahiplenme ilanlarını getir
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
      .from("adoption_listings")
      .select(`*,pet_type:pet_types(id, name, name_tr)`)
      .eq("user_id", userId)
      .eq("is_active", true);

    if (listingsError) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Kayıp hayvan ilanları getirilirken hata oluştu",
        listingsError.message
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
      .eq("profile_type", "adoption_pet")
      .eq("is_active", true);

    if (imagesError) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Resimler getirilirken hata oluştu",
        imagesError.message
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
 * @route PUT /adoptionpet/:id
 * @desc Sahiplenme ilanı bulundu
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
      .from("adoption_listings")
      .update({
        status: "passive",
        adopted_date: new Date(),
      })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Sahiplenme ilanı bulunduğunda hata oluştu",
        error.message
      );
    }
    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Sahiplenme ilanı başarıyla bulundu",
      listing: data,
    });
    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});
/**
 * @route DELETE /adoptionpet/:id
 * @desc Sahiplenme ilanı sil
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
      .from("adoption_listings")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Sahiplenme ilanı silinirken hata oluştu",
        error.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Sahiplenme ilanı başarıyla silindi",
      listing: data,
    });
    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});
/**
 * @route GET /adoptionpet/image/:id
 * @desc Sahiplenme ilanı resmini getir
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
      .eq("profile_type", "adoption_pet")
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
      .from("adoptionpets")
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

/**
 * @route GET /adoptionpet/:filename
 * @desc Sahiplenme ilanı resmini getir
 * @access Public
 */
router.get("/:filename", async (req, res) => {
  try {
    const { filename } = req.params;

    // Güvenlik: Sadece avatar dosyalarına izin ver
    if (!filename || filename.includes("..") || filename.includes("/")) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Geçersiz dosya adı",
        "Dosya adı geçersiz karakterler içeriyor."
      );
    }

    // Supabase Storage'dan dosyayı download et
    const { data, error } = await supabase.storage
      .from("adoptionpets")
      .download(filename);

    if (error || !data) {
      throw new CustomError(
        Enum.HTTP_CODES.NOT_FOUND,
        "Pet bulunamadı",
        "İstenen pet resmi bulunamadı."
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
