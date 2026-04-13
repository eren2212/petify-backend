const cron = require("node-cron");
const supabase = require("../database/supabase");
const NotificationService = require("../lib/notification");

/**
 * Yarın vadesi gelen aşıları bulup sahiplerine push bildirim gönderir.
 * Test etmek için bu fonksiyonu direkt çağırabilirsin:
 *   node -e "require('./jobs/vaccinationReminder').sendVaccinationReminders()"
 */
async function sendVaccinationReminders() {
  console.log("🔔 Aşı hatırlatıcı job başlatıldı...");

  // Yarının tarihini YYYY-MM-DD formatında hesapla
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  console.log(`📅 Kontrol edilen tarih: ${tomorrowStr}`);

  // Adım 1: Yarın vadesi gelen aktif aşıları ve pet bilgisini çek
  // pets tablosu pet_vaccinations.pet_id FK'si üzerinden join edilir
  const { data: vaccinations, error: vaccinationError } = await supabase
    .from("pet_vaccinations")
    .select(
      `
      id,
      vaccine_name,
      next_due_date,
      pet_id,
      pets!inner(
        name,
        user_id
      )
    `,
    )
    .eq("next_due_date", tomorrowStr)
    .eq("is_active", true);

  if (vaccinationError) {
    console.error("❌ Aşı sorgusu hatası:", vaccinationError.message);
    return;
  }

  if (!vaccinations || vaccinations.length === 0) {
    console.log(`ℹ️ ${tomorrowStr} tarihinde vadesi gelen aşı yok.`);
    return;
  }

  console.log(`📋 ${vaccinations.length} adet aşı hatırlatıcısı gönderilecek.`);

  // Adım 2: Unique user_id'leri topla
  const userIds = [
    ...new Set(vaccinations.map((v) => v.pets?.user_id).filter(Boolean)),
  ];

  // Adım 3: Bu kullanıcıların push token ve isimlerini çek
  const { data: profiles, error: profileError } = await supabase
    .from("user_profiles")
    .select("user_id, push_token, full_name")
    .in("user_id", userIds)
    .not("push_token", "is", null);

  if (profileError) {
    console.error("❌ Profil sorgusu hatası:", profileError.message);
    return;
  }

  if (!profiles || profiles.length === 0) {
    console.log("ℹ️ Push token'ı kayıtlı kullanıcı bulunamadı.");
    return;
  }

  // user_id → profil map'i oluştur (O(1) erişim için)
  const profileMap = Object.fromEntries(profiles.map((p) => [p.user_id, p]));

  // Adım 4: Her aşı için ilgili kullanıcıya bildirim gönder
  let successCount = 0;
  let skipCount = 0;

  for (const vaccination of vaccinations) {
    const userId = vaccination.pets?.user_id;
    const profile = profileMap[userId];

    if (!profile?.push_token) {
      skipCount++;
      continue;
    }

    const petName = vaccination.pets?.name ?? "Evcil hayvanınız";
    const vaccineName = vaccination.vaccine_name;

    const notificationResult = await NotificationService.sendPushNotification(
      [profile.push_token],
      "💉 Aşı Hatırlatıcı",
      `${petName} için ${vaccineName} aşısının zamanı yarın!`,
      {
        type: "VACCINATION_REMINDER",
        pet_id: vaccination.pet_id,
        vaccination_id: vaccination.id,
        pet_name: petName,
        vaccine_name: vaccineName,
      },
    );

    if (notificationResult) {
      successCount++;
      console.log(
        `✅ Bildirim → ${profile.full_name} | ${petName} | ${vaccineName}`,
      );
    }
  }

  console.log(
    `🏁 Tamamlandı: ${successCount} bildirim gönderildi, ${skipCount} kullanıcı atlandı (token yok).`,
  );
}

/**
 * Cron job'u başlatır ve uygulama ayaktayken her gün 09:00'da tetiklenir.
 * app.js'den çağrılır.
 */
function startVaccinationReminderJob() {
  // Her gün 09:00 TR saatinde çalışır
  // Format: saniye dakika saat gün ay haftagünü
  // */5 * * * *
  cron.schedule(
    "0 9 * * *",
    () => {
      sendVaccinationReminders().catch((err) =>
        console.error("❌ Vaccination reminder job kritik hata:", err),
      );
    },
    {
      timezone: "Europe/Istanbul",
    },
  );

  console.log("⏰ Aşı hatırlatıcı job kayıt edildi (Her gün 09:00 - TR saati)");
}

module.exports = { startVaccinationReminderJob, sendVaccinationReminders };
