const express = require("express");
const multer = require("multer");
const supabase = require("../database/supabase");
const Response = require("../lib/Response");
const CustomError = require("../lib/Error");
const Enum = require("../config/Enum");
const { verifyToken } = require("../middleware/auth");
const router = express.Router();

/**
 * @route GET /petotelservices/categories
 * @desc Pet hotel services categories
 * @access Private
 */

router.get("/categories", verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("pet_hotel_service_categories")
      .select("*")
      .order("name", { ascending: true });
    if (error) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Pet hotel services categories not found",
        error.message
      );
    }
    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Pet hotel services categories fetched successfully",
      data: data,
    });
    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route POST /petotelservices/add
 * @desc Pet hotel services creation
 * @access Private
 */

router.post("/add", verifyToken, async (req, res) => {
  try {
    const { category_id } = req.body;

    const userId = req.user.id;

    const { data, error } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role_type", "pet_hotel")
      .eq("status", "approved")
      .single();

    if (error || !data) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Role not found",
        "User does not have a role to add services"
      );
    }

    const userRoleId = data.id;
    const { data: petHotelProfileData, error: petHotelProfileError } =
      await supabase
        .from("pet_hotel_profiles")
        .select("id")
        .eq("user_role_id", userRoleId)
        .single();

    if (petHotelProfileError || !petHotelProfileData) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Pet hotel profile not found",
        "User does not have a pet hotel profile to add services"
      );
    }
    const petHotelProfileId = petHotelProfileData.id;

    const newService = {
      pet_hotel_profile_id: petHotelProfileId,
      service_category_id: category_id,
    };
    const { data: newServiceData, error: newServiceError } = await supabase
      .from("pet_hotel_services")
      .insert(newService)
      .select()
      .single();

    if (newServiceError) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Pet hotel service creation failed",
        newServiceError.message
      );
    }
    const successResponse = Response.successResponse(Enum.HTTP_CODES.CREATED, {
      message: "Pet hotel service created successfully",
      data: newServiceData,
    });
    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route GET /petotelservices/services
 * @desc Pet hotel services
 * @access Private
 */

router.get("/my-services", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role_type", "pet_hotel")
      .eq("status", "approved")
      .single();

    if (error || !data) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Role not found",
        "User does not have a role to add services"
      );
    }

    const userRoleId = data.id;
    const { data: petHotelProfileData, error: petHotelProfileError } =
      await supabase
        .from("pet_hotel_profiles")
        .select("id")
        .eq("user_role_id", userRoleId)
        .single();

    if (petHotelProfileError || !petHotelProfileData) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Pet hotel profile not found",
        "User does not have a pet hotel profile to add services"
      );
    }
    const petHotelProfileId = petHotelProfileData.id;

    const { data: servicesData, error: servicesError } = await supabase
      .from("pet_hotel_services")
      .select(
        "*, pet_hotel_service_categories!inner(name, name_tr,icon_url,description)"
      )
      .eq("pet_hotel_profile_id", petHotelProfileId)
      .order("created_at", { ascending: false });

    if (servicesError) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Pet hotel services not found",
        servicesError.message
      );
    }
    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Pet hotel services fetched successfully",
      data: servicesData,
      total: servicesData.length,
    });
    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route GET /petotelservices/service/:id
 * @desc Pet hotel service get by id
 * @access Private
 */

router.get("/service/:id", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { data, error } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role_type", "pet_hotel")
      .eq("status", "approved")
      .single();

    if (error || !data) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Role not found",
        "User does not have a role to add services"
      );
    }

    const userRoleId = data.id;
    const { data: petHotelProfileData, error: petHotelProfileError } =
      await supabase
        .from("pet_hotel_profiles")
        .select("id")
        .eq("user_role_id", userRoleId)
        .single();

    if (petHotelProfileError || !petHotelProfileData) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Pet hotel profile not found",
        "User does not have a pet hotel profile to add services"
      );
    }
    const petHotelProfileId = petHotelProfileData.id;

    const { data: serviceData, error: serviceError } = await supabase
      .from("pet_hotel_services")
      .select("*, pet_hotel_service_categories!inner(name, name_tr)")
      .eq("id", id)
      .eq("pet_hotel_profile_id", petHotelProfileId)
      .single();
    if (serviceError) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Pet hotel service not found",
        serviceError.message
      );
    }
    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Pet hotel service fetched successfully",
      data: serviceData,
    });
    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route PATCH /petotelservices/toggle-status/:id
 * @desc Pet hotel service update
 * @access Private
 */

router.patch("/toggle-status/:id", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { status } = req.body;

    const { data, error } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role_type", "pet_hotel")
      .eq("status", "approved")
      .single();
    if (error || !data) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Role not found",
        "User does not have a role to add services"
      );
    }

    const userRoleId = data.id;
    const { data: petHotelProfileData, error: petHotelProfileError } =
      await supabase
        .from("pet_hotel_profiles")
        .select("id")
        .eq("user_role_id", userRoleId)
        .single();

    if (petHotelProfileError || !petHotelProfileData) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Pet hotel profile not found",
        "User does not have a pet hotel profile to add services"
      );
    }
    const petHotelProfileId = petHotelProfileData.id;

    const { data: serviceData, error: serviceError } = await supabase
      .from("pet_hotel_services")
      .update({ is_active: status })
      .eq("id", id)
      .eq("pet_hotel_profile_id", petHotelProfileId)
      .select()
      .single();

    if (serviceError) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Pet hotel service update failed",
        serviceError.message
      );
    }
    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Pet hotel service updated successfully",
      data: serviceData,
    });
    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route DELETE /petotelservices/service/:id
 * @desc Pet hotel service delete
 * @access Private
 */

router.delete("/service/:id", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { data, error } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role_type", "pet_hotel")
      .eq("status", "approved")
      .single();
    if (error || !data) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Role not found",
        "User does not have a role to add services"
      );
    }
    const userRoleId = data.id;
    const { data: petHotelProfileData, error: petHotelProfileError } =
      await supabase
        .from("pet_hotel_profiles")
        .select("id")
        .eq("user_role_id", userRoleId)
        .single();

    if (petHotelProfileError || !petHotelProfileData) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Pet hotel profile not found",
        "User does not have a pet hotel profile to add services"
      );
    }
    const petHotelProfileId = petHotelProfileData.id;
    const { data: serviceData, error: serviceError } = await supabase
      .from("pet_hotel_services")
      .delete()
      .eq("id", id)
      .eq("pet_hotel_profile_id", petHotelProfileId)
      .select()
      .single();
    if (serviceError) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Pet hotel service delete failed",
        serviceError.message
      );
    }
    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Pet hotel service deleted successfully",
      data: serviceData,
    });
    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @route GET /petotelservices/image/:filename
 * @desc Pet hotel service image download
 * @access Public
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
      .download(`petotel/${filename}`);

    if (error || !data) {
      throw new CustomError(
        Enum.HTTP_CODES.NOT_FOUND,
        "Pet hotel service image not found",
        "İstenen pet hotel service image bulunamadı."
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
