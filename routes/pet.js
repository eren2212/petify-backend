const express = require("express");
const supabase = require("../database/supabase");
const Response = require("../lib/Response");
const CustomError = require("../lib/Error");
const Enum = require("../config/Enum");
const { verifyToken } = require("../middleware/auth");
const router = express.Router();

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

    console.log("Pet age info:", ageInfo);

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

module.exports = router;
