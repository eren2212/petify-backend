const express = require("express");
const supabase = require("../database/supabase");
const Response = require("../lib/Response");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const Enum = require("../config/Enum");

/**
 * @route POST /api/conversations/start
 * @desc Get existing conversation or create new one
 */
router.post("/start", verifyToken, async (req, res) => {
  const { target_role_id } = req.body;

  // User's own role_id from middleware (assumes req.user is populated properly in auth middleware)
  // We need to fetch the role_id of the current user based on their user_id.
  // Assuming the user might have selected a role or simply using their default role.
  // For safety, let's look it up or rely on what's passed if we trust the client (not ideal).
  // Ideally, req.user would have metadata including the active role or we fetch it.

  // Let's first get the sender's role id from the user_id
  const userId = req.user.id;
  const { data: userRoleData, error: userRoleError } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (userRoleError || !userRoleData) {
    const errorResponse = Response.errorResponse(
      Enum.HTTP_CODES.BAD_REQUEST,
      "Kullanıcı rolü bulunamadı.",
    );
    return res.status(errorResponse.code).json(errorResponse);
  }

  const sender_role_id = userRoleData.id;

  if (sender_role_id === target_role_id) {
    const errorResponse = Response.errorResponse(
      Enum.HTTP_CODES.BAD_REQUEST,
      "Kendinizle konuşma başlatamazsınız.",
    );
    return res.status(errorResponse.code).json(errorResponse);
  }

  try {
    // 1. Check if conversation exists
    // We look for a conversation where both match.
    // Since we store participant_1 < participant_2 for uniqueness (constraint unique_conversation),
    // we should sort them first.

    const [p1, p2] = [sender_role_id, target_role_id].sort();

    const { data: existingConvo, error: findError } = await supabase
      .from("conversations")
      .select("id")
      .eq("participant_1_role_id", p1)
      .eq("participant_2_role_id", p2)
      .single();

    if (existingConvo) {
      // Conversation exists
      const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
        conversation_id: existingConvo.id,
        is_new: false,
      });

      return res.status(successResponse.code).json(successResponse);
    }

    // 2. Create new conversation
    const { data: newConvo, error: createError } = await supabase
      .from("conversations")
      .insert([
        {
          participant_1_role_id: p1,
          participant_2_role_id: p2,
          is_active: true,
        },
      ])
      .select()
      .single();

    if (createError) throw createError;

    // 3. Add participants to conversation_participants table
    // (Although the participants are in the conversations table, the separate table is likely for
    // metadata like is_deleted, last_read_at per user).
    // Let's add them.
    const { error: participantsError } = await supabase
      .from("conversation_participants")
      .insert([
        { conversation_id: newConvo.id, participant_role_id: p1 },
        { conversation_id: newConvo.id, participant_role_id: p2 },
      ]);

    if (participantsError) {
      console.error("Error adding participants:", participantsError);
      // Clean up conversation?
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.OK, {
      message: "Konuşma başarıyla başlatıldı",
      conversation_id: newConvo.id,
      is_new: true,
    });

    return res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(error);
    return res.status(errorResponse.code).json(errorResponse);
  }
});

module.exports = router;
