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

module.exports = router;
