var express = require("express");
var supabase = require("../database/supabase");
var Response = require("../lib/Response");
var CustomError = require("../lib/Error");
var Enum = require("../config/Enum");
var { verifyToken } = require("../middleware/auth");
var router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     LoginRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *         - roleType
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: "user@example.com"
 *         password:
 *           type: string
 *           minLength: 6
 *           example: "password123"
 *         roleType:
 *           type: string
 *           enum: [pet_owner, pet_shop, pet_clinic, pet_sitter, pet_hotel]
 *           example: "pet_owner"
 *     RegisterRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *         - fullName
 *         - roleType
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: "user@example.com"
 *         password:
 *           type: string
 *           minLength: 6
 *           example: "password123"
 *         fullName:
 *           type: string
 *           example: "John Doe"
 *         phone:
 *           type: string
 *           example: "+90 555 123 45 67"
 *         roleType:
 *           type: string
 *           enum: [pet_owner, pet_shop, pet_clinic, pet_sitter, pet_hotel]
 *           example: "pet_owner"
 *     AuthResponse:
 *       type: object
 *       properties:
 *         code:
 *           type: integer
 *           example: 200
 *         data:
 *           type: object
 *           properties:
 *             user:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 email:
 *                   type: string
 *                 user_metadata:
 *                   type: object
 *             session:
 *               type: object
 *               properties:
 *                 access_token:
 *                   type: string
 *                 refresh_token:
 *                   type: string
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     description: Create a new user account with Supabase Auth
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Invalid input or user already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/register", async function (req, res, next) {
  try {
    const { email, password, fullName, phone, roleType } = req.body;

    // Validation
    if (!email || !password || !fullName || !roleType) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Eksik alanlar",
        "E-posta, şifre, ad soyad ve rol tipi alanları zorunludur."
      );
    }

    if (password.length < 6) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Şifre çok kısa",
        "Şifre en az 6 karakter uzunluğunda olmalıdır."
      );
    }

    // Role validation
    const validRoles = [
      "pet_owner",
      "pet_shop",
      "pet_clinic",
      "pet_sitter",
      "pet_hotel",
    ];
    if (!validRoles.includes(roleType)) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Geçersiz rol tipi",
        "Rol tipi şunlardan biri olmalıdır: " + validRoles.join(", ")
      );
    }

    // Register with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone || null,
        },
      },
    });

    if (error) {
      // Check for specific Supabase error codes
      let errorMessage =
        "Kayıt işlemi başarısız oldu. Lütfen tekrar deneyiniz.";

      if (
        error.message.includes("already registered") ||
        error.message.includes("already been registered")
      ) {
        errorMessage =
          "Bu e-posta adresi zaten kayıtlı. Lütfen giriş yapmayı deneyin veya şifrenizi sıfırlayın.";
      } else if (
        error.message.includes("invalid email") ||
        error.message.includes("email")
      ) {
        errorMessage =
          "Geçersiz e-posta adresi. Lütfen geçerli bir e-posta adresi giriniz.";
      } else if (error.message.includes("password")) {
        errorMessage =
          "Şifre gereksinimleri karşılanmıyor. Lütfen daha güçlü bir şifre seçiniz.";
      }

      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Kayıt başarısız",
        errorMessage
      );
    }

    // Check if user was actually created or if it's an existing unconfirmed user
    if (!data.user || !data.user.id) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Kayıt başarısız",
        "Kullanıcı hesabı oluşturulamadı. Bu e-posta adresi zaten kayıtlı olabilir."
      );
    }

    // Check if this is an existing user who hasn't confirmed their email
    // Supabase returns a user but with identities array empty for unconfirmed re-registrations
    if (
      data.user &&
      data.user.identities &&
      data.user.identities.length === 0
    ) {
      // User exists but hasn't confirmed their email
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "E-posta onayı bekleniyor",
        "Bu e-posta adresiyle daha önce kayıt olunmuş ancak e-posta onaylanmamış. Lütfen e-posta adresinizi kontrol ederek hesabınızı onaylayın. Onay e-postası tekrar gönderildi."
      );
    }

    // If user created successfully, create user profile and role records
    if (data.user) {
      // First create user profile
      const { error: profileError } = await supabase
        .from("user_profiles")
        .insert([
          {
            user_id: data.user.id,
            full_name: fullName,
            phone_number: phone || null,
          },
        ]);

      if (profileError) {
        console.error("Failed to create user profile:", profileError);

        // Check if it's a duplicate user error (user already exists)
        if (
          profileError.code === "23505" ||
          profileError.message.includes("duplicate")
        ) {
          throw new CustomError(
            Enum.HTTP_CODES.BAD_REQUEST,
            "E-posta zaten kayıtlı",
            "Bu e-posta adresi zaten kayıtlı. Lütfen farklı bir e-posta adresi deneyiniz."
          );
        }

        throw new CustomError(
          Enum.HTTP_CODES.INT_SERVER_ERROR,
          "Profil oluşturma başarısız",
          "Kullanıcı profili oluşturulurken bir hata oluştu. Lütfen tekrar deneyiniz."
        );
      }

      // Then create user role record
      const roleStatus = roleType === "pet_owner" ? "approved" : "pending";

      const { error: roleError } = await supabase.from("user_roles").insert([
        {
          user_id: data.user.id,
          role_type: roleType,
          status: roleStatus,
        },
      ]);

      if (roleError) {
        console.error("Failed to create user role:", roleError);
        throw new CustomError(
          Enum.HTTP_CODES.INT_SERVER_ERROR,
          "Rol oluşturma başarısız",
          "Kullanıcı rolü oluşturulurken bir hata oluştu. Lütfen tekrar deneyiniz."
        );
      }
    }

    // Create appropriate message based on role status
    const roleStatus = roleType === "pet_owner" ? "approved" : "pending";
    const statusMessage =
      roleStatus === "approved"
        ? "Kayıt başarılı! Artık giriş yapabilirsiniz."
        : "Kayıt başarılı! Hesabınız yönetici onayı bekliyor. Lütfen e-posta adresinizi kontrol ederek hesabınızı onaylayın.";

    const response = Response.successResponse(Enum.HTTP_CODES.CREATED, {
      user: data.user,
      session: data.session,
      roleStatus: roleStatus,
      message: statusMessage,
    });

    res.status(response.code).json(response);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login user
 *     description: Authenticate user with email and password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/login", async function (req, res, next) {
  try {
    const { email, password, roleType } = req.body;

    if (!email || !password || !roleType) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Eksik bilgiler",
        "E-posta, şifre ve rol tipi alanları zorunludur."
      );
    }

    // Role validation
    const validRoles = [
      "pet_owner",
      "pet_shop",
      "pet_clinic",
      "pet_sitter",
      "pet_hotel",
    ];
    if (!validRoles.includes(roleType)) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Geçersiz rol tipi",
        "Rol tipi şunlardan biri olmalıdır: " + validRoles.join(", ")
      );
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Handle specific login errors with Turkish messages
      let errorMessage =
        "Giriş başarısız. Lütfen bilgilerinizi kontrol ediniz.";

      if (
        error.message.includes("Invalid login credentials") ||
        error.message.includes("Invalid")
      ) {
        errorMessage = "E-posta veya şifre hatalı. Lütfen tekrar deneyiniz.";
      } else if (error.message.includes("Email not confirmed")) {
        errorMessage =
          "E-posta adresiniz henüz onaylanmamış. Lütfen e-posta adresinizi kontrol ederek hesabınızı onaylayın.";
      } else if (error.message.includes("User not found")) {
        errorMessage =
          "Bu e-posta adresiyle kayıtlı bir kullanıcı bulunamadı. Lütfen önce kayıt olun.";
      }

      throw new CustomError(
        Enum.HTTP_CODES.UNAUTHORIZED,
        "Giriş başarısız",
        errorMessage
      );
    }

    // Check if user has the requested role
    const { data: userRole, error: roleError } = await supabase
      .from("user_roles")
      .select("*")
      .eq("user_id", data.user.id)
      .eq("role_type", roleType)
      .eq("status", "approved")
      .single();

    if (roleError || !userRole) {
      // Check if user has the role but it's pending
      const { data: pendingRole } = await supabase
        .from("user_roles")
        .select("*")
        .eq("user_id", data.user.id)
        .eq("role_type", roleType)
        .eq("status", "pending")
        .single();

      const roleNames = {
        pet_owner: "Evcil Hayvan Sahibi",
        pet_shop: "Pet Shop",
        pet_clinic: "Veteriner Kliniği",
        pet_sitter: "Evcil Hayvan Bakıcısı",
        pet_hotel: "Evcil Hayvan Oteli",
      };

      const roleName = roleNames[roleType] || roleType;

      const errorMessage = pendingRole
        ? `${roleName} rolünüz yönetici onayı bekliyor. Hesabınız onaylandıktan sonra giriş yapabilirsiniz.`
        : `${roleName} rolüne sahip değilsiniz. Lütfen doğru rol tipiyle kayıt olun veya farklı bir rol seçin.`;

      throw new CustomError(
        Enum.HTTP_CODES.UNAUTHORIZED,
        "Erişim reddedildi",
        errorMessage
      );
    }

    const response = Response.successResponse(Enum.HTTP_CODES.OK, {
      user: data.user,
      session: data.session,
      userRole: userRole,
      message: "Giriş başarılı!",
    });

    res.status(response.code).json(response);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout user
 *     description: Sign out the current user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 */
router.post("/logout", verifyToken, async function (req, res, next) {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Çıkış başarısız",
        "Çıkış yapılırken bir hata oluştu. Lütfen tekrar deneyiniz."
      );
    }

    const response = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Çıkış başarılı!",
    });

    res.status(response.code).json(response);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current user
 *     description: Get the authenticated user's information
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/me", verifyToken, function (req, res, next) {
  try {
    const response = Response.successResponse(Enum.HTTP_CODES.OK, {
      user: req.user,
      message: "Kullanıcı bilgileri başarıyla alındı.",
    });

    res.status(response.code).json(response);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     description: Refresh the access token using refresh token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refresh_token
 *             properties:
 *               refresh_token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 */
router.post("/refresh", async function (req, res, next) {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Token gerekli",
        "Lütfen geçerli bir yenileme token'ı sağlayın."
      );
    }

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token,
    });

    if (error) {
      let errorMessage =
        "Token yenileme başarısız oldu. Lütfen tekrar giriş yapın.";

      if (
        error.message.includes("Invalid Refresh Token") ||
        error.message.includes("expired")
      ) {
        errorMessage = "Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.";
      }

      throw new CustomError(
        Enum.HTTP_CODES.UNAUTHORIZED,
        "Token yenileme başarısız",
        errorMessage
      );
    }

    const response = Response.successResponse(Enum.HTTP_CODES.OK, {
      user: data.user,
      session: data.session,
      message: "Token başarıyla yenilendi.",
    });

    res.status(response.code).json(response);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

module.exports = router;
