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
 * @route GET /pet/my/:id
 * @desc Profildeki hayvanların detay sayfasını getir
 * @access Private
 */
router.get("/my/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
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

    // Yaş hesaplama fonksiyonu
    const calculateAge = (birthdate) => {
      if (!birthdate) return null;

      const today = new Date();
      const birth = new Date(birthdate);

      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();

      // Eğer doğum günü henüz gelmemişse yaştan 1 çıkar
      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < birth.getDate())
      ) {
        age--;
      }

      return age;
    };

    // Hayvanın yaşını hesapla
    let petAge = null;
    if (data.birthdate) {
      petAge = calculateAge(data.birthdate);
    }
    console.log(petAge);

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
        age: petAge,
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
 * @desc Profildeki hayvanların detay sayfasını getir
 * @access Private
 */

router.put("/my/:id", async (req, res) => {
  const userId = req.user.id;

  try {
  } catch (error) {
    const errorResponse = Response.errorResponse(
      Enum.HTTP_CODES.INT_SERVER_ERROR,
      "Hayvan bilgilerini düzenleme sırasında bilinmeyen bir hata oluştu",
      error.message
    );

    res.status(errorResponse.code).json(errorResponse);
  }
});

module.exports = router;
