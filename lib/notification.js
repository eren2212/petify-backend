const admin = require("firebase-admin");

class NotificationService {
  constructor() {
    // Singleton pattern or check if initialized
    if (!admin.apps.length) {
      // NOT: Burayı kendi firebase-adminsdk.json dosyanın yoluna göre güncellemelisin
      // Veya environment variable kullanabilirsin.
      // admin.initializeApp({
      //   credential: admin.credential.cert(serviceAccount)
      // });
      console.log(
        "Firebase Admin SDK not initialized correctly yet. Place your logic here.",
      );
    }
  }

  /**
   * Send a push notification to specific tokens
   * @param {string[]} tokens - Array of FCM tokens
   * @param {string} title - Notification Title
   * @param {string} body - Notification Body
   * @param {object} data - Custom data payload (optional)
   */
  static async sendPushNotification(tokens, title, body, data = {}) {
    if (!tokens || tokens.length === 0) return;

    const message = {
      notification: {
        title,
        body,
      },
      data,
      tokens,
    };

    try {
      // const response = await admin.messaging().sendMulticast(message);
      // console.log(response.successCount + ' messages were sent successfully');

      console.log(`[MOCK] Notification Sent to ${tokens.length} devices.`);
      console.log(`Title: ${title}, Body: ${body}`);
    } catch (error) {
      console.error("Error sending notification:", error);
    }
  }
}

module.exports = NotificationService;
