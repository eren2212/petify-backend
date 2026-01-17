const express = require("express");
const router = express.Router();
const supabase = require("../database/supabase");
const Response = require("../lib/Response");
const CustomError = require("../lib/Error");
const Enum = require("../config/Enum");
const { verifyToken } = require("../middleware/auth");

/**
 * Helper: Order number generator
 * Format: ORD-YYYY-TIMESTAMP-RRRR
 */
function generateOrderNumber() {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-6); // Son 6 digit timestamp
  const randomNum = Math.floor(Math.random() * 9999) + 1; // 1-9999 arası
  const paddedNum = String(randomNum).padStart(4, "0");
  return `ORD-${year}-${timestamp}-${paddedNum}`;
}

/**
 * @route POST /api/orders/create
 * @desc Sepetten sipariş oluştur
 * @access Private
 * @body { userId, cartItems: [{ id, name, price, quantity, shopId }], deliveryType, address }
 */
router.post("/create", verifyToken, async (req, res) => {
  try {
    const { userId, cartItems, deliveryType, address } = req.body;

    // Validasyon
    if (
      !userId ||
      !cartItems ||
      !Array.isArray(cartItems) ||
      cartItems.length === 0
    ) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Eksik veya geçersiz parametreler",
        "userId ve cartItems (dizi) gereklidir",
      );
    }

    if (!deliveryType || !["delivery", "pickup"].includes(deliveryType)) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Geçersiz teslimat tipi",
        "deliveryType 'delivery' veya 'pickup' olmalıdır",
      );
    }

    if (deliveryType === "delivery" && !address) {
      throw new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Adres gerekli",
        "Teslimat tipi 'delivery' ise adres zorunludur",
      );
    }

    // Sabit kargo ücreti
    const DELIVERY_FEE = deliveryType === "delivery" ? 10 : 0;

    // Sepet ürünlerini shop bazında grupla
    const groupedByShop = {};

    for (const item of cartItems) {
      // Ürün bilgilerini veritabanından çek (güvenlik için)
      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("id, name, price, pet_shop_profile_id, stock_quantity")
        .eq("id", item.id)
        .eq("is_active", true)
        .single();

      if (productError || !productData) {
        throw new CustomError(
          Enum.HTTP_CODES.NOT_FOUND,
          `Ürün bulunamadı: ${item.name}`,
          productError?.message || "Ürün mevcut değil veya aktif değil",
        );
      }

      // Stok kontrolü
      if (productData.stock_quantity < item.quantity) {
        throw new CustomError(
          Enum.HTTP_CODES.BAD_REQUEST,
          `Yetersiz stok: ${productData.name}`,
          `Stokta sadece ${productData.stock_quantity} adet var`,
        );
      }

      const shopId = productData.pet_shop_profile_id;

      if (!groupedByShop[shopId]) {
        groupedByShop[shopId] = [];
      }

      groupedByShop[shopId].push({
        productId: productData.id,
        productName: productData.name,
        unitPrice: parseFloat(productData.price),
        quantity: item.quantity,
        lineTotal: parseFloat(productData.price) * item.quantity,
      });
    }

    // Her shop için ayrı sipariş oluştur
    const createdOrderIds = [];
    const transactions = [];

    for (const [shopId, items] of Object.entries(groupedByShop)) {
      // Subtotal hesapla
      const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
      const totalAmount = subtotal + DELIVERY_FEE;

      // Order oluştur
      const orderData = {
        order_number: generateOrderNumber(), // Backend'de unique order number oluştur
        customer_user_id: userId,
        pet_shop_profile_id: shopId,
        status: "pending",
        delivery_type: deliveryType,
        delivery_fee: DELIVERY_FEE,
        subtotal: subtotal,
        total_amount: totalAmount,
      };

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert(orderData)
        .select()
        .single();

      if (orderError) {
        console.error("❌ Order Insert Error:", orderError);
        throw new CustomError(
          Enum.HTTP_CODES.BAD_REQUEST,
          "Sipariş oluşturulamadı",
          orderError.message,
        );
      }

      createdOrderIds.push(order.id);

      // Order items ekle
      const orderItems = items.map((item) => ({
        order_id: order.id,
        product_id: item.productId,
        product_name: item.productName,
        unit_price: item.unitPrice,
        quantity: item.quantity,
        line_total: item.lineTotal,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) {
        console.error("❌ Order Items Insert Error:", itemsError);
        // Rollback: Oluşturulan siparişi sil
        await supabase.from("orders").delete().eq("id", order.id);
        throw new CustomError(
          Enum.HTTP_CODES.BAD_REQUEST,
          "Sipariş detayları eklenemedi",
          itemsError.message,
        );
      }

      transactions.push({
        orderId: order.id,
        orderNumber: order.order_number,
        shopId: shopId,
        subtotal: subtotal,
        deliveryFee: DELIVERY_FEE,
        totalAmount: totalAmount,
      });
    }

    // Genel toplam
    const grandTotal = transactions.reduce((sum, t) => sum + t.totalAmount, 0);

    const successResponse = Response.successResponse(Enum.HTTP_CODES.CREATED, {
      message: "Siparişler başarıyla oluşturuldu",
      data: {
        orderIds: createdOrderIds,
        orders: transactions,
        totalAmount: grandTotal,
        deliveryType: deliveryType,
        address: deliveryType === "delivery" ? address : null,
      },
    });

    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    console.error("❌ Create Order Error:", error);
    const errorResponse = Response.errorResponse(error);
    res.status(errorResponse.code).json(errorResponse);
  }
});

module.exports = router;
