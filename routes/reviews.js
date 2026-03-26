const express = require("express");
const supabase = require("../database/supabase");
const Response = require("../lib/Response");
const CustomError = require("../lib/Error");
const Enum = require("../config/Enum");
const { verifyToken } = require("../middleware/auth");
const router = express.Router();

const VALID_REVIEW_TYPES = [
  "pet_shop",
  "product",
  "pet_sitter",
  "pet_clinic",
  "pet_hotel",
];

// ─────────────────────────────────────────────────────────────────────────────
// GET /reviews/bulk-stats/:reviewType?ids=id1,id2,id3
// Birden fazla hedef için ortalama puan ve yorum sayısını döner.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/bulk-stats/:reviewType", verifyToken, async (req, res) => {
  try {
    const { reviewType } = req.params;
    const idsParam = req.query.ids;

    if (!VALID_REVIEW_TYPES.includes(reviewType)) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Geçersiz yorum tipi",
        `review_type şunlardan biri olmalı: ${VALID_REVIEW_TYPES.join(", ")}`
      );
    }

    if (!idsParam) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Eksik parametre",
        "ids sorgu parametresi zorunludur."
      );
    }

    const ids = idsParam
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 50); // max 50 ID

    if (ids.length === 0) {
      return res
        .status(200)
        .json(Response.successResponse(Enum.HTTP_CODES.OK, { data: {} }));
    }

    const { data: statsData, error } = await supabase
      .from("reviews")
      .select("target_id, rating")
      .eq("review_type", reviewType)
      .eq("status", "approved")
      .in("target_id", ids);

    if (error) throw error;

    // Her ID için aggregate hesapla
    const result = {};
    ids.forEach((id) => (result[id] = { average: 0, total: 0 }));

    statsData?.forEach(({ target_id, rating }) => {
      if (result[target_id]) {
        result[target_id].total += 1;
        result[target_id].average += rating;
      }
    });

    Object.keys(result).forEach((id) => {
      const r = result[id];
      r.average =
        r.total > 0 ? parseFloat((r.average / r.total).toFixed(1)) : 0;
    });

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      data: result,
    });
    return res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    return res.status(errorResponse.code).json(errorResponse);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /reviews/:reviewType/:targetId
// Bir hedefe ait onaylanmış yorumları, istatistiklerle birlikte getirir.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/:reviewType/:targetId", verifyToken, async (req, res) => {
  try {
    const { reviewType, targetId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    if (!VALID_REVIEW_TYPES.includes(reviewType)) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Geçersiz yorum tipi",
        `review_type şunlardan biri olmalı: ${VALID_REVIEW_TYPES.join(", ")}`
      );
    }

    // Onaylanmış yorumları + profil bilgisini + cevapları çek
    const { data: reviews, error, count } = await supabase
      .from("reviews")
      .select(
        `
        id,
        rating,
        comment,
        created_at,
        reviewer_user_id,
        user_profiles!reviewer_user_id (
          full_name,
          avatar_url
        ),
        review_replies (
          id,
          reply_text,
          created_at,
          status,
          user_roles!replier_role_id (
            role_type,
            user_profiles!user_id (
              full_name,
              avatar_url
            )
          )
        )
      `,
        { count: "exact" }
      )
      .eq("review_type", reviewType)
      .eq("target_id", targetId)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // İstatistikleri hesapla (tüm onaylı yorumlar üzerinden)
    const { data: statsData } = await supabase
      .from("reviews")
      .select("rating")
      .eq("review_type", reviewType)
      .eq("target_id", targetId)
      .eq("status", "approved");

    const totalReviews = statsData?.length || 0;
    const avgRating =
      totalReviews > 0
        ? statsData.reduce((sum, r) => sum + r.rating, 0) / totalReviews
        : 0;

    // 1-5 yıldız dağılımı
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    statsData?.forEach((r) => {
      distribution[r.rating] = (distribution[r.rating] || 0) + 1;
    });

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      reviews: reviews || [],
      stats: {
        total: totalReviews,
        average: parseFloat(avgRating.toFixed(1)),
        distribution,
      },
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });

    return res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    return res.status(errorResponse.code).json(errorResponse);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /reviews
// Yeni yorum oluştur (status = pending, admin onayı bekler)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/", verifyToken, async (req, res) => {
  try {
    const { review_type, target_id, rating, comment } = req.body;
    const userId = req.user.id;

    if (!review_type || !target_id || !rating || !comment) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Eksik alan",
        "review_type, target_id, rating ve comment zorunludur."
      );
    }

    if (!VALID_REVIEW_TYPES.includes(review_type)) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Geçersiz yorum tipi",
        `review_type şunlardan biri olmalı: ${VALID_REVIEW_TYPES.join(", ")}`
      );
    }

    if (rating < 1 || rating > 5 || !Number.isInteger(Number(rating))) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Geçersiz puan",
        "rating 1 ile 5 arasında tam sayı olmalıdır."
      );
    }

    if (comment.trim().length < 5) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Yorum çok kısa",
        "Yorum en az 5 karakter olmalıdır."
      );
    }

    const { data, error } = await supabase
      .from("reviews")
      .insert({
        review_type,
        target_id,
        reviewer_user_id: userId,
        rating: Number(rating),
        comment: comment.trim(),
        status: "pending",
      })
      .select()
      .single();

    if (error) throw error;

    const successResponse = Response.successResponse(Enum.HTTP_CODES.CREATED, {
      message: "Yorumunuz alındı, onay sürecindedir.",
      review: data,
    });

    return res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    return res.status(errorResponse.code).json(errorResponse);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /reviews/:reviewId
// Kendi yorumunu sil
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/:reviewId", verifyToken, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user.id;

    // Yorumun bu kullanıcıya ait olup olmadığını kontrol et
    const { data: review, error: fetchError } = await supabase
      .from("reviews")
      .select("id, reviewer_user_id")
      .eq("id", reviewId)
      .single();

    if (fetchError || !review) {
      throw new CustomError(
        Enum.HTTP_CODES.NOT_FOUND,
        "Yorum bulunamadı",
        "İstenen yorum mevcut değil."
      );
    }

    if (review.reviewer_user_id !== userId) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Yetki hatası",
        "Bu yorumu silme yetkiniz yok."
      );
    }

    const { error } = await supabase
      .from("reviews")
      .delete()
      .eq("id", reviewId);

    if (error) throw error;

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Yorum başarıyla silindi.",
    });

    return res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    return res.status(errorResponse.code).json(errorResponse);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /reviews/:reviewId/reply
// Yoruma cevap ver (herkes cevap verebilir, replier_role_id = user'ın aktif rolü)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:reviewId/reply", verifyToken, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { reply_text, role_type } = req.body;
    const userId = req.user.id;

    if (!reply_text || reply_text.trim().length < 2) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Cevap çok kısa",
        "Cevap en az 2 karakter olmalıdır."
      );
    }

    // Yorum var mı kontrol et
    const { data: review, error: reviewError } = await supabase
      .from("reviews")
      .select("id, status")
      .eq("id", reviewId)
      .single();

    if (reviewError || !review) {
      throw new CustomError(
        Enum.HTTP_CODES.NOT_FOUND,
        "Yorum bulunamadı",
        "Cevap verilecek yorum mevcut değil."
      );
    }

    // Kullanıcının aktif rolünü bul (role_type verilmişse ona göre, yoksa ilki)
    let roleQuery = supabase
      .from("user_roles")
      .select("id, role_type")
      .eq("user_id", userId);

    if (role_type) {
      roleQuery = roleQuery.eq("role_type", role_type);
    }

    const { data: userRole, error: roleError } = await roleQuery
      .limit(1)
      .single();

    if (roleError || !userRole) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Rol bulunamadı",
        "Cevap verebilmek için aktif bir rol gereklidir."
      );
    }

    const { data, error } = await supabase
      .from("review_replies")
      .insert({
        review_id: reviewId,
        replier_role_id: userRole.id,
        reply_text: reply_text.trim(),
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      // Unique constraint ihlali — zaten cevap vermiş
      if (error.code === "23505") {
        throw new CustomError(
          Enum.HTTP_CODES.BAD_REQUEST,
          "Zaten cevap verildi",
          "Bu yoruma zaten cevap verdiniz."
        );
      }
      throw error;
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.CREATED, {
      message: "Cevabınız alındı, onay sürecindedir.",
      reply: data,
    });

    return res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    return res.status(errorResponse.code).json(errorResponse);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /reviews/:reviewId/reply/:replyId
// Kendi cevabını sil
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/:reviewId/reply/:replyId", verifyToken, async (req, res) => {
  try {
    const { replyId } = req.params;
    const userId = req.user.id;

    // Cevabı getir ve replier'ın bu kullanıcı olup olmadığını kontrol et
    const { data: reply, error: fetchError } = await supabase
      .from("review_replies")
      .select("id, replier_role_id, user_roles!replier_role_id(user_id)")
      .eq("id", replyId)
      .single();

    if (fetchError || !reply) {
      throw new CustomError(
        Enum.HTTP_CODES.NOT_FOUND,
        "Cevap bulunamadı",
        "İstenen cevap mevcut değil."
      );
    }

    if (reply.user_roles?.user_id !== userId) {
      throw new CustomError(
        Enum.HTTP_CODES.FORBIDDEN,
        "Yetki hatası",
        "Bu cevabı silme yetkiniz yok."
      );
    }

    const { error } = await supabase
      .from("review_replies")
      .delete()
      .eq("id", replyId);

    if (error) throw error;

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Cevap başarıyla silindi.",
    });

    return res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    return res.status(errorResponse.code).json(errorResponse);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /reviews/:reviewId/report
// Yorumu şikayet et
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:reviewId/report", verifyToken, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { reason, description } = req.body;
    const userId = req.user.id;

    if (!reason) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Sebep zorunlu",
        "Şikayet için bir sebep belirtmelisiniz."
      );
    }

    // Yorum var mı kontrol et
    const { data: review, error: reviewError } = await supabase
      .from("reviews")
      .select("id, reviewer_user_id")
      .eq("id", reviewId)
      .single();

    if (reviewError || !review) {
      throw new CustomError(
        Enum.HTTP_CODES.NOT_FOUND,
        "Yorum bulunamadı",
        "Şikayet edilecek yorum mevcut değil."
      );
    }

    if (review.reviewer_user_id === userId) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Geçersiz işlem",
        "Kendi yorumunuzu şikayet edemezsiniz."
      );
    }

    const { data, error } = await supabase
      .from("review_reports")
      .insert({
        review_id: reviewId,
        reporter_user_id: userId,
        reason,
        description: description?.trim() || null,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new CustomError(
          Enum.HTTP_CODES.BAD_REQUEST,
          "Zaten şikayet edildi",
          "Bu yorumu zaten şikayet ettiniz."
        );
      }
      throw error;
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.CREATED, {
      message: "Şikayetiniz alındı, incelenecektir.",
      report: data,
    });

    return res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    return res.status(errorResponse.code).json(errorResponse);
  }
});

module.exports = router;
