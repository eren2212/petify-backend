const express = require("express");
const multer = require("multer");
const supabase = require("../database/supabase");
const Response = require("../lib/Response");
const CustomError = require("../lib/Error");
const Enum = require("../config/Enum");
const { verifyToken } = require("../middleware/auth");
const router = express.Router();
const z = require("zod");

router.post("/add", verifyToken, async (req, res) => {
  const adoptionPetSchema = z.object({
    pet_type_id: z.string().min(1, "Hayvan tipi zorunludur"),
    pet_name: z
      .string()
      .min(2, "Hayvan adı en az 2 karakter olmalıdır")
      .max(100),
    description: z.string().min(10, "Açıklama en az 10 karakter olmalıdır"),
    breed: z.string().min(1, "Hayvan cinsi zorunludur"),
    gender: z.enum(["male", "female", "unknown"], "Geçersiz cinsiyet değeri"), // Sadece belirli değerleri kabul et
    color: z.string().min(1, "Renk zorunludur"),
    adoption_fee: z
      .number()
      .min(0, "Sahiplenme ücreti 0 veya daha fazla olmalıdır"), // 0'ı kabul eder!
    location_description: z.string().min(1, "Konum açıklaması zorunludur"),
    latitude: z.number(),
    longitude: z.number(),
    requirements: z.string().min(1, "Gereksinimler zorunludur"),

    // Boolean hatasını çözer: Sadece boolean kabul eder (true veya false)
    is_vaccinated: z.boolean({ required_error: "Aşılık durumu belirtilmemiş" }),
    is_neutered: z.boolean({ required_error: "Kısırlık durumu belirtilmemiş" }),
    is_house_trained: z.boolean({
      required_error: "Ev eğitimi durumu belirtilmemiş",
    }),
    good_with_kids: z.boolean({
      required_error: "Çocuklarla uyum durumu belirtilmemiş",
    }),
    good_with_pets: z.boolean({
      required_error: "Diğer hayvanlarla uyum durumu belirtilmemiş",
    }),

    contact_phone: z.string().min(10, "Geçersiz telefon numarası"),
    contact_email: z.string().email("Geçersiz e-posta adresi"), // E-posta formatını kontrol eder

    birthdate: z.string().datetime("Geçersiz tarih formatı"), // Tarih formatını kontrol eder
  });

  const {
    pet_type_id,
    pet_name,
    description,
    breed,
    gender,
    color,
    adoption_fee,
    location_description,
    latitude,
    longitude,
    requirements,
    is_vaccinated,
    is_neutered,
    is_house_trained,
    good_with_kids,
    good_with_pets,
    contact_phone,
    contact_email,
    birthdate,
  } = req.body;
  const userId = req.user.id;
  try {
    const newAdoptionPet = {
      user_id: userId,
      pet_type_id,
      pet_name,
      description,
      breed,
      gender,
      color,
      adoption_fee,
      location_description,
      latitude,
      longitude,
      requirements,
      is_vaccinated,
      is_neutered,
      is_house_trained,
      good_with_kids,
      good_with_pets,
      contact_phone,
      contact_email,
      birthdate,
    };
    const validatedData = adoptionPetSchema.parse(newAdoptionPet);

    //buraya yuva bekleyen hayvan ekleme işlemi yapılacak
    const { data: adoptionPetData, error: adoptionPetError } = await supabase
      .from("adoption_listings")
      .insert(validatedData)
      .select()
      .single();

    if (adoptionPetError) {
      throw new CustomError(
        Enum.HTTP_CODES.INT_SERVER_ERROR,
        "Sahiplenme ilanı eklenemedi",
        adoptionPetError.message
      );
    }

    const successResponse = Response.successResponse(Enum.HTTP_CODES.CREATED, {
      message: "Sahiplenme ilanı başarıyla oluşturuldu",
      listing: adoptionPetData,
    });
    res.status(successResponse.code).json(successResponse);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const allErrors = error.errors.map((e) => e.message);
      const validationError = new CustomError(
        Enum.HTTP_CODES.BAD_REQUEST,
        "Validasyon hatası",
        allErrors
      );
      const errorResponse = Response.errorResponse(validationError);
      return res.status(errorResponse.code).json(errorResponse);
    }

    const errorResponse = Response.errorResponse(error);
    return res.status(errorResponse.code).json(errorResponse);
  }
});

module.exports = router;
