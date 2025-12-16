const express = require("express");
const supabase = require("../database/supabase");
const Response = require("../lib/Response");
const CustomError = require("../lib/Error");
const Enum = require("../config/Enum");
const { verifyToken } = require("../middleware/auth");
const router = express.Router();

/**
 * @route POST /petclinicdoctors/add
 * @desc Pet clinic doctor creation
 * @access Private
 */
router.post("/add", verifyToken, async (req, res) => {
  try {
    const { first_name, last_name, specialization, experience_years, bio } =
      req.body;

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
