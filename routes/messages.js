const express = require("express");
const supabase = require("../database/supabase");
const Response = require("../lib/Response");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const NotificationService = require("../lib/notification");
const Enum = require("../config/Enum");

router.post("/send", verifyToken, async (req, res) => {
  const {
    conversation_id,
    sender_role_id,
    content,
    image_url,
    location_name,
    location_latitude,
    location_longitude,
  } = req.body;

  try {
    // 0. Message Type Belirleme
    let message_type = "text";
    if (image_url) message_type = "image";
    else if (location_latitude && location_longitude) message_type = "location";

    // 1. Mesajı Kaydet
    const { data: messageData, error: messageError } = await supabase
      .from("messages")
      .insert([
        {
          conversation_id,
          sender_role_id,
          content,
          image_url,
          location_name,
          location_latitude,
          location_longitude,
          message_type,
        },
      ])
      .select()
      .single();

    if (messageError) throw messageError;

    // 2. Conversation Tablosunu Güncelle (Last Message)
    // Supabase trigger'ı olsa bile backend tarafında bunu garantiye almak iyidir.
    let lastMessageContent = content;
    if (message_type === "image") lastMessageContent = "📷 Fotoğraf";
    else if (message_type === "location") lastMessageContent = "📍 Konum";

    const { error: conversationError } = await supabase
      .from("conversations")
      .update({
        last_message_content: lastMessageContent,
        last_message_at: new Date().toISOString(),
        last_message_sender_role_id: sender_role_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversation_id);

    if (conversationError) {
      console.error("Conversation update error:", conversationError);
      // Mesaj gitti ama conversation güncellenemedi, bu kritik bir hata değil, devam edebiliriz.
    }

    // 3. Karşı tarafa bildirim gönder (Opsiyonel / Asenkron)
    // Conversation participants'dan diğer kişiyi bul
    setImmediate(async () => {
      try {
        const { data: participants } = await supabase
          .from("conversation_participants")
          .select(
            "participant_role_id, user_roles(user_id, user_profiles(push_token))",
          )
          .eq("conversation_id", conversation_id)
          .neq("participant_role_id", sender_role_id); // Gönderen hariç

        if (participants && participants.length > 0) {
          const tokens = participants
            .map((p) => p.user_roles?.user_profiles?.push_token)
            .filter((t) => t); // Null olmayanlar

          if (tokens.length > 0) {
            await NotificationService.sendPushNotification(
              tokens,
              "Yeni Mesaj",
              lastMessageContent,
              { conversation_id: conversation_id, type: "NEW_MESSAGE" },
            );
          }
        }
      } catch (notifError) {
        console.error("Notification logic error:", notifError);
      }
    });

    const successResponse = Response.successResponse(
      Enum.HTTP_CODES.OK,
      messageData,
    );
    return res.status(successResponse.code).json(successResponse);
  } catch (error) {
    const errorResponse = Response.errorResponse(
      Enum.HTTP_CODES.INTERNAL_SERVER_ERROR,
      error,
    );
    return res.status(errorResponse.code).json(errorResponse);
  }
});

module.exports = router;
