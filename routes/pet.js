const express = require("express");
const multer = require("multer");
const supabase = require("../database/supabase");
const Response = require("../lib/Response");
const CustomError = require("../lib/Error");
const Enum = require("../config/Enum");
const { verifyToken } = require("../middleware/auth");
const router = express.Router();

// Multer konfigürasyonu - Memory storage kullanıyoruz
const storage = multer.memoryStorage();

// Dosya filtresi - Sadece izin verilen formatlar
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Geçersiz dosya formatı",
        "Sadece JPG, PNG ve WebP formatları kabul edilir."
      ),
      false
    );
  }
};

// Multer instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

/**
 * @route GET /pet/types
 * @desc Tüm aktif hayvan türlerini getir
 * @access Public
 */
router.get("/types", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("pet_types")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Hayvan türleri getirilemedi",
        error.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Hayvan türleri başarılı bir şekilde getirildi",
      pet_types: data,
      total_count: data ? data.length : 0,
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});
/**
 * @route GET /pet/my/:id?age_format=auto|years|months|days
 * @desc Profildeki hayvanların detay sayfasını getir
 * @access Private
 * @param {string} age_format - Yaş formatı: auto (otomatik), years (yıl), months (ay), days (gün)
 */
router.get("/my/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { age_format = "auto" } = req.query; // Default olarak otomatik
  const userId = req.user.id;

  try {
    const { data, error } = await supabase
      .from("pets")
      .select(
        `
        *,
        pet_type:pet_types(id, name, name_tr)
      `
      )
      .eq("user_id", userId)
      .eq("id", id)
      .single();

    // Gelişmiş yaş hesaplama fonksiyonu
    const calculatePetAge = (birthdate, format = "auto") => {
      if (!birthdate) return { age: null, unit: null, display: null };

      const today = new Date();
      const birth = new Date(birthdate);

      // Geçersiz tarih kontrolü
      if (birth > today)
        return { age: null, unit: null, display: "Geçersiz tarih" };

      // Yıl cinsinden yaş hesaplama
      let years = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();

      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < birth.getDate())
      ) {
        years--;
      }

      // Ay cinsinden yaş hesaplama
      let months = (today.getFullYear() - birth.getFullYear()) * 12;
      months += today.getMonth() - birth.getMonth();

      if (today.getDate() < birth.getDate()) {
        months--;
      }

      // Gün cinsinden yaş hesaplama
      const timeDiff = today.getTime() - birth.getTime();
      const days = Math.floor(timeDiff / (1000 * 3600 * 24));

      // Format belirleme
      switch (format) {
        case "years":
          return {
            age: Math.max(0, years),
            unit: "years",
            display: `${Math.max(0, years)} yaş`,
          };

        case "months":
          return {
            age: Math.max(0, months),
            unit: "months",
            display: `${Math.max(0, months)} aylık`,
          };

        case "days":
          return {
            age: Math.max(0, days),
            unit: "days",
            display: `${Math.max(0, days)} günlük`,
          };

        case "auto":
        default:
          // Otomatik format seçimi
          if (years >= 1) {
            return {
              age: years,
              unit: "years",
              display: `${years} yaş`,
            };
          } else if (months >= 1) {
            return {
              age: months,
              unit: "months",
              display: `${months} Aylık`,
            };
          } else {
            return {
              age: days,
              unit: "days",
              display: `${days} Günlük`,
            };
          }
      }
    };

    // Hayvanın yaş bilgisini hesapla
    let ageInfo = { age: null, unit: null, display: null };
    if (data.birthdate) {
      ageInfo = calculatePetAge(data.birthdate, age_format);
    }

    if (error) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Detay sayfası görüntülenirken database sorgusunda bir hata geldi",
        error.message
      );
    }

    if (!data) {
      throw new CustomError(
        Enum.HTTP_CODES.NOT_FOUND,
        "Bu ID ile eşleşen hayvan bulunamadı"
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Detay sayfası başarılı bir şekilde geldi.",
      pet: {
        ...data,
        age: ageInfo.age,
        age_unit: ageInfo.unit,
        age_display: ageInfo.display,
        age_format_used: age_format,
      },
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route PUT /pet/my/:id
 * @desc Hayvan bilgilerini güncelle
 * @access Private
 */
router.put("/my/:id", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  const { name, weight_kg, description } = req.body;

  try {
    // Input validation
    if (!name || name.trim() === "") {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Hayvan adı boş olamaz"
      );
    }

    // Hayvanın kullanıcıya ait olup olmadığını kontrol et
    const { data: petData, error: petError } = await supabase
      .from("pets")
      .select("id, name")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (!petData || petError) {
      throw new CustomError(
        Enum.HTTP_CODES.NOT_FOUND,
        "Bu kullanıcıya ait böyle bir hayvan bulunmamaktadır",
        petError?.message
      );
    }

    // Güncelleme verilerini hazırla
    const updateData = {};
    if (name) updateData.name = name.trim();
    if (weight_kg !== undefined) updateData.weight_kg = weight_kg;
    if (description !== undefined) updateData.description = description;

    // Hayvan bilgilerini güncelle
    const { data, error } = await supabase
      .from("pets")
      .update(updateData)
      .eq("user_id", userId)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Hayvan bilgilerini düzenlerken bir hata oluştu",
        error.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Hayvan bilgileri başarıyla güncellendi!",
      pet: data,
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route POST /profile/pet/vaccination
 * @desc Pet aşılama bilgisi ekleme
 * @access Private
 */

router.post("/vaccination", verifyToken, async (req, res) => {
  const {
    pet_id,
    vaccine_name,
    vaccination_date,
    next_due_date,
    veterinarian_name,
    clinic_name,
    batch_number,
    notes,
  } = req.body;

  const userId = req.user.id;

  try {
    // Pet'in bu kullanıcıya ait olup olmadığını kontrol et
    const { data: petData, error: petError } = await supabase
      .from("pets")
      .select("id")
      .eq("id", pet_id)
      .eq("user_id", userId)
      .single();

    if (petError || !petData) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Pet bulunamadı",
        "Bu pet size ait değil veya mevcut değil"
      );
    }

    const newVaccination = {
      pet_id,
      vaccine_name,
      vaccination_date,
      next_due_date,
      veterinarian_name,
      clinic_name,
      batch_number,
      notes,
    };

    const { data, error } = await supabase
      .from("pet_vaccinations")
      .insert(newVaccination)
      .select()
      .single();

    if (error) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Yeni aşılama bilgileri kaydedilemedi",
        error.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Aşılama bilgisi başarıyla kaydedildi",
      vaccination: data,
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route GET /pet/vaccination/:petId
 * @desc Pet aşılama bilgisi listeleme
 * @access Private
 */
router.get("/vaccination/:petId", verifyToken, async (req, res) => {
  const { petId } = req.params;
  const userId = req.user.id;

  try {
    // Input validation
    if (!petId) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Pet ID parametresi gereklidir"
      );
    }

    // Pet'in kullanıcıya ait olup olmadığını kontrol et
    const { data: petData, error: petError } = await supabase
      .from("pets")
      .select("id, name")
      .eq("id", petId)
      .eq("user_id", userId)
      .single();

    if (petError || !petData) {
      throw new CustomError(
        Enum.HTTP_CODES.NOT_FOUND,
        "Bu kullanıcıya ait hayvan bulunamadı",
        petError?.message
      );
    }

    // Hayvana ait tüm aşıları getir
    const { data: petVaccinationData, error: petVaccinationError } =
      await supabase
        .from("pet_vaccinations")
        .select("*")
        .eq("pet_id", petId)
        .order("vaccination_date", { ascending: false });

    if (petVaccinationError) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Aşı bilgileri getirilirken bir hata oluştu",
        petVaccinationError.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Hayvan aşıları başarıyla getirildi",
      pet: {
        id: petData.id,
        name: petData.name,
      },
      vaccinations: petVaccinationData || [],
      total_count: petVaccinationData ? petVaccinationData.length : 0,
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route GET /pet/vaccination/detail/:vaccinationId
 * @desc Tek bir aşının detayını getir
 * @access Private
 */
router.get(
  "/vaccination/detail/:vaccinationId",
  verifyToken,
  async (req, res) => {
    const { vaccinationId } = req.params;
    const userId = req.user.id;

    try {
      // Aşı bilgisini pet bilgisiyle birlikte getir
      const { data: vaccinationData, error: vaccinationError } = await supabase
        .from("pet_vaccinations")
        .select(
          `
        *,
        pet:pets(
          id,
          user_id,
          name,
          breed,
          pet_type:pet_types(name, name_tr)
        )
      `
        )
        .eq("id", vaccinationId)
        .single();

      if (vaccinationError || !vaccinationData) {
        throw new CustomError(
          Enum.HTTP_CODES.NOT_FOUND,
          "Aşı bilgisi bulunamadı",
          vaccinationError?.message
        );
      }

      // Pet'in bu kullanıcıya ait olup olmadığını kontrol et (security)
      if (vaccinationData.pet.user_id !== userId) {
        throw new CustomError(
          Enum.HTTP_CODES.FORBIDDEN,
          "Bu aşı bilgisine erişim yetkiniz yok"
        );
      }

      const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
        message: "Aşı detayı başarıyla getirildi",
        vaccination: vaccinationData,
      });

      res.status(successResponse.code).json(successResponse);
    } catch (error) {
      const errorResponse = Response.errorResponse(error);
      res.status(errorResponse.code).json(errorResponse);
    }
  }
);
//-----------------------KAYBOLMUŞ HAYVANLAR İÇİN OLAN--------------------------------------
/**
 * @route POST /pet/lost
 * @desc Kaybolmuş hayvan ilanı ekleme
 * @access Private
 */
router.post("/lost", verifyToken, async (req, res) => {
  const {
    pet_id,
    pet_type_id,
    pet_name,
    breed,
    birthdate,
    gender,
    color,
    description,
    lost_date,
    lost_time,
    last_seen_location,
    last_seen_latitude,
    last_seen_longitude,
    contact_phone,
    contact_email,
    reward_amount,
    reward_description,
  } = req.body;

  const userId = req.user.id;

  try {
    // Zorunlu alan validasyonları
    if (!pet_name || pet_name.trim() === "") {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Hayvan adı zorunludur"
      );
    }

    if (!description || description.trim() === "") {
      throw new CustomError(Enum.HTTP_CODES.BAD_REQUEST, "Açıklama zorunludur");
    }

    if (!lost_date) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Kaybolma tarihi zorunludur"
      );
    }

    if (!last_seen_location || last_seen_location.trim() === "") {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Son görülme yeri zorunludur"
      );
    }

    if (!last_seen_latitude || !last_seen_longitude) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Konum koordinatları (enlem ve boylam) zorunludur"
      );
    }

    // Koordinat validasyonu
    const latitude = parseFloat(last_seen_latitude);
    const longitude = parseFloat(last_seen_longitude);

    if (isNaN(latitude) || latitude < -90 || latitude > 90) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Geçersiz enlem değeri (-90 ile 90 arasında olmalı)"
      );
    }

    if (isNaN(longitude) || longitude < -180 || longitude > 180) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Geçersiz boylam değeri (-180 ile 180 arasında olmalı)"
      );
    }

    // Telefon numarası validasyonu (opsiyonel ama girilirse kontrol edilmeli)
    if (contact_phone) {
      const cleanPhone = contact_phone.replace(/\s/g, "");
      if (cleanPhone.length !== 10 || !/^\d+$/.test(cleanPhone)) {
        throw new CustomError(
          Enum.HTTP_CODES.BAD_REQUEST,
          "Telefon numarası 10 haneli olmalı ve sadece rakam içermelidir"
        );
      }
    }

    // Email validasyonu (opsiyonel ama girilirse kontrol edilmeli)
    if (contact_email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(contact_email)) {
        throw new CustomError(
          Enum.HTTP_CODES.BAD_REQUEST,
          "Geçersiz e-posta adresi"
        );
      }
    }

    // Eğer pet_id verilmişse, bu pet'in kullanıcıya ait olup olmadığını kontrol et
    if (pet_id) {
      const { data: petData, error: petError } = await supabase
        .from("pets")
        .select("id, name")
        .eq("id", pet_id)
        .eq("user_id", userId)
        .single();

      if (petError || !petData) {
        throw new CustomError(
          Enum.HTTP_CODES.BAD_REQUEST,
          "Belirtilen hayvan bulunamadı veya size ait değil"
        );
      }
    }

    // Kayıp ilan verisini hazırla
    const newLostPetListing = {
      user_id: userId,
      pet_name: pet_name.trim(),
      description: description.trim(),
      lost_date: lost_date,
      last_seen_location: last_seen_location.trim(),
      last_seen_latitude: latitude,
      last_seen_longitude: longitude,
    };

    // Opsiyonel alanları ekle
    if (pet_id) newLostPetListing.pet_id = pet_id;
    if (pet_type_id) newLostPetListing.pet_type_id = pet_type_id;
    if (breed) newLostPetListing.breed = breed.trim();
    if (birthdate) newLostPetListing.birthdate = birthdate;
    if (gender) newLostPetListing.gender = gender;
    if (color) newLostPetListing.color = color.trim();
    if (lost_time) newLostPetListing.lost_time = lost_time;
    if (contact_phone)
      newLostPetListing.contact_phone = contact_phone.replace(/\s/g, "");
    if (contact_email)
      newLostPetListing.contact_email = contact_email.trim().toLowerCase();
    if (reward_amount !== undefined)
      newLostPetListing.reward_amount = parseFloat(reward_amount);
    if (reward_description)
      newLostPetListing.reward_description = reward_description.trim();

    // Veritabanına kaydet
    const { data, error } = await supabase
      .from("lost_pet_listings")
      .insert(newLostPetListing)
      .select(
        `
        *,
        pet_type:pet_types(id, name, name_tr),
        pet:pets(id, name, breed)
      `
      )
      .single();

    if (error) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Kayıp hayvan ilanı eklenirken bir hata oluştu",
        error.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.CREATED, {
      message: "Kayıp hayvan ilanı başarıyla oluşturuldu",
      listing: data,
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route POST /pet/lost/image
 * @desc Kaybolmuş hayvan ilanı ekleme
 * @access Private
 */
router.post(
  "/lost/image",
  verifyToken,
  upload.single("lostpets"),
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
        .from("lost_pet_listings")
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
          await supabase.storage.from("lostpets").remove([oldFileName]);

        if (oldDeleteError) {
          console.error("Eski pet resmi silinemedi:", oldDeleteError);
        }
      }

      // 4. Yeni dosya ismi oluşturma
      const timestamp = Date.now();
      const fileExtension = file.originalname.split(".").pop();
      const fileName = `lost-pet-${userId}-${timestamp}.${fileExtension}`;

      // 5. Yeni lost pet resmi yükleme
      const { data: newImageData, error: newImageError } =
        await supabase.storage.from("lostpets").upload(fileName, file.buffer, {
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
            profile_type: "lost_pet",
            profile_id: petId,
            image_url: fileName,
            is_active: true,
          })
          .select()
          .single();

        if (insertErr) {
          // Rollback: Storage'dan yüklenen dosyayı geri al
          await supabase.storage.from("lostpets").remove([fileName]);
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
 * @route GET /pet/lost/:filename
 * @desc Kaybolmuş hayvan resmini getir
 * @access Public
 */
router.get("/lost/:filename", async (req, res) => {
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
      .from("lostpets")
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

/**
 * @route GET /pet/lost/nearby?latitude=38.xxx&longitude=28.xxx
 * @desc Kullanıcıya yakın kaybolmuş hayvanları getir
 * @access Private
 */

router.get("/lost/nearby", verifyToken, async (req, res) => {
  try {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Koordinat değerleri gerekli",
        "Enlem ve boylam değerleri zorunludur. Örnek: ?latitude=38.123&longitude=28.456"
      );
    }

    // Koordinat validasyonu
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    if (isNaN(lat) || lat < -90 || lat > 90) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Geçersiz enlem değeri",
        "Enlem değeri -90 ile 90 arasında olmalıdır"
      );
    }

    if (isNaN(lon) || lon < -180 || lon > 180) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Geçersiz boylam değeri",
        "Boylam değeri -180 ile 180 arasında olmalıdır"
      );
    }

    // Supabase'de oluşturduğumuz 'get_nearby_pets' fonksiyonunu çağır
    const { data, error } = await supabase.rpc("get_nearby_pets", {
      user_lat: lat,
      user_lon: lon,
    });

    if (error) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Beklenmeyen bir sunucu hatası oldu",
        error.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Yakındaki kayıp hayvanlar başarıyla getirildi",
      data: data || [],
      total_count: data ? data.length : 0,
    });
    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

module.exports = router;
