const express = require("express");
const supabase = require("../database/supabase");
const Response = require("../lib/Response");
const CustomError = require("../lib/Error");
const Enum = require("../config/Enum");
const { verifyToken } = require("../middleware/auth");
const router = express.Router();
const multer = require("multer");

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
 * @route POST /petclinicdoctors/add
 * @desc Pet clinic doctor creation
 * @access Private
 */
router.post("/add", verifyToken, async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      gender,
      specialization,
      experience_years,
      bio,
    } = req.body;

    const userId = req.user.id;
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role_type", "pet_clinic")
      .eq("status", "approved")
      .single();

    if (roleError || !roleData) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Pet clinic role not found",
        "User does not have a pet clinic role"
      );
    }
    const userRoleId = roleData.id;
    const { data: clinicProfileData, error: clinicProfileError } =
      await supabase
        .from("clinic_profiles")
        .select("id")
        .eq("user_role_id", userRoleId)
        .single();
    if (clinicProfileError || !clinicProfileData) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Clinic profile not found",
        "User does not have a clinic profile"
      );
    }
    const clinicProfileId = clinicProfileData.id;
    const newDoctor = {
      clinic_profile_id: clinicProfileId,
      first_name,
      last_name,
      gender,
      specialization,
      experience_years,
      bio,
    };
    const { data: newDoctorData, error: newDoctorError } = await supabase
      .from("clinic_veterinarians")
      .insert(newDoctor)
      .select()
      .single();

    if (newDoctorError) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Failed to add doctor",
        newDoctorError.message
      );
    }
    const successResponse = Response.successResponse(Enum.HTTP_CODES.CREATED, {
      message: "Doctor added successfully",
      data: newDoctorData,
    });
    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route GET /petclinicdoctors/get
 * @desc Get pet clinic doctors
 * @access Private
 */
router.get("/my-list", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { gender } = req.query;
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role_type", "pet_clinic")
      .eq("status", "approved")
      .single();
    if (roleError || !roleData) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Pet clinic role not found",
        "User does not have a pet clinic role"
      );
    }
    const userRoleId = roleData.id;
    const { data: clinicProfileData, error: clinicProfileError } =
      await supabase
        .from("clinic_profiles")
        .select("id")
        .eq("user_role_id", userRoleId)
        .single();
    if (clinicProfileError || !clinicProfileData) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Clinic profile not found",
        "User does not have a clinic profile"
      );
    }
    const clinicProfileId = clinicProfileData.id;
    
    // Query builder with optional gender filter
    let query = supabase
      .from("clinic_veterinarians")
      .select("*")
      .eq("clinic_profile_id", clinicProfileId);
    
    // Gender filtresi varsa ekle
    if (gender && (gender === "male" || gender === "female")) {
      query = query.eq("gender", gender);
    }
    
    const { data: doctorsData, error: doctorsError } = await query.order(
      "created_at",
      { ascending: false }
    );

    if (doctorsError) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Failed to get doctors",
        doctorsError.message
      );
    }
    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Doctors fetched successfully",
      data: doctorsData,
      total: doctorsData.length,
    });
    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route GET /petclinicdoctors/get/:id
 * @desc Get pet clinic doctor by id
 * @access Private
 */
router.get("/detail/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role_type", "pet_clinic")
      .eq("status", "approved")
      .single();

    if (roleError || !roleData) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Pet clinic role not found",
        "User does not have a pet clinic role"
      );
    }

    const userRoleId = roleData.id;
    const { data: clinicProfileData, error: clinicProfileError } =
      await supabase
        .from("clinic_profiles")
        .select("id")
        .eq("user_role_id", userRoleId)
        .single();

    if (clinicProfileError || !clinicProfileData) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Clinic profile not found",
        "User does not have a clinic profile"
      );
    }

    const clinicProfileId = clinicProfileData.id;
    const { data: doctorData, error: doctorError } = await supabase
      .from("clinic_veterinarians")
      .select("*")
      .eq("id", id)
      .eq("clinic_profile_id", clinicProfileId)
      .single();

    if (doctorError || !doctorData) {
      throw new CustomError(
        Enum.HTTP_CODES.NOT_FOUND,
        "Doctor not found",
        "Doctor not found"
      );
    }
    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Doctor fetched successfully",
      data: doctorData,
    });
    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route PUT /petclinicdoctors/update/:id
 * @desc Update pet clinic doctor
 * @access Private
 */
router.put("/update/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role_type", "pet_clinic")
      .eq("status", "approved")
      .single();

    if (roleError || !roleData) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Pet clinic role not found",
        "User does not have a pet clinic role"
      );
    }

    const userRoleId = roleData.id;
    const { data: clinicProfileData, error: clinicProfileError } =
      await supabase
        .from("clinic_profiles")
        .select("id")
        .eq("user_role_id", userRoleId)
        .single();

    if (clinicProfileError || !clinicProfileData) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Clinic profile not found",
        "User does not have a clinic profile"
      );
    }

    const clinicProfileId = clinicProfileData.id;

    // Doktorun bu kliniğe ait olup olmadığını kontrol et
    const { data: existingDoctor, error: existingDoctorError } = await supabase
      .from("clinic_veterinarians")
      .select("id")
      .eq("id", id)
      .eq("clinic_profile_id", clinicProfileId)
      .single();

    if (existingDoctorError || !existingDoctor) {
      throw new CustomError(
        Enum.HTTP_CODES.NOT_FOUND,
        "Doctor not found",
        "Doctor not found or does not belong to your clinic"
      );
    }

    const {
      first_name,
      last_name,
      gender,
      specialization,
      experience_years,
      bio,
    } = req.body;

    const newDoctor = {
      first_name,
      last_name,
      gender,
      specialization,
      experience_years,
      bio,
    };

    const { data: newDoctorData, error: newDoctorError } = await supabase
      .from("clinic_veterinarians")
      .update(newDoctor)
      .eq("id", id)
      .select()
      .single();

    if (newDoctorError) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Failed to update doctor",
        newDoctorError.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Doctor updated successfully",
      data: newDoctorData,
    });
    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route DELETE /petclinicdoctors/delete/:id
 * @desc Delete pet clinic doctor
 * @access Private
 */
router.delete("/delete/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role_type", "pet_clinic")
      .eq("status", "approved")
      .single();

    if (roleError || !roleData) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Pet clinic role not found",
        "User does not have a pet clinic role"
      );
    }

    const userRoleId = roleData.id;
    const { data: clinicProfileData, error: clinicProfileError } =
      await supabase
        .from("clinic_profiles")
        .select("id")
        .eq("user_role_id", userRoleId)
        .single();

    if (clinicProfileError || !clinicProfileData) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Clinic profile not found",
        "User does not have a clinic profile"
      );
    }

    const clinicProfileId = clinicProfileData.id;

    const { data: doctorData, error: doctorError } = await supabase
      .from("clinic_veterinarians")
      .delete()
      .eq("id", id)
      .eq("clinic_profile_id", clinicProfileId)
      .select()
      .single();

    if (doctorError || !doctorData) {
      throw new CustomError(
        Enum.HTTP_CODES.NOT_FOUND,
        "Doctor not found",
        "Doctor not found or does not belong to your clinic"
      );
    }
    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Doctor deleted successfully",
      data: doctorData,
    });
    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route POST /petclinicdoctors/image/:id
 * @desc Upload image for a specific doctor
 * @access Private (Only Doctor Owner)
 */
router.post(
  "/image/:id",
  verifyToken,
  upload.single("clinic_veterinarians"),
  async (req, res) => {
    try {
      const { id: doctorId } = req.params;

      // 1. Dosya Kontrolü
      if (!req.file) {
        throw new CustomError(
          Enum.HTTP_CODES.BAD_REQUEST,
          "Dosya gerekli",
          "Lütfen bir ürün resmi yükleyin."
        );
      }

      const userId = req.user.id;
      const file = req.file;

      // A. Kullanıcının pet_clinic rolünü kontrol et
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role_type", "pet_clinic")
        .eq("status", "approved")
        .single();

      if (roleError || !roleData) {
        throw new CustomError(
          Enum.HTTP_CODES.FORBIDDEN,
          "Pet clinic role not found",
          "User does not have a pet clinic role"
        );
      }

      // B. Clinic Profil ID'sini Bul
      const { data: clinicProfile, error: profileError } = await supabase
        .from("clinic_profiles")
        .select("id")
        .eq("user_role_id", roleData.id)
        .single();

      if (profileError || !clinicProfile) {
        throw new CustomError(
          Enum.HTTP_CODES.FORBIDDEN,
          "Clinic profile not found",
          "User does not have a clinic profile"
        );
      }

      // C. Doctor'ı Bul ve SAHİPLİĞİNİ Kontrol Et
      const { data: currentDoctor, error: currentDoctorError } = await supabase
        .from("clinic_veterinarians")
        .select("id, photo_url")
        .eq("id", doctorId)
        .eq("clinic_profile_id", clinicProfile.id)
        .single();

      if (currentDoctorError || !currentDoctor) {
        throw new CustomError(
          Enum.HTTP_CODES.NOT_FOUND,
          "Doctor not found",
          "Doctor not found or does not belong to your clinic"
        );
      }

      // 3. Eski resmi sil (Eğer varsa)
      if (currentDoctor.photo_url) {
        const oldFileName = currentDoctor.photo_url;
        // Hata alsa bile devam etsin, belki dosya zaten storage'da yoktur ama DB'de yazıyordur.
        const { error: deleteError } = await supabase.storage
          .from("avatars")
          .remove(`clinicveterinarians/${oldFileName}`);

        if (deleteError)
          console.log(
            "Eski doctor resmi silinirken uyarı:",
            deleteError.message
          );
      }

      // 4. Yeni resmi Storage'a yükle
      const timestamp = Date.now();
      // Dosya ismini random yapmak her zaman daha iyidir, çakışmayı önler
      const fileExtension = file.originalname.split(".").pop();
      const fileName = `clinic-veterinarian-${doctorId}-${timestamp}.${fileExtension}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(`clinicveterinarians/${fileName}`, file.buffer, {
          contentType: file.mimetype,
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw new CustomError(
          Enum.HTTP_CODES.INT_SERVER_ERROR,
          "Doctor image upload failed",
          uploadError.message
        );
      }

      // 5. Database'i güncelle (Sadece o ürünün satırını)
      const { data: updateData, error: updateError } = await supabase
        .from("clinic_veterinarians")
        .update({ photo_url: fileName })
        .eq("id", doctorId) // <-- ARTIK SADECE BU ID GÜNCELLENİYOR
        .select()
        .single();

      if (updateError) {
        // DB güncellenemezse yüklenen resmi geri sil (Temizlik)
        await supabase.storage
          .from("avatars")
          .remove(`clinicveterinarians/${fileName}`);

        throw new CustomError(
          Enum.HTTP_CODES.INT_SERVER_ERROR,
          "Database update failed",
          updateError.message
        );
      }

      const response = Response.successResponse(Enum.HTTP_CODES.OK, {
        message: "Doctor image updated successfully",
        photo_url: fileName,
        clinicVeterinarian: updateData,
      });

      res.status(response.code).json(response);
    } catch (error) {
      if (error.code === "LIMIT_FILE_SIZE") {
        const errorResponse = Response.errorResponse(
          new CustomError(
            Enum.HTTP_CODES.BAD_REQUEST,
            "Dosya çok büyük",
            "Resim boyutu maksimum 5MB olabilir."
          )
        );
        return res.status(errorResponse.code).json(errorResponse);
      }

      const errorResponse = Response.errorResponse(error);
      res.status(errorResponse.code).json(errorResponse);
    }
  }
);
/**
 * @route GET /products/image/:filename
 * @desc Product image download
 * @access Public (herkes görebilir)
 */
router.get("/image/:filename", async (req, res) => {
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
      .from("avatars")
      .download(`clinicveterinarians/${filename}`);

    if (error || !data) {
      throw new CustomError(
        Enum.HTTP_CODES.NOT_FOUND,
        "Doctor image not found",
        "Requested doctor image not found."
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
