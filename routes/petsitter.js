const express = require("express");
const multer = require("multer");
const supabase = require("../database/supabase");
const Response = require("../lib/Response");
const CustomError = require("../lib/Error");
const Enum = require("../config/Enum");
const { verifyToken } = require("../middleware/auth");
const router = express.Router();
const z = require("zod");

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
 * @route POST /petsitter/add/profile
 * @desc Pet sitter profile creation
 * @access Private
 */

router.post("/add/profile", verifyToken, async (req, res) => {
  try {
    const {
      display_name,
      bio,
      experience_years,
      phone_number,
      instagram_url,
      is_available,
    } = req.body;

    const userId = req.user.id; // Token'dan gelen user_id

    // 1. user_id'den user_role_id'yi otomatik bul
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role_type", "pet_sitter")
      .eq("status", "approved")
      .single();

    if (roleError || !roleData) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Pet sitter role not found",
        "User does not have an approved pet sitter role"
      );
    }

    const userRoleId = roleData.id; // Bulduk!

    // 2. Validation schema (user_role_id artık client'tan gelmiyor)
    const petSitterProfileSchema = z.object({
      display_name: z.string().min(1, "Display name is required"),
      bio: z.string().optional(),
      experience_years: z.number().min(0, "Experience years must be positive"),
      phone_number: z.string().min(1, "Phone number is required"),
      instagram_url: z.string().url("Invalid Instagram URL").optional(),
      is_available: z.boolean().default(true),
    });

    const newPetSitterProfile = {
      user_role_id: userRoleId, // Backend'de ekliyoruz
      display_name,
      bio,
      experience_years,
      phone_number,
      instagram_url,
      is_available,
    };

    // 3. Validation
    const validatedData = petSitterProfileSchema.parse(newPetSitterProfile);

    // user_role_id'yi ekle (validation'dan sonra)
    validatedData.user_role_id = userRoleId;

    // 4. Insert
    const { data: petSitterProfileData, error: petSitterProfileError } =
      await supabase
        .from("pet_sitter_profiles")
        .insert(validatedData)
        .select()
        .single();

    if (petSitterProfileError) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Pet sitter profile creation failed",
        petSitterProfileError.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.CREATED, {
      message: "Pet sitter profile created successfully",
      petSitterProfile: petSitterProfileData,
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route GET /petsitter/profile
 * @desc Pet sitter profile get
 * @access Private
 */
router.get("/profile", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. user_id'den user_role_id'yi bul
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role_type", "pet_sitter")
      .eq("status", "approved")
      .single();

    if (roleError || !roleData) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Pet sitter role not found",
        "User does not have an approved pet sitter role"
      );
    }

    // 2. user_role_id ile profile getir
    const { data: petSitterProfile, error: fetchError } = await supabase
      .from("pet_sitter_profiles")
      .select("*")
      .eq("user_role_id", roleData.id)
      .single();

    if (fetchError) {
      throw new CustomError(
        Enum.HTTP_CODES.NOT_FOUND,
        "Pet sitter profile not found",
        fetchError.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Pet sitter profile retrieved successfully",
      petSitterProfile: petSitterProfile,
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route PUT /petshop/profile
 * @desc Pet shop profile update
 * @access Private
 */
router.put("/profile", verifyToken, async (req, res) => {
  try {
    const {
      display_name,
      bio,
      experience_years,
      phone_number,
      instagram_url,
      is_available,
    } = req.body;

    const userId = req.user.id; // Token'dan gelen user_id

    // 1. user_id'den user_role_id'yi otomatik bul
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role_type", "pet_sitter")
      .eq("status", "approved")
      .single();

    if (roleError || !roleData) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Pet sitter role not found",
        "User does not have an approved pet sitter role"
      );
    }

    const userRoleId = roleData.id; // Bulduk!

    // 2. Validation schema (user_role_id artık client'tan gelmiyor)
    const updateData = {
      display_name,
      bio,
      experience_years,
      phone_number,
      instagram_url,
      is_available,
    };

    // 3. Validation
    const { data: petSitterProfileData, error: petSitterProfileError } =
      await supabase
        .from("pet_sitter_profiles")
        .update(updateData)
        .eq("user_role_id", userRoleId)
        .select()
        .single();

    if (petSitterProfileError) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Pet sitter profile update failed",
        petSitterProfileError.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.CREATED, {
      message: "Pet sitter profile updated successfully",
      petSitterProfile: petSitterProfileData,
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route POST /petsitter/add/profile/image
 * @desc Pet sitter profile image upload
 * @access Private
 */
router.post(
  "/add/profile/image",
  verifyToken,
  upload.single("petsitterprofile"),
  async (req, res) => {
    try {
      if (!req.file) {
        throw new CustomError(
          Enum.HTTP_CODES.BAD_REQUEST,
          "Dosya gerekli",
          "Lütfen bir pet shop profile resmi yükleyin."
        );
      }

      const userId = req.user.id;
      const file = req.file;

      // 1. user_role_id'yi bul
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role_type", "pet_sitter")
        .eq("status", "approved")
        .single();

      if (roleError || !roleData) {
        throw new CustomError(
          Enum.HTTP_CODES.FORBIDDEN,
          "Pet sitter role not found",
          "User does not have an approved pet sitter role"
        );
      }

      // 2. Mevcut logo kontrolü
      const { data: petSitterProfile, error: fetchError } = await supabase
        .from("pet_sitter_profiles")
        .select("logo_url")
        .eq("user_role_id", roleData.id)
        .single();

      if (fetchError) {
        throw new CustomError(
          Enum.HTTP_CODES.INT_SERVER_ERROR,
          "Profil bilgisi alınamadı",
          fetchError.message
        );
      }

      // 3. Eski logo varsa sil
      if (petSitterProfile.logo_url) {
        const oldFilePath = petSitterProfile.logo_url;
        const { error: deleteError } = await supabase.storage
          .from("petsitterprofiles")
          .remove([oldFilePath]);

        if (deleteError) {
          console.error("Eski logo silinemedi:", deleteError);
        }
      }

      // 4. Yeni logo yükle
      const timestamp = Date.now();
      const fileExtension = file.originalname.split(".").pop();
      const fileName = `petsitter-profile-${userId}-${timestamp}.${fileExtension}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("petsitterprofiles")
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw new CustomError(
          Enum.HTTP_CODES.INT_SERVER_ERROR,
          "Pet sitter profile image upload failed",
          uploadError.message
        );
      }

      // 5. Database güncelle
      const { data: updateData, error: updateError } = await supabase
        .from("pet_sitter_profiles")
        .update({ logo_url: fileName })
        .eq("user_role_id", roleData.id)
        .select()
        .single();

      if (updateError) {
        // Yüklenen dosyayı geri al
        await supabase.storage.from("petsitterprofiles").remove([fileName]);

        throw new CustomError(
          Enum.HTTP_CODES.INT_SERVER_ERROR,
          "Pet sitter profile image update failed",
          updateError.message
        );
      }

      const response = Response.successResponse(Enum.HTTP_CODES.OK, {
        message: "Pet sitter profile image updated successfully",
        logo_url: fileName,
        petSitterProfile: updateData,
      });

      return res.status(response.code).json(response);
    } catch (error) {
      if (error.code === "LIMIT_FILE_SIZE") {
        const errorResponse = Response.errorResponse(
          new CustomError(
            Enum.HTTP_CODES.BAD_REQUEST,
            "Dosya çok büyük",
            "Logo boyutu maksimum 5MB olabilir."
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
 * @route GET /petsitter/profile/image/:filename
 * @desc Pet sitter profile image resmini download et (private bucket için)
 * @access Public (herkes görebilir)
 */
router.get("/profile/image/:filename", async (req, res) => {
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
      .from("petsitterprofiles")
      .download(filename);

    if (error || !data) {
      throw new CustomError(
        Enum.HTTP_CODES.NOT_FOUND,
        "Pet sitter profile image not found",
        "Requested pet sitter profile image not found."
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
 * @route DELETE /petsitter/profile/image
 * @desc Pet sitter profile image delete
 * @access Private
 */
router.delete("/profile/image", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. user_role_id'yi bul
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role_type", "pet_sitter")
      .eq("status", "approved")
      .single();

    if (roleError || !roleData) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Pet sitter role not found",
        "User does not have an approved pet sitter role"
      );
    }

    // 2. Mevcut logo_url'i al
    const { data: petSitterProfile, error: fetchError } = await supabase
      .from("pet_sitter_profiles")
      .select("logo_url")
      .eq("user_role_id", roleData.id)
      .single();

    if (fetchError) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Pet sitter profile image information not found",
        fetchError.message
      );
    }

    // 3. Logo yoksa hata ver
    if (!petSitterProfile.logo_url) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Pet sitter profile image not found",
        "Requested pet sitter profile image not found."
      );
    }

    const profileImagePath = petSitterProfile.logo_url;

    // 4. Storage'dan sil
    const { error: storageError } = await supabase.storage
      .from("petsitterprofiles")
      .remove([profileImagePath]);

    if (storageError) {
      console.error(
        "Pet sitter profile image storage'dan silinemedi:",
        storageError
      );
    }

    // 5. Database'de null yap
    const { data: updatedProfile, error: updateError } = await supabase
      .from("pet_sitter_profiles")
      .update({ logo_url: null })
      .eq("user_role_id", roleData.id)
      .select()
      .single();

    if (updateError) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Pet sitter profile image information not deleted",
        updateError.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Pet sitter profile image successfully deleted",
      petSitterProfile: updatedProfile,
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

module.exports = router;
