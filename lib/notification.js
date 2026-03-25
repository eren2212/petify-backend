const admin = require("firebase-admin");
const serviceAccount = require("../petify-bildirim-firebase.json");

// Firebase'i modül yüklendiğinde başlat (constructor'da değil!)
// Bu olmazsa static metodlar çağrıldığında Firebase initialized olmaz.
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("🔥 Firebase Admin SDK başarıyla bağlandı!");
  } catch (error) {
    console.error("❌ Firebase başlatma hatası:", error);
  }
}

class NotificationService {
  /**
   * Expo Push Token'larına bildirim gönderir.
   *
   * Frontend expo-notifications ile üretilen token format:
   *   ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
   *
   * Bu tokenlar Firebase Admin SDK ile değil, Expo'nun kendi push servisi
   * üzerinden gönderilmeli. Expo servisi arkada FCM/APNs'e iletir.
   *
   * @param {string[]} tokens  - Expo push token dizisi
   * @param {string} title     - Bildirim başlığı
   * @param {string} body      - Bildirim içeriği
   * @param {object} data      - Ek veri (deep link vs.)
   */
  static async sendPushNotification(tokens, title, body, data = {}) {
    if (!tokens || tokens.length === 0) {
      console.log("⚠️ Bildirim gönderilmedi: Token listesi boş.");
      return null;
    }

    // Geçerli Expo tokenlarını filtrele
    const validTokens = tokens.filter(
      (t) => t && typeof t === "string" && t.startsWith("ExponentPushToken")
    );

    if (validTokens.length === 0) {
      console.log("⚠️ Geçerli Expo push token bulunamadı.");
      return null;
    }

    // data objesi içindeki tüm değerleri string'e çevir (Expo zorunluluğu)
    const stringData = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v)])
    );

    // Expo push mesaj formatı
    const messages = validTokens.map((token) => ({
      to: token,
      title: title,
      body: body,
      data: stringData,
      sound: "default",
      channelId: "messages", // Android notification channel
      priority: "high",
    }));

    try {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        throw new Error(`Expo Push API HTTP hatası: ${response.status}`);
      }

      const result = await response.json();

      let successCount = 0;
      let failureCount = 0;

      if (result.data) {
        result.data.forEach((ticket, idx) => {
          if (ticket.status === "ok") {
            successCount++;
          } else {
            failureCount++;
            console.error(
              `❌ Token hatası (${idx}): [${ticket.details?.error}] ${ticket.message}`
            );
          }
        });
      }

      console.log(`✅ Expo Push Tamamlandı | Başarılı: ${successCount} | Başarısız: ${failureCount}`);
      return result;
    } catch (error) {
      console.error("❌ Expo Push gönderim hatası:", error);
      return null;
    }
  }
}

// --- TEST KISMI ---
// Terminal'den direkt çalıştırıldığında test yapar: node api/lib/notification.js
// Başka dosyadan require edildiğinde bu blok çalışmaz.
if (require.main === module) {
  console.log("🛠️ Test modu başlatılıyor...");

  // TEST TOKEN NEREDEN ALINIR?
  // 1. Uygulamayı fiziksel bir cihazda çalıştır (Expo Go veya dev build)
  // 2. AuthProvider mount olduğunda useNotifications hook'u çalışır
  // 3. Console'da şunu görürsün: "✅ Push Token alındı: ExponentPushToken[xxx]"
  // 4. O token'ı aşağıya yapıştır ve test et.
  //
  // Alternatif: Supabase'den DB'ye kaydedilmiş token'ı çek:
  //   SELECT push_token FROM user_profiles WHERE push_token IS NOT NULL LIMIT 1;
  const testTokens = [
    // "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
  ];

  NotificationService.sendPushNotification(
    testTokens,
    "Petify Test 🐾",
    "Bildirim sistemi çalışıyor!",
    { type: "TEST", screen: "home" }
  ).then((result) => {
    console.log("Test sonucu:", result);
  });
}

module.exports = NotificationService;
