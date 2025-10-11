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
 * @route POST /profile/avatar
 * @desc Kullanıcı avatarı yükleme/güncelleme (varsa eskisini sil)
 * @access Private
 */
router.post(
  "/avatar",
  verifyToken,
  upload.single("avatar"),
  async (req, res) => {
    try {
      // Dosya kontrolü
      if (!req.file) {
        throw new CustomError(
          Enum.HTTP_CODES.BAD_REQUEST,
          "Dosya gerekli",
          "Lütfen bir avatar resmi yükleyin."
        );
      }

      const userId = req.user.id;
      const file = req.file;

      // 1. Mevcut avatar URL'ini kontrol et
      const { data: userProfile, error: fetchError } = await supabase
        .from("user_profiles")
        .select("avatar_url")
        .eq("user_id", userId)
        .single();

      if (fetchError) {
        throw new CustomError(
          Enum.HTTP_CODES.INT_SERVER_ERROR,
          "Profil bilgisi alınamadı",
          fetchError.message
        );
      }

      // 2. Eski avatar varsa storage'dan sil
      if (userProfile.avatar_url) {
        // avatar_url artık sadece filename (örn: user123-1234567890.jpg)
        const oldFilePath = userProfile.avatar_url;

        const { error: deleteError } = await supabase.storage
          .from("avatars")
          .remove([oldFilePath]);

        if (deleteError) {
          console.error("Eski avatar silinemedi:", deleteError);
          // Devam et, kritik bir hata değil
        }
      }

      // 3. Yeni dosya adı oluştur (unique)
      const timestamp = Date.now();
      const fileExtension = file.originalname.split(".").pop();
      const fileName = `${userId}-${timestamp}.${fileExtension}`;

      // 4. Yeni avatar'ı storage'a yükle
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw new CustomError(
          Enum.HTTP_CODES.INT_SERVER_ERROR,
          "Avatar yüklenemedi",
          uploadError.message
        );
      }

      // 5. Sadece filename'i kaydet (bucket private olduğu için URL değil)
      // Frontend download endpoint'i kullanacak: /api/profile/avatar/:filename
      const avatarPath = fileName;

      // 6. user_profiles tablosunda avatar_url güncelle (filename olarak)
      const { data: updateData, error: updateError } = await supabase
        .from("user_profiles")
        .update({ avatar_url: avatarPath })
        .eq("user_id", userId)
        .select()
        .single();

      if (updateError) {
        // Yüklenen dosyayı geri al
        await supabase.storage.from("avatars").remove([fileName]);

        throw new CustomError(
          Enum.HTTP_CODES.INT_SERVER_ERROR,
          "Profil güncellenemedi",
          updateError.message
        );
      }

      // 7. Başarılı response
      const response = Response.successResponse(Enum.HTTP_CODES.OK, {
        message: "Avatar başarıyla güncellendi",
        avatar_path: avatarPath, // filename döndür
        profile: updateData,
      });

      return res.status(response.code).json(response);
    } catch (error) {
      // Multer hataları için özel işleme
      if (error.code === "LIMIT_FILE_SIZE") {
        const errorResponse = Response.errorResponse(
          new CustomError(
            Enum.HTTP_CODES.BAD_REQUEST,
            "Dosya çok büyük",
            "Avatar boyutu maksimum 5MB olabilir."
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
 * @route GET /profile/avatar/:filename
 * @desc Avatar resmini download et (private bucket için)
 * @access Public (herkes görebilir)
 */
router.get("/avatar/:filename", async (req, res) => {
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
      .download(filename);

    if (error || !data) {
      throw new CustomError(
        Enum.HTTP_CODES.NOT_FOUND,
        "Avatar bulunamadı",
        "İstenen avatar resmi bulunamadı."
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
 * @route PUT /profile/information
 * @desc Profil bilgilerini güncelle
 * @access Private
 */
router.put("/information", verifyToken, async (req, res) => {
  try {
    const { full_name, phone_number } = req.body;
    const userId = req.user.id; // Authenticated user'dan al

    // Input validation
    if (!full_name && !phone_number) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "En az bir alan doldurulmalıdır",
        "full_name veya phone_number gerekli"
      );
    }

    // Sadece gönderilen alanları update et
    const updateData = {};
    if (full_name) updateData.full_name = full_name;
    if (phone_number) updateData.phone_number = phone_number;

    const { data: displayNameData, displayNameerror } =
      await supabase.auth.updateUser({
        data: {
          display_name: full_name,
        },
      });

    if (displayNameerror) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Display name güncellenemedi",
        displayNameerror.message
      );
    }

    const { data, error } = await supabase
      .from("user_profiles")
      .update(updateData)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Profil bilgileriniz güncellenemedi",
        error.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Profil başarılı bir şekilde güncellendi",
      profile: data,
    });
    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route DELETE /profile/avatar
 * @desc Avatarı silme işlemi
 * @access Private
 */
router.delete("/avatar", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Mevcut avatar_url'i database'den al
    const { data: userProfile, error: fetchError } = await supabase
      .from("user_profiles")
      .select("avatar_url")
      .eq("user_id", userId)
      .single();

    if (fetchError) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Profil bilgisi alınamadı",
        fetchError.message
      );
    }

    // 2. Avatar yoksa hata ver
    if (!userProfile.avatar_url) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Silinecek avatar bulunamadı",
        "Kullanıcının avatar resmi bulunmuyor"
      );
    }

    const avatarPath = userProfile.avatar_url;

    // 3. Storage'dan sil
    const { error: storageError } = await supabase.storage
      .from("avatars")
      .remove([avatarPath]);

    if (storageError) {
      console.error("Avatar storage'dan silinemedi:", storageError);
      // Devam et, kritik değil (dosya zaten silinmiş olabilir)
    }

    // 4. Database'de avatar_url'i null yap
    const { data: updatedProfile, error: updateError } = await supabase
      .from("user_profiles")
      .update({ avatar_url: null })
      .eq("user_id", userId)
      .select()
      .single();

    if (updateError) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Avatar bilgisi silinemedi",
        updateError.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Avatar başarıyla silindi",
      profile: updatedProfile,
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route POST /profile/pet/add
 * @desc Profile hayvan ekleme
 * @access Private
 */

router.post("/pet/add", verifyToken, async (req, res) => {
  const {
    pet_type_id,
    name,
    breed,
    age_years,
    age_months,
    gender,
    weight_kg,
    color,
    description,
  } = req.body;

  const userId = req.user.id;

  try {
    const newPet = {
      user_id: userId,
      pet_type_id,
      name,
      breed,
      age_years,
      age_months,
      gender,
      weight_kg,
      color,
      description,
    };
    const { data: petFormData, error: petFormError } = await supabase
      .from("pets")
      .insert(newPet)
      .select()
      .single();

    if (petFormError) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Yeni hayvan eklenemedi",
        petFormError.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Başarılı bir şekilde hayvan kayıt edildi",
      pet: petFormData,
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route GET /profile/pet
 * @desc Profile hayvanları görüntüleme
 * @access Private
 */

router.get("/pet", verifyToken, async (req, res) => {
  const userId = req.user.id;

  try {
    if (!userId) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "User id bulunamadı",
        "user id gerekli"
      );
    }

    const { data, error } = await supabase
      .from("pets")
      .select("*")
      .eq("user_id", userId);

    if (error) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Hayvanlar görüntülenemedi",
        error.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Başarılı bir şekilde görüntülendi",
      pets: data,
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route POST /profile/pet/:petId/image
 * @desc Pet resmi yükleme
 * @access Private
 */
router.post(
  "/pet/:petId/image",
  verifyToken,
  upload.single("petImage"),
  async (req, res) => {
    try {
      // Dosya kontrolü
      if (!req.file) {
        throw new CustomError(
          Enum.HTTP_CODES.BAD_REQUEST,
          "Dosya gerekli",
          "Lütfen bir pet resmi yükleyin."
        );
      }

      const userId = req.user.id;
      const { petId } = req.params;
      const file = req.file;
      const { image_description } = req.body; // Opsiyonel açıklama

      // 1. Pet'in bu kullanıcıya ait olup olmadığını kontrol et
      const { data: petData, error: petError } = await supabase
        .from("pets")
        .select("id, name")
        .eq("id", petId)
        .eq("user_id", userId)
        .single();

      if (petError || !petData) {
        throw new CustomError(
          Enum.HTTP_CODES.BAD_REQUEST,
          "Pet bulunamadı",
          "Bu pet size ait değil veya mevcut değil"
        );
      }

      // 2. Mevcut resim sayısını kontrol et ve sıralama için kullan
      const { data: existingImages, error: countError } = await supabase
        .from("profile_images")
        .select("image_order")
        .eq("profile_type", "pet")
        .eq("profile_id", petId)
        .eq("is_active", true)
        .order("image_order", { ascending: false })
        .limit(1);

      if (countError) {
        console.error("Resim sayısı alınamadı:", countError);
      }

      // Yeni resmin sırası
      const nextOrder =
        existingImages && existingImages.length > 0
          ? existingImages[0].image_order + 1
          : 1;

      // 3. Dosya adı oluştur (unique)
      const timestamp = Date.now();
      const fileExtension = file.originalname.split(".").pop();
      const fileName = `${petId}-${timestamp}.${fileExtension}`;

      // 4. Storage'a yükle
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("mypets")
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw new CustomError(
          Enum.HTTP_CODES.INT_SERVER_ERROR,
          "Pet resmi yüklenemedi",
          uploadError.message
        );
      }

      // 5. profile_images tablosuna kaydet
      const { data: imageData, error: imageError } = await supabase
        .from("profile_images")
        .insert({
          profile_type: "pet",
          profile_id: petId,
          image_url: fileName,
          image_order: nextOrder,
          image_description: image_description || null,
          is_active: true,
        })
        .select()
        .single();

      if (imageError) {
        // Storage'dan yüklenen dosyayı geri al
        await supabase.storage.from("mypets").remove([fileName]);

        throw new CustomError(
          Enum.HTTP_CODES.INT_SERVER_ERROR,
          "Resim kaydedilemedi",
          imageError.message
        );
      }

      // 6. Başarılı response
      const response = Response.successResponse(Enum.HTTP_CODES.OK, {
        message: "Pet resmi başarıyla yüklendi",
        image: imageData,
        pet_name: petData.name,
      });

      return res.status(response.code).json(response);
    } catch (error) {
      // Multer hataları için özel işleme
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
      return res.status(errorResponse.code).json(errorResponse);
    }
  }
);

/**
 * @route GET /profile/pet/image/:filename
 * @desc Pet resmini görüntüleme (public)
 * @access Public (herkes görebilir)
 */
router.get("/pet/image/:filename", async (req, res) => {
  try {
    const { filename } = req.params;

    // Güvenlik: Sadece pet resimlerine izin ver
    if (!filename || filename.includes("..") || filename.includes("/")) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Geçersiz dosya adı",
        "Dosya adı geçersiz karakterler içeriyor."
      );
    }

    // Supabase Storage'dan dosyayı download et
    const { data, error } = await supabase.storage
      .from("mypets")
      .download(filename);

    if (error || !data) {
      throw new CustomError(
        Enum.HTTP_CODES.NOT_FOUND,
        "Resim bulunamadı",
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
 * @route GET /profile/pet/:petId/images
 * @desc Bir pet'in tüm resimlerini listeleme
 * @access Private
 */
router.get("/pet/:petId/images", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { petId } = req.params;

    // 1. Pet'in bu kullanıcıya ait olup olmadığını kontrol et
    const { data: petData, error: petError } = await supabase
      .from("pets")
      .select("id, name")
      .eq("id", petId)
      .eq("user_id", userId)
      .single();

    if (petError || !petData) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Pet bulunamadı",
        "Bu pet size ait değil veya mevcut değil"
      );
    }

    // 2. Pet'in tüm aktif resimlerini getir
    const { data: images, error: imagesError } = await supabase
      .from("profile_images")
      .select("*")
      .eq("profile_type", "pet")
      .eq("profile_id", petId)
      .eq("is_active", true)
      .order("image_order", { ascending: true });

    if (imagesError) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Resimler getirilemedi",
        imagesError.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Pet resimleri başarıyla getirildi",
      pet_name: petData.name,
      images: images || [],
      total_count: images ? images.length : 0,
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route DELETE /profile/pet/image/:imageId
 * @desc Pet resmini silme
 * @access Private
 */
router.delete("/pet/image/:imageId", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { imageId } = req.params;

    // 1. Resim kaydını getir
    const { data: imageData, error: fetchError } = await supabase
      .from("profile_images")
      .select("*, pets!inner(user_id)")
      .eq("id", imageId)
      .eq("profile_type", "pet")
      .single();

    if (fetchError || !imageData) {
      throw new CustomError(
        Enum.HTTP_CODES.NOT_FOUND,
        "Resim bulunamadı",
        "İstenen resim bulunamadı"
      );
    }

    // 2. Pet'in bu kullanıcıya ait olup olmadığını kontrol et
    if (imageData.pets.user_id !== userId) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Yetkiniz yok",
        "Bu resmi silme yetkiniz yok"
      );
    }

    const fileName = imageData.image_url;

    // 3. Storage'dan sil
    const { error: storageError } = await supabase.storage
      .from("mypets")
      .remove([fileName]);

    if (storageError) {
      console.error("Resim storage'dan silinemedi:", storageError);
      // Devam et, kritik değil (dosya zaten silinmiş olabilir)
    }

    // 4. Database'de is_active'i false yap (soft delete)
    const { data: updatedImage, error: updateError } = await supabase
      .from("profile_images")
      .update({ is_active: false })
      .eq("id", imageId)
      .select()
      .single();

    if (updateError) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Resim silinemedi",
        updateError.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Pet resmi başarıyla silindi",
      image: updatedImage,
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

router.post("/pet/vaccination", verifyToken, async (req, res) => {
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

module.exports = router;
