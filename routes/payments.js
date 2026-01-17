const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const iyzico = require("../config/iyzicoConfig");
const supabase = require("../database/supabase");

// --- 1. ENDPOINT: ÖDEME BAŞLAT ---
router.post("/initialize", async (req, res) => {
  try {
    console.log("🔵 Payment initialize isteği alındı:", req.body);
    const { userId, orderIds, userAddress, userContact } = req.body;

    // Validasyon
    if (
      !userId ||
      !orderIds ||
      !Array.isArray(orderIds) ||
      orderIds.length === 0
    ) {
      return res.status(400).json({
        error: "Eksik veya geçersiz parametreler",
        details: "userId ve orderIds (dizi) gereklidir",
      });
    }

    const conversationId = uuidv4();
    // DİKKAT: Ngrok veya canlı domain adresi şart
    const callbackUrl = `${process.env.PUBLIC_URL}/api/payments/callback`;

    // ADIM 1: Veritabanından Siparişleri Çek ve Tutarları Hesapla
    // Frontend'e güvenmiyoruz, fiyatları DB'den doğruluyoruz.
    console.log("📊 Orders sorgulanıyor, orderIds:", orderIds);
    const { data: orders, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .in("id", orderIds);

    console.log("📦 Orders sonucu:", { orders, error: orderError });

    if (orderError) {
      console.error("❌ Order Query Error:", orderError);
      return res
        .status(500)
        .json({ error: "Veritabanı hatası", details: orderError.message });
    }

    if (!orders || orders.length === 0) {
      return res.status(404).json({ error: "Sipariş bulunamadı!" });
    }

    // Tutarları topla
    let calculatedSubtotal = 0;
    let calculatedDeliveryFees = 0;
    let calculatedTotalAmount = 0;

    orders.forEach((order) => {
      calculatedSubtotal += parseFloat(order.subtotal);
      calculatedDeliveryFees += parseFloat(order.delivery_fee || 0); // Orders tablosunda 'delivery_fee' (tekil)
      calculatedTotalAmount += parseFloat(order.total_amount);
    });

    // ADIM 2: Payments Tablosuna Kayıt At (Senin Şemana Göre)
    const paymentData = {
      user_id: userId,
      order_ids: orderIds,
      subtotal: calculatedSubtotal,
      delivery_fees: calculatedDeliveryFees, // Payments tablosunda 'delivery_fees' (çoğul)
      total_amount: calculatedTotalAmount,
      payment_status: "pending",
      payment_method: "credit_card", // iyzico için default credit_card
      iyzico_conversation_id: conversationId,
      currency: "TRY",
    };
    console.log("💳 Payment kaydı oluşturuluyor:", paymentData);

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .insert(paymentData)
      .select()
      .single();

    console.log("💳 Payment sonucu:", { payment, error: paymentError });

    if (paymentError) {
      console.error("❌ DB Insert Error:", paymentError);
      return res
        .status(400)
        .json({ error: "Ödeme kaydı oluşturulamadı", details: paymentError });
    }

    // ADIM 3: Order Items Çek (iyzico sepeti için)
    // Tüm siparişlerin altındaki ürünleri tek bir listede topluyoruz
    console.log("🛒 Order items sorgulanıyor, orderIds:", orderIds);
    const { data: allOrderItems, error: itemsError } = await supabase
      .from("order_items")
      .select("*")
      .in("order_id", orderIds);

    console.log("🛒 Order items sonucu:", { allOrderItems, error: itemsError });

    if (itemsError) {
      console.error("❌ Order Items Query Error:", itemsError);
      return res.status(500).json({
        error: "Sipariş ürünleri alınamadı",
        details: itemsError.message,
      });
    }

    if (!allOrderItems || allOrderItems.length === 0) {
      console.error("❌ Sepet boş!");
      return res
        .status(400)
        .json({ error: "Sepet boş! En az bir ürün olmalı." });
    }

    // iyzico formatına çevir
    const formattedBasketItems = allOrderItems.map((item) => ({
      id: String(item.product_id), // Ürün ID
      name: item.product_name,
      category1: "PetShop",
      itemType: "PHYSICAL", // iyzipay enum değerleri string olarak kullanılır
      price: parseFloat(item.line_total).toFixed(2), // iyzico item bazlı toplam fiyat ister
    }));

    // Kargo ücreti varsa basketItems'a ekle
    if (calculatedDeliveryFees > 0) {
      formattedBasketItems.push({
        id: "DELIVERY_FEE",
        name: "Kargo Ücreti",
        category1: "Kargo",
        itemType: "PHYSICAL",
        price: parseFloat(calculatedDeliveryFees).toFixed(2),
      });
    }

    console.log("🛍️ Formatted basket items:", formattedBasketItems);
    console.log(
      "💰 Basket items toplamı:",
      formattedBasketItems.reduce(
        (sum, item) => sum + parseFloat(item.price),
        0,
      ),
    );

    // ADIM 4: iyzico Request Hazırla
    const request = {
      locale: "tr", // iyzipay enum değerleri string olarak kullanılır
      conversationId: conversationId,
      price: calculatedTotalAmount.toFixed(2), // Sepet tutarı
      paidPrice: calculatedTotalAmount.toFixed(2), // Ödenen tutar (indirim yoksa aynı)
      currency: "TRY", // iyzipay enum değerleri string olarak kullanılır
      basketId: String(payment.payment_token), // Senin DB'nin ürettiği unique token
      paymentGroup: "PRODUCT", // iyzipay enum değerleri string olarak kullanılır
      callbackUrl: callbackUrl,

      buyer: {
        id: String(userId),
        name: userContact?.name || "Misafir",
        surname: userContact?.surname || "Kullanıcı",
        gsmNumber: userContact?.phone || "+905555555555",
        email: userContact?.email || "email@email.com",
        identityNumber: "11111111111",
        registrationAddress: userAddress || "Adres",
        city: "Istanbul",
        country: "Turkey",
        ip: req.ip,
      },
      shippingAddress: {
        contactName: userContact?.name || "Misafir",
        city: "Istanbul",
        country: "Turkey",
        address: userAddress || "Adres",
        zipCode: "34732",
      },
      billingAddress: {
        contactName: userContact?.name || "Misafir",
        city: "Istanbul",
        country: "Turkey",
        address: userAddress || "Adres",
        zipCode: "34732",
      },
      basketItems: formattedBasketItems,
    };

    // ADIM 5: iyzico Başlat
    console.log("💰 iyzico'ya istek gönderiliyor...");
    console.log("📦 Request summary:", {
      price: request.price,
      paidPrice: request.paidPrice,
      basketItems: request.basketItems,
      basketItemsTotal: request.basketItems
        .reduce((sum, item) => sum + parseFloat(item.price), 0)
        .toFixed(2),
    });

    iyzico.checkoutFormInitialize.create(request, async (err, result) => {
      if (err) {
        console.error("❌ iyzico bağlantı hatası:", err);
        return res
          .status(500)
          .json({ error: "iyzico bağlantı hatası", details: err });
      }

      console.log("💰 iyzico yanıtı:", result);

      if (result.status !== "success") {
        console.error("❌ iyzico Error:", result.errorMessage);
        return res.status(400).json({ error: result.errorMessage });
      }

      // ADIM 6: iyzico Token'ı DB'ye Kaydet
      await supabase
        .from("payments")
        .update({ iyzico_token: result.token }) // Schema: iyzico_token
        .eq("id", payment.id);

      // React Native'e dön - paymentPageUrl kullan (WebView için en iyi)
      res.json({
        status: "success",
        paymentPageUrl: result.paymentPageUrl, // Direkt yüklenebilir URL
        htmlContent: result.checkoutFormContent,
        token: result.token,
      });
    });
  } catch (error) {
    console.error("❌ Server Error:", error);
    console.error("Error Stack:", error.stack);
    res.status(500).json({
      error: "Sunucu hatası",
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

// --- 2. ENDPOINT: CALLBACK (GÜNCELLENMİŞ) ---
router.post("/callback", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).send("Token yok!");
    }

    iyzico.checkoutForm.retrieve({ token }, async (err, result) => {
      if (err) {
        console.error("iyzico retrieve error:", err);
        return res.status(500).send("iyzico hatası");
      }

      const isSuccess = result.paymentStatus === "SUCCESS";

      // Senin enumlarına uygun status belirleyelim
      // payments tablosu için: 'success' | 'failed'
      const newPaymentStatus = isSuccess ? "success" : "failed";

      // Kart bilgileri (varsa)
      const cardInfo = result.cardType
        ? {
            card_last_four: result.binNumber
              ? result.binNumber.slice(-4)
              : null,
            card_type: result.cardType,
          }
        : {};

      // ADIM 1: Payments Tablosunu Güncelle (Senin şemana tam uygun)
      const { data: payment, error: updateError } = await supabase
        .from("payments")
        .update({
          payment_status: newPaymentStatus,
          iyzico_status: result.status,
          iyzico_payment_status: result.paymentStatus,
          iyzico_payment_id: result.paymentId,
          iyzico_fraud_status: result.fraudStatus,
          iyzico_error_code: result.errorCode || null,
          iyzico_error_message: result.errorMessage || null,
          installment: result.installment || 1,
          ...cardInfo,
          paid_at: isSuccess ? new Date() : null,
          updated_at: new Date(),
        })
        .eq("iyzico_token", token)
        .select()
        .single();

      if (updateError) {
        console.error("Payment update error:", updateError);
      }

      // ADIM 2: Orders Tablosunu Güncelle
      if (isSuccess && payment) {
        // Ödeme başarılıysa sipariş durumunu 'paid' olarak güncelle
        // Enum: 'pending' | 'paid' | 'preparing' | 'ready' | 'completed' | 'cancelled'
        const { error: orderUpdateError } = await supabase
          .from("orders")
          .update({ status: "paid" }) // Ödeme alındı
          .in("id", payment.order_ids);

        if (orderUpdateError) {
          console.error("Order status update error:", orderUpdateError);
        }
      }

      // Frontend için HTML - WebView'ın success durumunu algılaması için URL değişikliği
      console.log("🎯 Payment Callback Result:", {
        isSuccess,
        paymentStatus: result.paymentStatus,
      });

      const htmlResponse = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: ${isSuccess ? "#f0fff4" : "#fff5f5"};
            }
            .icon { font-size: 64px; margin-bottom: 20px; }
            h1 { color: ${isSuccess ? "#22c55e" : "#ef4444"}; margin: 0 0 10px 0; }
            p { color: #666; margin: 0; }
          </style>
        </head>
        <body>
          <div class="icon">${isSuccess ? "✅" : "❌"}</div>
          <h1>${isSuccess ? "Ödeme Başarılı!" : "Ödeme Başarısız"}</h1>
          <p>${isSuccess ? "Siparişiniz alındı." : "Lütfen tekrar deneyin."}</p>
          <script>
            // WebView'ın bu değişikliği algılaması için URL'e success parametresi ekle
            window.paymentSuccess = ${isSuccess};
            // 1 saniye sonra URL değiştir (WebView navigation event tetikler)
            setTimeout(() => {
              window.location.href = '${process.env.PUBLIC_URL}/api/payments/result?success=${isSuccess}';
            }, 1500);
          </script>
        </body>
        </html>
      `;
      res.send(htmlResponse);
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Hata");
  }
});

// --- 3. ENDPOINT: RESULT (WebView redirect için) ---
router.get("/result", (req, res) => {
  const { success } = req.query;
  const isSuccess = success === "true";

  console.log("📱 Payment Result Page:", { success, isSuccess });

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: ${isSuccess ? "#f0fff4" : "#fff5f5"};
        }
        .icon { font-size: 80px; margin-bottom: 20px; }
        h1 { color: ${isSuccess ? "#22c55e" : "#ef4444"}; margin: 0 0 10px 0; font-size: 24px; }
        p { color: #666; margin: 0; font-size: 16px; }
      </style>
    </head>
    <body>
      <div class="icon">${isSuccess ? "✅" : "❌"}</div>
      <h1>${isSuccess ? "Ödeme Başarılı!" : "Ödeme Başarısız"}</h1>
      <p>${isSuccess ? "Siparişiniz alındı." : "Lütfen tekrar deneyin."}</p>
    </body>
    </html>
  `);
});

module.exports = router;
