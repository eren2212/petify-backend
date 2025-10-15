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

module.exports = router;
