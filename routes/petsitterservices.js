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
 * @route GET /petsitterservices/categories
 * @desc Pet sitter service categories
 * @access Private
 */

router.get("/categories", verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("pet_sitter_service_categories")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Pet sitter service categories not found",
        error.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Pet sitter service categories fetched successfully",
      data: data,
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route GET /petsitterservices/my-services
 * @desc Pet sitter services get
 * @access Private
 */

router.get("/my-services", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page, limit, categoryId, status } = req.query;

    const { data: UserRoleData, error: UserRoleError } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role_type", "pet_sitter")
      .eq("status", "approved")
      .single();

    if (UserRoleError || !UserRoleData) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "User role not found",
        "User does not have an approved pet sitter role"
      );
    }
    const userRoleId = UserRoleData.id;

    const { data: petSitterProfileData, error: PetSitterProfileError } =
      await supabase
        .from("pet_sitter_profiles")
        .select("id")
        .eq("user_role_id", userRoleId)
        .single();

    if (PetSitterProfileError || !petSitterProfileData.id) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Pet sitter profile not found",
        "User does not have a pet sitter profile"
      );
    }
    const petSitterProfileId = petSitterProfileData.id;

    let query = supabase
      .from("pet_sitter_services")
      .select(
        `"*", pet_sitter_service_categories!inner(name, name_tr,icon_url), pet_types!inner(name, name_tr)`
      )
      .eq("pet_sitter_profile_id", petSitterProfileId);

    // Apply category filter if provided
    if (categoryId) {
      query = query.eq("service_category_id", categoryId);
    }

    if (status !== undefined && status !== null && status !== "") {
      const isActive = status === "true" || status === true;
      query = query.eq("is_active", isActive);
    }

    const { data: petSitterServicesData, error: PetSitterServicesError } =
      await query
        .order("created_at", { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

    if (PetSitterServicesError) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Pet sitter services not found",
        "User does not have any pet sitter services"
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Pet sitter services fetched successfully",
      data: petSitterServicesData,
      total: petSitterServicesData.length,
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route POST /petsitterservices/add-service
 * @desc Pet sitter service creation
 * @access Private
 */

router.post("/add-service", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { service_category_id, pet_type_id, price_type, price, description } =
      req.body;

    const { data: UserRoleData, error: UserRoleError } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role_type", "pet_sitter")
      .eq("status", "approved")
      .single();

    if (UserRoleError || !UserRoleData) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "User role not found",
        "User does not have an approved pet sitter role"
      );
    }
    const userRoleId = UserRoleData.id;

    const { data: petSitterProfileData, error: PetSitterProfileError } =
      await supabase
        .from("pet_sitter_profiles")
        .select("id")
        .eq("user_role_id", userRoleId)
        .single();

    if (PetSitterProfileError || !petSitterProfileData?.id) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Pet sitter profile not found",
        "User does not have a pet sitter profile"
      );
    }
    const petSitterProfileId = petSitterProfileData.id;

    const newService = {
      pet_sitter_profile_id: petSitterProfileId,
      service_category_id: service_category_id,
      pet_type_id: pet_type_id,
      price_type: price_type,
      price: price,
      description: description,
      is_active: true,
    };

    const { data: newServiceData, error: newServiceError } = await supabase
      .from("pet_sitter_services")
      .insert(newService)
      .select()
      .single();

    if (newServiceError) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Pet sitter service creation failed",
        newServiceError.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.CREATED, {
      message: "Pet sitter service created successfully",
      data: newServiceData,
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route PUT /petsitterservices/update-service/:id
 * @desc Pet sitter service update
 * @access Private
 */

router.put("/update-service/:id", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { service_category_id, pet_type_id, price_type, price, description } =
      req.body;

    const { data: UserRoleData, error: UserRoleError } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role_type", "pet_sitter")
      .eq("status", "approved")
      .single();

    if (UserRoleError || !UserRoleData) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "User role not found",
        "User does not have an approved pet sitter role"
      );
    }
    const userRoleId = UserRoleData.id;

    const { data: petSitterProfileData, error: PetSitterProfileError } =
      await supabase
        .from("pet_sitter_profiles")
        .select("id")
        .eq("user_role_id", userRoleId)
        .single();

    if (PetSitterProfileError || !petSitterProfileData.id) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Pet sitter profile not found",
        "User does not have a pet sitter profile"
      );
    }
    const petSitterProfileId = petSitterProfileData.id;

    const updateService = {
      service_category_id: service_category_id,
      pet_type_id: pet_type_id,
      price_type: price_type,
      price: price,
      description: description,
    };

    const { data: petServiceUpdateData, error: petServiceUpdateError } =
      await supabase
        .from("pet_sitter_services")
        .update(updateService)
        .eq("id", id)
        .eq("pet_sitter_profile_id", petSitterProfileId)
        .select()
        .single();

    if (petServiceUpdateError) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Pet sitter service update failed",
        petServiceUpdateError.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Pet sitter service updated successfully",
      data: petServiceUpdateData,
    });
    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route GET /petsitterservices/service/:id
 * @desc Pet sitter service get by id
 * @access Private
 */

router.get("/service/:id", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { data: UserRoleData, error: UserRoleError } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role_type", "pet_sitter")
      .eq("status", "approved")
      .single();

    if (UserRoleError || !UserRoleData) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "User role not found",
        "User does not have an approved pet sitter role"
      );
    }
    const userRoleId = UserRoleData.id;

    const { data: petSitterProfileData, error: PetSitterProfileError } =
      await supabase
        .from("pet_sitter_profiles")
        .select("id")
        .eq("user_role_id", userRoleId)
        .single();

    if (PetSitterProfileError || !petSitterProfileData.id) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Pet sitter profile not found",
        "User does not have a pet sitter profile"
      );
    }
    const petSitterProfileId = petSitterProfileData.id;

    const { data: petServiceData, error: petServiceError } = await supabase
      .from("pet_sitter_services")
      .select(
        `"*", pet_sitter_service_categories!inner(name, name_tr,icon_url), pet_types!inner(name, name_tr)`
      )
      .eq("id", id)
      .eq("pet_sitter_profile_id", petSitterProfileId)
      .single();

    if (petServiceError) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Pet sitter service not found",
        "Pet sitter service not found"
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Pet sitter service fetched successfully",
      data: petServiceData,
    });
    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route DELETE /petsitterservices/service/:id
 * @desc Pet sitter service delete
 * @access Private
 */

router.delete("/service/:id", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { data: UserRoleData, error: UserRoleError } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role_type", "pet_sitter")
      .eq("status", "approved")
      .single();

    if (UserRoleError || !UserRoleData) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "User role not found",
        "User does not have an approved pet sitter role"
      );
    }
    const userRoleId = UserRoleData.id;

    const { data: petSitterProfileData, error: PetSitterProfileError } =
      await supabase
        .from("pet_sitter_profiles")
        .select("id")
        .eq("user_role_id", userRoleId)
        .single();

    if (PetSitterProfileError || !petSitterProfileData.id) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Pet sitter profile not found",
        "User does not have a pet sitter profile"
      );
    }
    const petSitterProfileId = petSitterProfileData.id;

    const { data: petServiceDeleteData, error: petServiceDeleteError } =
      await supabase
        .from("pet_sitter_services")
        .delete()
        .eq("id", id)
        .eq("pet_sitter_profile_id", petSitterProfileId)
        .select()
        .single();

    if (petServiceDeleteError) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Pet sitter service delete failed",
        petServiceDeleteError.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Pet sitter service deleted successfully",
      data: petServiceDeleteData,
    });
    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/*veri tabanından service fotoğrafı getirme endpointi*/

/**
 * @route GET /products/image/:filename
 * @desc Product image download
 * @access Public (herkes görebilir)
 */
router.get("/category-icon/:filename", async (req, res) => {
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
      .from("category-icons")
      .download(filename);

    if (error || !data) {
      throw new CustomError(
        Enum.HTTP_CODES.NOT_FOUND,
        "Category icon not found",
        "İstenen category icon bulunamadı."
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
 * @route PATCH /petsitterservices/toggle-status/:id
 * @desc Pet sitter service status toggle
 * @access Private
 */
router.patch("/toggle-status/:id", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { status } = req.body;

    const { data: UserRoleData, error: UserRoleError } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role_type", "pet_sitter")
      .eq("status", "approved")
      .single();

    if (UserRoleError || !UserRoleData) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "User role not found",
        "User does not have an approved pet sitter role"
      );
    }
    const userRoleId = UserRoleData.id;

    const { data: petSitterProfileData, error: PetSitterProfileError } =
      await supabase
        .from("pet_sitter_profiles")
        .select("id")
        .eq("user_role_id", userRoleId)
        .single();

    if (PetSitterProfileError || !petSitterProfileData.id) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Pet sitter profile not found",
        "User does not have a pet sitter profile"
      );
    }
    const petSitterProfileId = petSitterProfileData.id;

    const { data: petServiceData, error: petServiceError } = await supabase
      .from("pet_sitter_services")
      .update({
        is_active: status,
      })
      .eq("id", id)
      .eq("pet_sitter_profile_id", petSitterProfileId)
      .select()
      .single();

    if (petServiceError) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Pet sitter service status update failed",
        petServiceError.message
      );
    }
    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Pet sitter service status updated successfully",
      data: petServiceData,
    });
    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});
module.exports = router;
