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
 * @route GET /products/categories
 * @desc Product categories
 * @access Private
 */

router.get("/categories", verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("product_categories")
      .select("*")
      .order("display_order");

    if (error) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Categoride bir hata oluştu",
        error.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Başarılı bir şekilde kategoriler getirildi",
      data: data || [],
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route POST /products/add
 * @desc Product creation
 * @access Private
 */
router.post("/add", verifyToken, async (req, res) => {
  try {
    const {
      categoryId,
      petTypeId,
      name,
      description,
      price,
      weight_kg,
      age_group,
      stock_quantity,
      low_stock_threshold,
    } = req.body;
    const userId = req.user.id;

    const { data, error } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role_type", "pet_shop")
      .eq("status", "approved")
      .single();

    if (error || !data) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Role not found",
        "User does not have a role to add products"
      );
    }

    const userRoleId = data.id;
    const { data: petShopProfileData, error: petShopProfileError } =
      await supabase
        .from("pet_shop_profiles")
        .select("id")
        .eq("user_role_id", userRoleId)
        .single();

    if (petShopProfileError || !petShopProfileData) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Pet shop profile not found",
        "User does not have a pet shop profile to add products"
      );
    }
    const petShopProfileId = petShopProfileData.id;

    const newProduct = {
      pet_shop_profile_id: petShopProfileId,
      category_id: categoryId,
      pet_type_id: petTypeId,
      name,
      description,
      price,
      weight_kg,
      age_group,
      stock_quantity,
      low_stock_threshold,
      is_active: true,
    };

    const { data: productData, error: productError } = await supabase
      .from("products")
      .insert(newProduct)
      .select("*")
      .single();

    if (productError || !productData) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Product creation failed",
        productError.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.CREATED, {
      message: "Product created successfully",
      product: productData,
    });
    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route POST /products/:id
 * @desc Product update
 * @access Private
 */
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      categoryId,
      petTypeId,
      name,
      description,
      price,
      weight_kg,
      age_group,
      stock_quantity,
      low_stock_threshold,
    } = req.body;
    const userId = req.user.id;

    const { data: productData, error: productError } = await supabase
      .from("products")
      .update({
        category_id: categoryId,
        pet_type_id: petTypeId,
        name,
        description,
        price,
        weight_kg,
        age_group,
        stock_quantity,
        low_stock_threshold,
      })
      .eq("id", id)
      .select(
        `
    *,
    category:product_categories(id, name, name_tr),
    pet_type:pet_types(id, name, name_tr)
  `
      )
      .single();

    if (productError || !productData) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Product update failed",
        productError.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Product updated successfully",
      product: productData,
    });
    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route POST /products/{id}/stock-update
 * @desc Product stock update
 * @access Private
 */

router.patch("/:id/stock-update", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { stock_quantity } = req.body;

    const { data: productData, error: productError } = await supabase
      .from("products")
      .update({
        stock_quantity: stock_quantity,
      })
      .eq("id", id)
      .select()
      .single();

    if (productError || !productData) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Product stock update failed",
        productError.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Product stock updated successfully",
      product: productData,
    });
    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route POST /products/{id}/status
 * @desc Product status update
 * @access Private
 */
router.patch("/:id/status", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const userId = req.user.id;

    const { data: productData, error: productError } = await supabase
      .from("products")
      .update({
        is_active: status,
      })
      .eq("id", id)
      .select()
      .single();

    if (productError || !productData) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Product status update failed",
        productError.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Product status updated successfully",
      product: productData,
    });
    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route DELETE  /products/{id}
 * @desc Product delete
 * @access Private
 */

router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { data: productData, error: productError } = await supabase
      .from("products")
      .delete()
      .eq("id", id)
      .select()
      .single();

    if (productError || !productData) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Product delete failed",
        productError.message
      );
    }

    const { data: imageData, error: imageError } = await supabase.storage
      .from("products")
      .remove([productData.image_url]);

    if (imageError) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Product image delete failed",
        imageError.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Product deleted successfully",
      product: productData,
      image: imageData,
    });
    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route GET /products
 * @desc Products get
 * @access Private
 */

router.get("/", verifyToken, async (req, res) => {
  try {
    const { page, limit } = req.query;
    const userId = req.user.id;

    const { data, error } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role_type", "pet_shop")
      .eq("status", "approved")
      .single();

    if (error || !data) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Role not found",
        "User does not have a role to add products"
      );
    }

    const userRoleId = data.id;

    const { data: petShopProfileData, error: petShopProfileError } =
      await supabase
        .from("pet_shop_profiles")
        .select("id")
        .eq("user_role_id", userRoleId)
        .single();

    if (petShopProfileError || !petShopProfileData) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Pet shop profile not found",
        "User does not have a pet shop profile to add products"
      );
    }
    const petShopProfileId = petShopProfileData.id;

    const { data: productsData, error: productsError } = await supabase
      .from("products")
      .select("*")
      .eq("pet_shop_profile_id", petShopProfileId)
      .order("created_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    if (productsError || !productsData) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Products get failed",
        productsError.message
      );
    }
    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Products get successfully",
      products: productsData,
      total_count: productsData.length,
    });
    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route GET /products/all
 * @desc Products get
 * @access Public all
 */

router.get("/all", verifyToken, async (req, res) => {
  const { page, limit } = req.query;

  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Ürünler görüntülenemedi",
        error.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Ürünler başarılı bir şekilde görüntülendi",
      data: data,
    });
    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});
/**
 * @route GET /products/category/{categoryName}
 * @desc Products by category name
 * @access Public
 */
router.get("/category/:categoryName", async (req, res) => {
  try {
    const { categoryName } = req.params;
    const { page, limit } = req.query;
    const { data: productsData, error: productsError } = await supabase
      .from("products")
      .select("*")
      .eq("category_id", categoryName)
      .order("created_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (productsError || !productsData) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Products by category name get failed",
        productsError.message
      );
    }
    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Products by category name get successfully",
      products: productsData,
      total_count: productsData.length,
    });
    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route GET /products/{id}
 * @desc Product get by id
 * @access Public
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { data: productData, error: productError } = await supabase
      .from("products")
      .select(
        "*, category:product_categories(id, name, name_tr), pet_type:pet_types(id, name, name_tr)"
      )
      .eq("id", id)
      .single();
    if (productError || !productData) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Product get by id failed",
        productError.message
      );
    }
    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Product get by id successfully",
      product: productData,
    });
    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route POST /products/image
 * @desc Product image upload
 * @access Private
 */
/**
 * @route POST /products/image/:id
 * @desc Upload image for a specific product
 * @access Private (Only Product Owner)
 */
router.post(
  "/image/:id", // <-- URL artık ID alıyor
  verifyToken,
  upload.single("products"),
  async (req, res) => {
    try {
      const { id: productId } = req.params; // URL'den ürün ID'sini al

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

      // 2. Kullanıcının yetkisini ve ürünün sahibi olup olmadığını kontrol et
      // (Join işlemi ile hem rolü hem de ürünün kime ait olduğunu tek sorguda çözebiliriz
      // ama senin yapına sadık kalarak adım adım gidelim)

      // A. Kullanıcının PetShop Rolünü Bul
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .eq("role_type", "pet_shop")
        .eq("status", "approved")
        .single();

      if (roleError || !roleData) {
        throw new CustomError(
          Enum.HTTP_CODES.FORBIDDEN,
          "Yetkisiz işlem",
          "Bu işlemi yapmak için onaylı bir mağaza hesabınız olmalı."
        );
      }

      // B. PetShop Profil ID'sini Bul
      const { data: petShopProfile, error: profileError } = await supabase
        .from("pet_shop_profiles")
        .select("id")
        .eq("user_role_id", roleData.id)
        .single();

      if (profileError || !petShopProfile) {
        throw new CustomError(
          Enum.HTTP_CODES.INT_SERVER_ERROR,
          "Profil hatası",
          "Mağaza profili bulunamadı."
        );
      }

      // C. Ürünü Bul ve SAHİPLİĞİNİ Kontrol Et
      // (Ürün var mı? Ve bu ürün bu mağazaya mı ait?)
      const { data: currentProduct, error: productError } = await supabase
        .from("products")
        .select("id, image_url")
        .eq("id", productId)
        .eq("pet_shop_profile_id", petShopProfile.id) // <-- GÜVENLİK KONTROLÜ BURASI
        .single();

      if (productError || !currentProduct) {
        throw new CustomError(
          Enum.HTTP_CODES.NOT_FOUND,
          "Ürün bulunamadı veya yetkisiz erişim",
          "Güncellenmek istenen ürün bulunamadı veya bu ürünü düzenleme yetkiniz yok."
        );
      }

      // 3. Eski resmi sil (Eğer varsa)
      if (currentProduct.image_url) {
        const oldFileName = currentProduct.image_url;
        // Hata alsa bile devam etsin, belki dosya zaten storage'da yoktur ama DB'de yazıyordur.
        const { error: deleteError } = await supabase.storage
          .from("products")
          .remove([oldFileName]);

        if (deleteError)
          console.log("Eski resim silinirken uyarı:", deleteError.message);
      }

      // 4. Yeni resmi Storage'a yükle
      const timestamp = Date.now();
      // Dosya ismini random yapmak her zaman daha iyidir, çakışmayı önler
      const fileExtension = file.originalname.split(".").pop();
      const fileName = `product-${productId}-${timestamp}.${fileExtension}`;

      const { error: uploadError } = await supabase.storage
        .from("products")
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw new CustomError(
          Enum.HTTP_CODES.INT_SERVER_ERROR,
          "Resim yükleme başarısız",
          uploadError.message
        );
      }

      // 5. Database'i güncelle (Sadece o ürünün satırını)
      const { data: updateData, error: updateError } = await supabase
        .from("products")
        .update({ image_url: fileName })
        .eq("id", productId) // <-- ARTIK SADECE BU ID GÜNCELLENİYOR
        .select()
        .single();

      if (updateError) {
        // DB güncellenemezse yüklenen resmi geri sil (Temizlik)
        await supabase.storage.from("products").remove([fileName]);

        throw new CustomError(
          Enum.HTTP_CODES.INT_SERVER_ERROR,
          "Veritabanı güncelleme başarısız",
          updateError.message
        );
      }

      const response = Response.successResponse(Enum.HTTP_CODES.OK, {
        message: "Ürün resmi başarıyla güncellendi",
        image_path: fileName,
        product: updateData,
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
      .from("products")
      .download(filename);

    if (error || !data) {
      throw new CustomError(
        Enum.HTTP_CODES.NOT_FOUND,
        "Product image not found",
        "İstenen product image bulunamadı."
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
