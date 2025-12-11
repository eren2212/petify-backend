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
 * @route POST /petotel/add/profile
 * @desc Pet hotel profile creation
 * @access Private
 */

router.post("/add/profile", verifyToken, async (req, res) => {
  try {
    const {
      hotel_name,
      description,
      address,
      latitude,
      longitude,
      phone_number,
      email,
      website_url,
      instagram_url,
      logo_url,
      working_hours,
      capacity,
      check_in_time,
      check_out_time,
    } = req.body;

    const userId = req.user.id; // Token'dan gelen user_id

    // 1. user_id'den user_role_id'yi otomatik bul
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role_type", "pet_hotel")
      .eq("status", "approved")
      .single();

    if (roleError || !roleData) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Pet hotel role not found",
        "User does not have an approved pet hotel role"
      );
    }

    const userRoleId = roleData.id; // Bulduk!

    // 2. Validation schema (user_role_id artık client'tan gelmiyor)
    const petHotelProfileSchema = z.object({
      hotel_name: z.string().min(1, "Pet hotel name is required"),
      description: z.string().optional(),
      address: z.string().min(1, "Address is required"),
      latitude: z.number().min(-90).max(90, "Invalid latitude"),
      longitude: z.number().min(-180).max(180, "Invalid longitude"),
      phone_number: z.string().min(1, "Phone number is required"),
      email: z.string().email("Invalid email address"),
      website_url: z.string().url("Invalid website URL").optional(),
      instagram_url: z.string().url("Invalid Instagram URL").optional(),
      logo_url: z.string().url("Invalid logo URL").optional(),
      cover_image_url: z.string().url("Invalid cover image URL").optional(),
      capacity: z.number().optional(),
      check_in_time: z.string().optional(),
      check_out_time: z.string().optional(),
      working_hours: z
        .array(
          z.object({
            day: z.string().min(1, "Day is required"),
            hours: z.string().min(1, "Hours is required"),
          })
        )
        .optional(),
    });

    const newPetHotelProfile = {
      user_role_id: userRoleId, // Backend'de ekliyoruz
      hotel_name,
      description,
      address,
      latitude,
      longitude,
      phone_number,
      email,
      website_url,
      instagram_url,
      logo_url,
      capacity,
      check_in_time,
      check_out_time,
      working_hours,
    };

    // 3. Validation
    const validatedData = petHotelProfileSchema.parse(newPetHotelProfile);

    // user_role_id'yi ekle (validation'dan sonra)
    validatedData.user_role_id = userRoleId;

    // 4. Insert
    const { data: petHotelProfileData, error: petHotelProfileError } =
      await supabase
        .from("pet_hotel_profiles")
        .insert(validatedData)
        .select()
        .single();

    if (petHotelProfileError) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Pet hotel profile creation failed",
        petHotelProfileError.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.CREATED, {
      message: "Pet hotel profile created successfully",
      petOtelProfile: petHotelProfileData,
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route GET /petotel/profile
 * @desc Pet hotel profile get
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
      .eq("role_type", "pet_hotel")
      .eq("status", "approved")
      .single();

    if (roleError || !roleData) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Pet hotel role not found",
        "User does not have an approved pet hotel role"
      );
    }

    // 2. user_role_id ile profile getir
    const { data: petHotelProfile, error: fetchError } = await supabase
      .from("pet_hotel_profiles")
      .select("*")
      .eq("user_role_id", roleData.id)
      .single();

    if (fetchError) {
      throw new CustomError(
        Enum.HTTP_CODES.NOT_FOUND,
        "Pet hotel profile not found",
        fetchError.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Pet hotel profile retrieved successfully",
      petOtelProfile: petHotelProfile,
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route PUT /petotel/profile
 * @desc Pet hotel profile update
 * @access Private
 */
router.put("/profile", verifyToken, async (req, res) => {
  try {
    const {
      hotel_name,
      description,
      address,
      latitude,
      longitude,
      phone_number,
      email,
      website_url,
      instagram_url,
      logo_url,
      capacity,
      check_in_time,
      check_out_time,
      working_hours,
    } = req.body;

    const userId = req.user.id; // Token'dan gelen user_id

    // 1. user_id'den user_role_id'yi otomatik bul
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role_type", "pet_hotel")
      .eq("status", "approved")
      .single();

    if (roleError || !roleData) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Pet hotel role not found",
        "User does not have an approved pet hotel role"
      );
    }

    const userRoleId = roleData.id; // Bulduk!

    // 2. Validation schema (user_role_id artık client'tan gelmiyor)
    const updateData = {
      hotel_name,
      description,
      address,
      latitude,
      longitude,
      phone_number,
      email,
      website_url,
      instagram_url,
      logo_url,
      capacity,
      check_in_time,
      check_out_time,
      working_hours,
    };

    // 3. Validation
    const { data: petHotelProfileData, error: petHotelProfileError } =
      await supabase
        .from("pet_hotel_profiles")
        .update(updateData)
        .eq("user_role_id", userRoleId)
        .select()
        .single();

    if (petHotelProfileError) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Pet hotel profile update failed",
        petHotelProfileError.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.CREATED, {
      message: "Pet hotel profile updated successfully",
      petOtelProfile: petHotelProfileData,
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route POST /petotel/add/profile/image
 * @desc Pet hotel profile image upload
 * @access Private
 */
router.post(
  "/add/profile/image",
  verifyToken,
  upload.single("pethotelprofile"),
  async (req, res) => {
    try {
      if (!req.file) {
        throw new CustomError(
          Enum.HTTP_CODES.BAD_REQUEST,
          "Dosya gerekli",
          "Lütfen bir pet hotel profile resmi yükleyin."
        );
      }

      const userId = req.user.id;
      const file = req.file;

      // 1. user_role_id'yi bul
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role_type", "pet_hotel")
        .eq("status", "approved")
        .single();

      if (roleError || !roleData) {
        throw new CustomError(
          Enum.HTTP_CODES.FORBIDDEN,
          "Pet hotel role not found",
          "User does not have an approved pet hotel role"
        );
      }

      // 2. Mevcut logo kontrolü
      const { data: petHotelProfile, error: fetchError } = await supabase
        .from("pet_hotel_profiles")
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
      if (petHotelProfile.logo_url) {
        const oldFilePath = petHotelProfile.logo_url;
        const { error: deleteError } = await supabase.storage
          .from("pethotelprofiles")
          .remove([oldFilePath]);

        if (deleteError) {
          console.error("Eski logo silinemedi:", deleteError);
        }
      }

      // 4. Yeni logo yükle
      const timestamp = Date.now();
      const fileExtension = file.originalname.split(".").pop();
      const fileName = `pethotelprofiles-${userId}-${timestamp}.${fileExtension}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("pethotelprofiles")
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw new CustomError(
          Enum.HTTP_CODES.INT_SERVER_ERROR,
          "Pet hotel profile logo yüklenemedi",
          uploadError.message
        );
      }

      // 5. Database güncelle
      const { data: updateData, error: updateError } = await supabase
        .from("pet_hotel_profiles")
        .update({ logo_url: fileName })
        .eq("user_role_id", roleData.id)
        .select()
        .single();

      if (updateError) {
        // Yüklenen dosyayı geri al
        await supabase.storage.from("pethotelprofiles").remove([fileName]);

        throw new CustomError(
          Enum.HTTP_CODES.INT_SERVER_ERROR,
          "Pet hotel profile logo güncellenemedi",
          updateError.message
        );
      }

      const response = Response.successResponse(Enum.HTTP_CODES.OK, {
        message: "Pet hotel profile logo başarıyla güncellendi",
        logo_path: fileName,
        profile: updateData,
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
 * @route GET /petshop/profile/logo/:filename
 * @desc Pet shop profile logo resmini download et (private bucket için)
 * @access Public (herkes görebilir)
 */
router.get("/profile/logo/:filename", async (req, res) => {
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
      .from("pethotelprofiles")
      .download(filename);

    if (error || !data) {
      throw new CustomError(
        Enum.HTTP_CODES.NOT_FOUND,
        "Pet hotel profile logo bulunamadı",
        "İstenen pet hotel profile logo resmi bulunamadı."
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
 * @route DELETE /petshop/profile/logo
 * @desc Avatarı silme işlemi
 * @access Private
 */
router.delete("/profile/logo", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. user_role_id'yi bul
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role_type", "pet_hotel")
      .eq("status", "approved")
      .single();

    if (roleError || !roleData) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Pet hotel role not found",
        "User does not have an approved pet hotel role"
      );
    }

    // 2. Mevcut logo_url'i al
    const { data: petHotelProfile, error: fetchError } = await supabase
      .from("pet_hotel_profiles")
      .select("logo_url")
      .eq("user_role_id", roleData.id)
      .single();

    if (fetchError) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Pet hotel profile logo bilgisi alınamadı",
        fetchError.message
      );
    }

    // 3. Logo yoksa hata ver
    if (!petHotelProfile.logo_url) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Silinecek pet hotel profile logo bulunamadı",
        "Kullanıcının pet hotel profile logo resmi bulunmuyor"
      );
    }

    const logoPath = petHotelProfile.logo_url;

    // 4. Storage'dan sil
    const { error: storageError } = await supabase.storage
      .from("pethotelprofiles")
      .remove([logoPath]);

    if (storageError) {
      console.error(
        "Pet hotel profile logo storage'dan silinemedi:",
        storageError
      );
    }

    // 5. Database'de null yap
    const { data: updatedProfile, error: updateError } = await supabase
      .from("pet_hotel_profiles")
      .update({ logo_url: null })
      .eq("user_role_id", roleData.id)
      .select()
      .single();

    if (updateError) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Pet hotel profile logo bilgisi silinemedi",
        updateError.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Pet hotel profile logo başarıyla silindi",
      profile: updatedProfile,
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

module.exports = router;
