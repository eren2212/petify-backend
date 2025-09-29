


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."admin_activity_type" AS ENUM (
    'login',
    'logout'
);


ALTER TYPE "public"."admin_activity_type" OWNER TO "postgres";


CREATE TYPE "public"."admin_role" AS ENUM (
    'super_admin',
    'moderator'
);


ALTER TYPE "public"."admin_role" OWNER TO "postgres";


CREATE TYPE "public"."admin_verification_status" AS ENUM (
    'pending',
    'approved',
    'rejected'
);


ALTER TYPE "public"."admin_verification_status" OWNER TO "postgres";


CREATE TYPE "public"."ai_verification_status" AS ENUM (
    'pending',
    'processing',
    'matched',
    'not_matched',
    'error'
);


ALTER TYPE "public"."ai_verification_status" OWNER TO "postgres";


CREATE TYPE "public"."delivery_type" AS ENUM (
    'pickup',
    'delivery'
);


ALTER TYPE "public"."delivery_type" OWNER TO "postgres";


CREATE TYPE "public"."device_type" AS ENUM (
    'ios',
    'android',
    'web'
);


ALTER TYPE "public"."device_type" OWNER TO "postgres";


CREATE TYPE "public"."favorite_type" AS ENUM (
    'product',
    'pet_shop',
    'pet_sitter',
    'clinic',
    'pet_hotel'
);


ALTER TYPE "public"."favorite_type" OWNER TO "postgres";


CREATE TYPE "public"."listing_status" AS ENUM (
    'active',
    'found',
    'cancelled',
    'expired'
);


ALTER TYPE "public"."listing_status" OWNER TO "postgres";


CREATE TYPE "public"."message_type" AS ENUM (
    'text',
    'image',
    'location'
);


ALTER TYPE "public"."message_type" OWNER TO "postgres";


CREATE TYPE "public"."notification_status" AS ENUM (
    'sent',
    'delivered',
    'failed',
    'read'
);


ALTER TYPE "public"."notification_status" OWNER TO "postgres";


CREATE TYPE "public"."notification_type" AS ENUM (
    'message',
    'order',
    'review',
    'system'
);


ALTER TYPE "public"."notification_type" OWNER TO "postgres";


CREATE TYPE "public"."order_status" AS ENUM (
    'pending',
    'paid',
    'preparing',
    'ready',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."order_status" OWNER TO "postgres";


CREATE TYPE "public"."payment_method" AS ENUM (
    'credit_card',
    'debit_card',
    'cash_on_delivery'
);


ALTER TYPE "public"."payment_method" OWNER TO "postgres";


CREATE TYPE "public"."payment_status" AS ENUM (
    'pending',
    'success',
    'failed',
    'cancelled',
    'refunded'
);


ALTER TYPE "public"."payment_status" OWNER TO "postgres";


CREATE TYPE "public"."pet_age_group" AS ENUM (
    'puppy',
    'adult',
    'senior'
);


ALTER TYPE "public"."pet_age_group" OWNER TO "postgres";


CREATE TYPE "public"."pet_gender" AS ENUM (
    'male',
    'female',
    'unknown'
);


ALTER TYPE "public"."pet_gender" OWNER TO "postgres";


CREATE TYPE "public"."price_type" AS ENUM (
    'hourly',
    'daily'
);


ALTER TYPE "public"."price_type" OWNER TO "postgres";


CREATE TYPE "public"."reply_status" AS ENUM (
    'pending',
    'approved',
    'rejected'
);


ALTER TYPE "public"."reply_status" OWNER TO "postgres";


CREATE TYPE "public"."report_reason" AS ENUM (
    'spam',
    'inappropriate',
    'fake',
    'offensive',
    'irrelevant',
    'other'
);


ALTER TYPE "public"."report_reason" OWNER TO "postgres";


CREATE TYPE "public"."report_status" AS ENUM (
    'pending',
    'reviewed',
    'resolved',
    'dismissed'
);


ALTER TYPE "public"."report_status" OWNER TO "postgres";


CREATE TYPE "public"."review_status" AS ENUM (
    'pending',
    'approved',
    'rejected'
);


ALTER TYPE "public"."review_status" OWNER TO "postgres";


CREATE TYPE "public"."review_type" AS ENUM (
    'pet_shop',
    'product',
    'pet_sitter',
    'clinic',
    'pet_hotel'
);


ALTER TYPE "public"."review_type" OWNER TO "postgres";


CREATE TYPE "public"."role_status" AS ENUM (
    'pending',
    'approved',
    'rejected',
    'suspended'
);


ALTER TYPE "public"."role_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role_type" AS ENUM (
    'pet_owner',
    'pet_shop',
    'pet_clinic',
    'pet_sitter',
    'pet_hotel'
);


ALTER TYPE "public"."user_role_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_hide_reported_review"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    report_count INTEGER;
BEGIN
    -- Bu yoruma kaç rapor var?
    SELECT COUNT(*) INTO report_count
    FROM review_reports 
    WHERE review_id = NEW.review_id;
    
    -- 5 veya daha fazla rapor varsa yorumu otomatik gizle
    IF report_count >= 5 THEN
        UPDATE reviews 
        SET status = 'rejected',
            rejection_reason = 'Otomatik gizlendi: 5+ rapor alındı',
            reviewed_at = NOW()
        WHERE id = NEW.review_id;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_hide_reported_review"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_line_total"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.line_total = NEW.quantity * NEW.unit_price;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."calculate_line_total"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_expired_notifications"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    DELETE FROM notifications 
    WHERE expires_at < NOW();
END;
$$;


ALTER FUNCTION "public"."cleanup_expired_notifications"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_inactive_devices"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    UPDATE user_devices 
    SET is_active = FALSE 
    WHERE last_used_at < NOW() - INTERVAL '30 days' 
    AND is_active = TRUE;
END;
$$;


ALTER FUNCTION "public"."cleanup_inactive_devices"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_old_admin_logs"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    DELETE FROM admin_activity_logs 
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;


ALTER FUNCTION "public"."cleanup_old_admin_logs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_order_number"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    year_part TEXT;
    sequence_part TEXT;
BEGIN
    year_part := EXTRACT(YEAR FROM NOW())::TEXT;
    
    -- Sequence oluştur (yıl bazında)
    EXECUTE format('CREATE SEQUENCE IF NOT EXISTS order_seq_%s START 1', year_part);
    
    -- Sequence'den numara al
    EXECUTE format('SELECT LPAD(nextval(''order_seq_%s'')::TEXT, 6, ''0'')', year_part) INTO sequence_part;
    
    RETURN format('ORD-%s-%s', year_part, sequence_part);
END;
$$;


ALTER FUNCTION "public"."generate_order_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_payment_token"() RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    RETURN 'PAY_' || EXTRACT(EPOCH FROM NOW())::BIGINT || '_' || SUBSTRING(gen_random_uuid()::TEXT, 1, 8);
END;
$$;


ALTER FUNCTION "public"."generate_payment_token"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_notification_read"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.is_read = TRUE AND OLD.is_read = FALSE THEN
        NEW.read_at = NOW();
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."mark_notification_read"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_favorite_count"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Favori eklendiğinde sayaç artır
        INSERT INTO favorite_counts (favorite_type, target_id, count, updated_at)
        VALUES (NEW.favorite_type, NEW.target_id, 1, NOW())
        ON CONFLICT (favorite_type, target_id) 
        DO UPDATE SET count = favorite_counts.count + 1, updated_at = NOW();
        
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Favori silindiğinde sayaç azalt
        UPDATE favorite_counts 
        SET count = GREATEST(count - 1, 0), updated_at = NOW()
        WHERE favorite_type = OLD.favorite_type AND target_id = OLD.target_id;
        
        -- Sayaç 0 olursa kaydı sil
        DELETE FROM favorite_counts 
        WHERE favorite_type = OLD.favorite_type 
        AND target_id = OLD.target_id 
        AND count = 0;
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_favorite_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admin_activity_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "admin_user_id" "uuid",
    "activity_type" "public"."admin_activity_type" NOT NULL,
    "ip_address" "inet",
    "user_agent" "text",
    "details" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."admin_activity_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_users" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "email" character varying(255) NOT NULL,
    "password_hash" character varying(255) NOT NULL,
    "full_name" character varying(255) NOT NULL,
    "admin_role" "public"."admin_role" NOT NULL,
    "permissions" "jsonb" DEFAULT '[]'::"jsonb",
    "is_active" boolean DEFAULT true,
    "last_login_at" timestamp with time zone,
    "created_by_admin_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."admin_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."adoption_listings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "pet_id" "uuid",
    "pet_name" character varying(100) NOT NULL,
    "pet_type_id" "uuid",
    "breed" character varying(100),
    "age_years" integer,
    "age_months" integer,
    "gender" "public"."pet_gender",
    "color" character varying(100),
    "description" "text" NOT NULL,
    "adoption_fee" numeric(10,2),
    "location" "text",
    "latitude" numeric(10,8),
    "longitude" numeric(11,8),
    "requirements" "text",
    "is_vaccinated" boolean DEFAULT false,
    "is_neutered" boolean DEFAULT false,
    "is_house_trained" boolean DEFAULT false,
    "good_with_kids" boolean,
    "good_with_pets" boolean,
    "contact_phone" character varying(20),
    "contact_email" character varying(255),
    "status" "public"."listing_status" DEFAULT 'active'::"public"."listing_status",
    "adopted_date" "date",
    "adopted_description" "text",
    "expires_at" timestamp with time zone DEFAULT ("now"() + '60 days'::interval),
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."adoption_listings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clinic_profiles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_role_id" "uuid",
    "clinic_name" character varying(255) NOT NULL,
    "description" "text",
    "address" "text",
    "latitude" numeric(10,8),
    "longitude" numeric(11,8),
    "phone_number" character varying(20),
    "emergency_phone" character varying(20),
    "email" character varying(255),
    "website_url" "text",
    "instagram_url" "text",
    "logo_url" "text",
    "cover_image_url" "text",
    "working_hours" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."clinic_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clinic_service_categories" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."clinic_service_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clinic_services" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "clinic_profile_id" "uuid",
    "service_category_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."clinic_services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clinic_veterinarians" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "clinic_profile_id" "uuid",
    "first_name" character varying(100) NOT NULL,
    "last_name" character varying(100) NOT NULL,
    "specialization" character varying(255),
    "experience_years" integer,
    "photo_url" "text",
    "bio" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."clinic_veterinarians" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversation_participants" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "conversation_id" "uuid",
    "participant_role_id" "uuid",
    "is_deleted" boolean DEFAULT false,
    "last_read_at" timestamp with time zone,
    "is_muted" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."conversation_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "participant_1_role_id" "uuid",
    "participant_2_role_id" "uuid",
    "last_message_content" "text",
    "last_message_at" timestamp with time zone,
    "last_message_sender_role_id" "uuid",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "unique_conversation" CHECK (("participant_1_role_id" < "participant_2_role_id"))
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."favorite_counts" (
    "favorite_type" "public"."favorite_type" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "count" integer DEFAULT 0,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."favorite_counts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."favorites" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "favorite_type" "public"."favorite_type" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lost_pet_listings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "pet_id" "uuid",
    "pet_name" character varying(100) NOT NULL,
    "pet_type_id" "uuid",
    "breed" character varying(100),
    "age_years" integer,
    "age_months" integer,
    "gender" "public"."pet_gender",
    "color" character varying(100),
    "description" "text" NOT NULL,
    "lost_date" "date" NOT NULL,
    "lost_time" time without time zone,
    "last_seen_location" "text" NOT NULL,
    "last_seen_latitude" numeric(10,8) NOT NULL,
    "last_seen_longitude" numeric(11,8) NOT NULL,
    "contact_phone" character varying(20),
    "contact_email" character varying(255),
    "reward_amount" numeric(10,2),
    "reward_description" "text",
    "status" "public"."listing_status" DEFAULT 'active'::"public"."listing_status",
    "found_date" "date",
    "found_description" "text",
    "expires_at" timestamp with time zone DEFAULT ("now"() + '30 days'::interval),
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."lost_pet_listings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "conversation_id" "uuid",
    "sender_role_id" "uuid",
    "message_type" "public"."message_type" DEFAULT 'text'::"public"."message_type" NOT NULL,
    "content" "text",
    "image_url" "text",
    "location_name" "text",
    "location_latitude" numeric(10,8),
    "location_longitude" numeric(11,8),
    "is_read" boolean DEFAULT false,
    "read_at" timestamp with time zone,
    "is_deleted" boolean DEFAULT false,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "notification_type" "public"."notification_type" NOT NULL,
    "title" character varying(255) NOT NULL,
    "message" "text" NOT NULL,
    "data" "jsonb",
    "firebase_message_id" character varying(200),
    "notification_status" "public"."notification_status" DEFAULT 'sent'::"public"."notification_status",
    "is_read" boolean DEFAULT false,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval)
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "order_id" "uuid",
    "product_id" "uuid",
    "product_name" character varying(255) NOT NULL,
    "product_weight_kg" numeric(8,3),
    "unit_price" numeric(10,2) NOT NULL,
    "quantity" integer NOT NULL,
    "line_total" numeric(10,2) NOT NULL,
    "product_age_group" "public"."pet_age_group",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "order_items_quantity_check" CHECK (("quantity" > 0))
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "order_number" character varying(50) DEFAULT "public"."generate_order_number"() NOT NULL,
    "customer_user_id" "uuid",
    "pet_shop_profile_id" "uuid",
    "subtotal" numeric(10,2) NOT NULL,
    "delivery_fee" numeric(10,2) DEFAULT 0,
    "total_amount" numeric(10,2) NOT NULL,
    "delivery_type" "public"."delivery_type" NOT NULL,
    "delivery_address" "text",
    "delivery_phone" character varying(20),
    "delivery_notes" "text",
    "status" "public"."order_status" DEFAULT 'pending'::"public"."order_status",
    "estimated_ready_time" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "payment_token" character varying(100) DEFAULT "public"."generate_payment_token"() NOT NULL,
    "user_id" "uuid",
    "order_ids" "uuid"[] NOT NULL,
    "subtotal" numeric(10,2) NOT NULL,
    "delivery_fees" numeric(10,2) DEFAULT 0,
    "total_amount" numeric(10,2) NOT NULL,
    "iyzico_payment_id" character varying(100),
    "iyzico_conversation_id" character varying(100),
    "iyzico_status" character varying(50),
    "iyzico_payment_status" character varying(50),
    "iyzico_fraud_status" character varying(50),
    "iyzico_error_code" character varying(50),
    "iyzico_error_message" "text",
    "payment_method" "public"."payment_method",
    "payment_status" "public"."payment_status" DEFAULT 'pending'::"public"."payment_status",
    "installment" integer DEFAULT 1,
    "currency" character varying(3) DEFAULT 'TRY'::character varying,
    "card_last_four" character varying(4),
    "card_type" character varying(20),
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pet_hotel_profiles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_role_id" "uuid",
    "hotel_name" character varying(255) NOT NULL,
    "description" "text",
    "address" "text" NOT NULL,
    "latitude" numeric(10,8) NOT NULL,
    "longitude" numeric(11,8) NOT NULL,
    "phone_number" character varying(20),
    "emergency_phone" character varying(20),
    "email" character varying(255),
    "website_url" "text",
    "instagram_url" "text",
    "logo_url" "text",
    "cover_image_url" "text",
    "capacity" integer,
    "check_in_time" time without time zone,
    "check_out_time" time without time zone,
    "working_hours" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pet_hotel_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pet_hotel_service_categories" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "name_tr" character varying(100) NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pet_hotel_service_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pet_hotel_services" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "pet_hotel_profile_id" "uuid",
    "service_category_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pet_hotel_services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pet_shop_profiles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_role_id" "uuid",
    "shop_name" character varying(255) NOT NULL,
    "description" "text",
    "address" "text",
    "latitude" numeric(10,8),
    "longitude" numeric(11,8),
    "phone_number" character varying(20),
    "email" character varying(255),
    "website_url" "text",
    "instagram_url" "text",
    "logo_url" "text",
    "cover_image_url" "text",
    "working_hours" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pet_shop_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pet_sitter_profiles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_role_id" "uuid",
    "display_name" character varying(255) NOT NULL,
    "bio" "text",
    "experience_years" integer,
    "profile_image_url" "text",
    "cover_image_url" "text",
    "phone_number" character varying(20),
    "instagram_url" "text",
    "is_available" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pet_sitter_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pet_sitter_service_categories" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "name_tr" character varying(100) NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pet_sitter_service_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pet_sitter_services" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "pet_sitter_profile_id" "uuid",
    "service_category_id" "uuid",
    "pet_type_id" "uuid",
    "price_type" "public"."price_type" NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pet_sitter_services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pet_types" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(50) NOT NULL,
    "name_tr" character varying(50) NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pet_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pet_vaccinations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "pet_id" "uuid",
    "vaccine_name" character varying(100) NOT NULL,
    "vaccination_date" "date" NOT NULL,
    "next_due_date" "date",
    "veterinarian_name" character varying(255),
    "clinic_name" character varying(255),
    "batch_number" character varying(50),
    "notes" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pet_vaccinations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pets" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "pet_type_id" "uuid",
    "name" character varying(100) NOT NULL,
    "breed" character varying(100),
    "age_years" integer,
    "age_months" integer,
    "gender" "public"."pet_gender",
    "weight_kg" numeric(5,2),
    "color" character varying(100),
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_categories" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "name_tr" character varying(100) NOT NULL,
    "description" "text",
    "icon_url" "text",
    "is_active" boolean DEFAULT true,
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."product_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "pet_shop_profile_id" "uuid",
    "category_id" "uuid",
    "pet_type_id" "uuid",
    "name" character varying(255) NOT NULL,
    "description" "text" NOT NULL,
    "weight_kg" numeric(8,3),
    "age_group" "public"."pet_age_group",
    "price" numeric(10,2) NOT NULL,
    "stock_quantity" integer DEFAULT 0 NOT NULL,
    "low_stock_threshold" integer DEFAULT 5,
    "is_active" boolean DEFAULT true,
    "is_available" boolean GENERATED ALWAYS AS ((("stock_quantity" > 0) AND "is_active")) STORED,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_images" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "profile_type" character varying(50) NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "image_url" "text" NOT NULL,
    "image_order" integer DEFAULT 1,
    "image_description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "check_profile_type" CHECK ((("profile_type")::"text" = ANY ((ARRAY['pet_shop'::character varying, 'pet_hotel'::character varying, 'clinic'::character varying, 'pet_sitter'::character varying, 'pet'::character varying, 'product'::character varying])::"text"[])))
);


ALTER TABLE "public"."profile_images" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_replies" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "review_id" "uuid",
    "replier_role_id" "uuid",
    "reply_text" "text" NOT NULL,
    "status" "public"."reply_status" DEFAULT 'pending'::"public"."reply_status",
    "reviewed_by_admin_id" "uuid",
    "reviewed_at" timestamp with time zone,
    "rejection_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."review_replies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_reports" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "review_id" "uuid",
    "reporter_user_id" "uuid",
    "reason" "public"."report_reason" NOT NULL,
    "description" "text",
    "status" "public"."report_status" DEFAULT 'pending'::"public"."report_status",
    "reviewed_by_admin_id" "uuid",
    "reviewed_at" timestamp with time zone,
    "admin_notes" "text",
    "action_taken" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."review_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "review_type" "public"."review_type" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "reviewer_user_id" "uuid",
    "rating" integer NOT NULL,
    "comment" "text" NOT NULL,
    "status" "public"."review_status" DEFAULT 'pending'::"public"."review_status",
    "reviewed_by_admin_id" "uuid",
    "reviewed_at" timestamp with time zone,
    "rejection_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "reviews_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shopping_cart" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "product_id" "uuid",
    "quantity" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "shopping_cart_quantity_check" CHECK (("quantity" > 0))
);


ALTER TABLE "public"."shopping_cart" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_settings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "key" character varying(100) NOT NULL,
    "value" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."system_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_devices" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "firebase_token" character varying(500) NOT NULL,
    "device_type" "public"."device_type" NOT NULL,
    "device_name" character varying(100),
    "device_model" character varying(100),
    "app_version" character varying(20),
    "is_active" boolean DEFAULT true,
    "last_used_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_devices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "full_name" character varying(255) NOT NULL,
    "phone_number" character varying(20),
    "avatar_url" "text",
    "is_deleted" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "role_type" "public"."user_role_type" NOT NULL,
    "status" "public"."role_status" DEFAULT 'pending'::"public"."role_status",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_verifications" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_role_id" "uuid",
    "selfie_image_url" "text" NOT NULL,
    "id_front_image_url" "text" NOT NULL,
    "id_back_image_url" "text",
    "ai_verification_status" "public"."ai_verification_status" DEFAULT 'pending'::"public"."ai_verification_status",
    "ai_confidence_score" numeric(5,2),
    "ai_processed_at" timestamp with time zone,
    "ai_error_message" "text",
    "admin_verification_status" "public"."admin_verification_status" DEFAULT 'pending'::"public"."admin_verification_status",
    "admin_user_id" "uuid",
    "rejection_reason" "text",
    "admin_notes" "text",
    "verified_at" timestamp with time zone,
    "attempt_number" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_verifications" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_activity_logs"
    ADD CONSTRAINT "admin_activity_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."adoption_listings"
    ADD CONSTRAINT "adoption_listings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clinic_profiles"
    ADD CONSTRAINT "clinic_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clinic_profiles"
    ADD CONSTRAINT "clinic_profiles_user_role_id_key" UNIQUE ("user_role_id");



ALTER TABLE ONLY "public"."clinic_service_categories"
    ADD CONSTRAINT "clinic_service_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."clinic_service_categories"
    ADD CONSTRAINT "clinic_service_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clinic_services"
    ADD CONSTRAINT "clinic_services_clinic_profile_id_service_category_id_key" UNIQUE ("clinic_profile_id", "service_category_id");



ALTER TABLE ONLY "public"."clinic_services"
    ADD CONSTRAINT "clinic_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clinic_veterinarians"
    ADD CONSTRAINT "clinic_veterinarians_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_conversation_id_participant_role__key" UNIQUE ("conversation_id", "participant_role_id");



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_participant_1_role_id_participant_2_role_id_key" UNIQUE ("participant_1_role_id", "participant_2_role_id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."favorite_counts"
    ADD CONSTRAINT "favorite_counts_pkey" PRIMARY KEY ("favorite_type", "target_id");



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_user_id_favorite_type_target_id_key" UNIQUE ("user_id", "favorite_type", "target_id");



ALTER TABLE ONLY "public"."lost_pet_listings"
    ADD CONSTRAINT "lost_pet_listings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_order_number_key" UNIQUE ("order_number");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_payment_token_key" UNIQUE ("payment_token");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pet_hotel_profiles"
    ADD CONSTRAINT "pet_hotel_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pet_hotel_profiles"
    ADD CONSTRAINT "pet_hotel_profiles_user_role_id_key" UNIQUE ("user_role_id");



ALTER TABLE ONLY "public"."pet_hotel_service_categories"
    ADD CONSTRAINT "pet_hotel_service_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."pet_hotel_service_categories"
    ADD CONSTRAINT "pet_hotel_service_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pet_hotel_services"
    ADD CONSTRAINT "pet_hotel_services_pet_hotel_profile_id_service_category_id_key" UNIQUE ("pet_hotel_profile_id", "service_category_id");



ALTER TABLE ONLY "public"."pet_hotel_services"
    ADD CONSTRAINT "pet_hotel_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pet_shop_profiles"
    ADD CONSTRAINT "pet_shop_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pet_shop_profiles"
    ADD CONSTRAINT "pet_shop_profiles_user_role_id_key" UNIQUE ("user_role_id");



ALTER TABLE ONLY "public"."pet_sitter_profiles"
    ADD CONSTRAINT "pet_sitter_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pet_sitter_profiles"
    ADD CONSTRAINT "pet_sitter_profiles_user_role_id_key" UNIQUE ("user_role_id");



ALTER TABLE ONLY "public"."pet_sitter_service_categories"
    ADD CONSTRAINT "pet_sitter_service_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."pet_sitter_service_categories"
    ADD CONSTRAINT "pet_sitter_service_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pet_sitter_services"
    ADD CONSTRAINT "pet_sitter_services_pet_sitter_profile_id_service_category__key" UNIQUE ("pet_sitter_profile_id", "service_category_id", "pet_type_id", "price_type");



ALTER TABLE ONLY "public"."pet_sitter_services"
    ADD CONSTRAINT "pet_sitter_services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pet_types"
    ADD CONSTRAINT "pet_types_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."pet_types"
    ADD CONSTRAINT "pet_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pet_vaccinations"
    ADD CONSTRAINT "pet_vaccinations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pets"
    ADD CONSTRAINT "pets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_categories"
    ADD CONSTRAINT "product_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."product_categories"
    ADD CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profile_images"
    ADD CONSTRAINT "profile_images_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_replies"
    ADD CONSTRAINT "review_replies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_replies"
    ADD CONSTRAINT "review_replies_review_id_replier_role_id_key" UNIQUE ("review_id", "replier_role_id");



ALTER TABLE ONLY "public"."review_reports"
    ADD CONSTRAINT "review_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."review_reports"
    ADD CONSTRAINT "review_reports_review_id_reporter_user_id_key" UNIQUE ("review_id", "reporter_user_id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shopping_cart"
    ADD CONSTRAINT "shopping_cart_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shopping_cart"
    ADD CONSTRAINT "shopping_cart_user_id_product_id_key" UNIQUE ("user_id", "product_id");



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_devices"
    ADD CONSTRAINT "user_devices_firebase_token_key" UNIQUE ("firebase_token");



ALTER TABLE ONLY "public"."user_devices"
    ADD CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_type_key" UNIQUE ("user_id", "role_type");



ALTER TABLE ONLY "public"."user_verifications"
    ADD CONSTRAINT "user_verifications_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_admin_activity_logs_activity_type" ON "public"."admin_activity_logs" USING "btree" ("activity_type");



CREATE INDEX "idx_admin_activity_logs_admin_user_id" ON "public"."admin_activity_logs" USING "btree" ("admin_user_id");



CREATE INDEX "idx_admin_activity_logs_created" ON "public"."admin_activity_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_admin_activity_logs_ip" ON "public"."admin_activity_logs" USING "btree" ("ip_address");



CREATE INDEX "idx_admin_users_active" ON "public"."admin_users" USING "btree" ("is_active");



CREATE INDEX "idx_admin_users_email" ON "public"."admin_users" USING "btree" ("email");



CREATE INDEX "idx_admin_users_role" ON "public"."admin_users" USING "btree" ("admin_role");



CREATE INDEX "idx_adoption_listings_active" ON "public"."adoption_listings" USING "btree" ("is_active", "status");



CREATE INDEX "idx_adoption_listings_expires" ON "public"."adoption_listings" USING "btree" ("expires_at");



CREATE INDEX "idx_adoption_listings_fee" ON "public"."adoption_listings" USING "btree" ("adoption_fee");



CREATE INDEX "idx_adoption_listings_location" ON "public"."adoption_listings" USING "btree" ("latitude", "longitude");



CREATE INDEX "idx_adoption_listings_pet_id" ON "public"."adoption_listings" USING "btree" ("pet_id");



CREATE INDEX "idx_adoption_listings_pet_type" ON "public"."adoption_listings" USING "btree" ("pet_type_id");



CREATE INDEX "idx_adoption_listings_status" ON "public"."adoption_listings" USING "btree" ("status");



CREATE INDEX "idx_adoption_listings_user_id" ON "public"."adoption_listings" USING "btree" ("user_id");



CREATE INDEX "idx_clinic_profiles_location" ON "public"."clinic_profiles" USING "btree" ("latitude", "longitude");



CREATE INDEX "idx_clinic_profiles_user_role_id" ON "public"."clinic_profiles" USING "btree" ("user_role_id");



CREATE INDEX "idx_clinic_service_categories_active" ON "public"."clinic_service_categories" USING "btree" ("is_active");



CREATE INDEX "idx_clinic_services_category_id" ON "public"."clinic_services" USING "btree" ("service_category_id");



CREATE INDEX "idx_clinic_services_clinic_id" ON "public"."clinic_services" USING "btree" ("clinic_profile_id");



CREATE INDEX "idx_clinic_veterinarians_active" ON "public"."clinic_veterinarians" USING "btree" ("is_active");



CREATE INDEX "idx_clinic_veterinarians_clinic_id" ON "public"."clinic_veterinarians" USING "btree" ("clinic_profile_id");



CREATE INDEX "idx_conversation_participants_conversation" ON "public"."conversation_participants" USING "btree" ("conversation_id");



CREATE INDEX "idx_conversation_participants_deleted" ON "public"."conversation_participants" USING "btree" ("is_deleted");



CREATE INDEX "idx_conversation_participants_role" ON "public"."conversation_participants" USING "btree" ("participant_role_id");



CREATE INDEX "idx_conversations_active" ON "public"."conversations" USING "btree" ("is_active");



CREATE INDEX "idx_conversations_last_message" ON "public"."conversations" USING "btree" ("last_message_at" DESC);



CREATE INDEX "idx_conversations_participant_1" ON "public"."conversations" USING "btree" ("participant_1_role_id");



CREATE INDEX "idx_conversations_participant_2" ON "public"."conversations" USING "btree" ("participant_2_role_id");



CREATE INDEX "idx_favorite_counts_count" ON "public"."favorite_counts" USING "btree" ("count" DESC);



CREATE INDEX "idx_favorite_counts_type_target" ON "public"."favorite_counts" USING "btree" ("favorite_type", "target_id");



CREATE INDEX "idx_favorites_created" ON "public"."favorites" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_favorites_target_id" ON "public"."favorites" USING "btree" ("target_id");



CREATE INDEX "idx_favorites_type" ON "public"."favorites" USING "btree" ("favorite_type");



CREATE INDEX "idx_favorites_type_target" ON "public"."favorites" USING "btree" ("favorite_type", "target_id");



CREATE INDEX "idx_favorites_user_id" ON "public"."favorites" USING "btree" ("user_id");



CREATE INDEX "idx_favorites_user_type" ON "public"."favorites" USING "btree" ("user_id", "favorite_type");



CREATE INDEX "idx_lost_pet_listings_active" ON "public"."lost_pet_listings" USING "btree" ("is_active", "status");



CREATE INDEX "idx_lost_pet_listings_expires" ON "public"."lost_pet_listings" USING "btree" ("expires_at");



CREATE INDEX "idx_lost_pet_listings_location" ON "public"."lost_pet_listings" USING "btree" ("last_seen_latitude", "last_seen_longitude");



CREATE INDEX "idx_lost_pet_listings_pet_id" ON "public"."lost_pet_listings" USING "btree" ("pet_id");



CREATE INDEX "idx_lost_pet_listings_pet_type" ON "public"."lost_pet_listings" USING "btree" ("pet_type_id");



CREATE INDEX "idx_lost_pet_listings_status" ON "public"."lost_pet_listings" USING "btree" ("status");



CREATE INDEX "idx_lost_pet_listings_user_id" ON "public"."lost_pet_listings" USING "btree" ("user_id");



CREATE INDEX "idx_messages_conversation_created" ON "public"."messages" USING "btree" ("conversation_id", "created_at" DESC);



CREATE INDEX "idx_messages_conversation_id" ON "public"."messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_messages_deleted" ON "public"."messages" USING "btree" ("is_deleted");



CREATE INDEX "idx_messages_read_status" ON "public"."messages" USING "btree" ("is_read");



CREATE INDEX "idx_messages_sender_role_id" ON "public"."messages" USING "btree" ("sender_role_id");



CREATE INDEX "idx_messages_type" ON "public"."messages" USING "btree" ("message_type");



CREATE INDEX "idx_notifications_created" ON "public"."notifications" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_notifications_expires" ON "public"."notifications" USING "btree" ("expires_at");



CREATE INDEX "idx_notifications_read" ON "public"."notifications" USING "btree" ("is_read");



CREATE INDEX "idx_notifications_status" ON "public"."notifications" USING "btree" ("notification_status");



CREATE INDEX "idx_notifications_type" ON "public"."notifications" USING "btree" ("notification_type");



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_notifications_user_unread" ON "public"."notifications" USING "btree" ("user_id", "is_read") WHERE ("is_read" = false);



CREATE INDEX "idx_order_items_order_id" ON "public"."order_items" USING "btree" ("order_id");



CREATE INDEX "idx_order_items_product_id" ON "public"."order_items" USING "btree" ("product_id");



CREATE INDEX "idx_orders_created" ON "public"."orders" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_orders_customer_user_id" ON "public"."orders" USING "btree" ("customer_user_id");



CREATE INDEX "idx_orders_delivery_type" ON "public"."orders" USING "btree" ("delivery_type");



CREATE INDEX "idx_orders_estimated_ready" ON "public"."orders" USING "btree" ("estimated_ready_time");



CREATE INDEX "idx_orders_order_number" ON "public"."orders" USING "btree" ("order_number");



CREATE INDEX "idx_orders_pet_shop_profile_id" ON "public"."orders" USING "btree" ("pet_shop_profile_id");



CREATE INDEX "idx_orders_status" ON "public"."orders" USING "btree" ("status");



CREATE INDEX "idx_payments_created" ON "public"."payments" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_payments_iyzico_payment_id" ON "public"."payments" USING "btree" ("iyzico_payment_id");



CREATE INDEX "idx_payments_order_ids" ON "public"."payments" USING "gin" ("order_ids");



CREATE INDEX "idx_payments_paid_at" ON "public"."payments" USING "btree" ("paid_at" DESC);



CREATE INDEX "idx_payments_payment_token" ON "public"."payments" USING "btree" ("payment_token");



CREATE INDEX "idx_payments_status" ON "public"."payments" USING "btree" ("payment_status");



CREATE INDEX "idx_payments_user_id" ON "public"."payments" USING "btree" ("user_id");



CREATE INDEX "idx_pet_hotel_profiles_capacity" ON "public"."pet_hotel_profiles" USING "btree" ("capacity");



CREATE INDEX "idx_pet_hotel_profiles_location" ON "public"."pet_hotel_profiles" USING "btree" ("latitude", "longitude");



CREATE INDEX "idx_pet_hotel_profiles_user_role_id" ON "public"."pet_hotel_profiles" USING "btree" ("user_role_id");



CREATE INDEX "idx_pet_hotel_service_categories_active" ON "public"."pet_hotel_service_categories" USING "btree" ("is_active");



CREATE INDEX "idx_pet_hotel_services_category_id" ON "public"."pet_hotel_services" USING "btree" ("service_category_id");



CREATE INDEX "idx_pet_hotel_services_hotel_id" ON "public"."pet_hotel_services" USING "btree" ("pet_hotel_profile_id");



CREATE INDEX "idx_pet_shop_profiles_location" ON "public"."pet_shop_profiles" USING "btree" ("latitude", "longitude");



CREATE INDEX "idx_pet_shop_profiles_user_role_id" ON "public"."pet_shop_profiles" USING "btree" ("user_role_id");



CREATE INDEX "idx_pet_sitter_profiles_available" ON "public"."pet_sitter_profiles" USING "btree" ("is_available");



CREATE INDEX "idx_pet_sitter_profiles_user_role_id" ON "public"."pet_sitter_profiles" USING "btree" ("user_role_id");



CREATE INDEX "idx_pet_sitter_service_categories_active" ON "public"."pet_sitter_service_categories" USING "btree" ("is_active");



CREATE INDEX "idx_pet_sitter_services_active" ON "public"."pet_sitter_services" USING "btree" ("is_active");



CREATE INDEX "idx_pet_sitter_services_category_id" ON "public"."pet_sitter_services" USING "btree" ("service_category_id");



CREATE INDEX "idx_pet_sitter_services_pet_type_id" ON "public"."pet_sitter_services" USING "btree" ("pet_type_id");



CREATE INDEX "idx_pet_sitter_services_price_type" ON "public"."pet_sitter_services" USING "btree" ("price_type");



CREATE INDEX "idx_pet_sitter_services_profile_id" ON "public"."pet_sitter_services" USING "btree" ("pet_sitter_profile_id");



CREATE INDEX "idx_pet_types_active" ON "public"."pet_types" USING "btree" ("is_active");



CREATE INDEX "idx_pet_vaccinations_active" ON "public"."pet_vaccinations" USING "btree" ("is_active");



CREATE INDEX "idx_pet_vaccinations_next_due_date" ON "public"."pet_vaccinations" USING "btree" ("next_due_date");



CREATE INDEX "idx_pet_vaccinations_pet_id" ON "public"."pet_vaccinations" USING "btree" ("pet_id");



CREATE INDEX "idx_pet_vaccinations_vaccination_date" ON "public"."pet_vaccinations" USING "btree" ("vaccination_date");



CREATE INDEX "idx_pets_active" ON "public"."pets" USING "btree" ("is_active");



CREATE INDEX "idx_pets_pet_type_id" ON "public"."pets" USING "btree" ("pet_type_id");



CREATE INDEX "idx_pets_user_id" ON "public"."pets" USING "btree" ("user_id");



CREATE INDEX "idx_product_categories_active" ON "public"."product_categories" USING "btree" ("is_active");



CREATE INDEX "idx_product_categories_order" ON "public"."product_categories" USING "btree" ("display_order");



CREATE INDEX "idx_products_active" ON "public"."products" USING "btree" ("is_active");



CREATE INDEX "idx_products_age_group" ON "public"."products" USING "btree" ("age_group");



CREATE INDEX "idx_products_available" ON "public"."products" USING "btree" ("is_available");



CREATE INDEX "idx_products_category_id" ON "public"."products" USING "btree" ("category_id");



CREATE INDEX "idx_products_pet_shop_id" ON "public"."products" USING "btree" ("pet_shop_profile_id");



CREATE INDEX "idx_products_pet_type_id" ON "public"."products" USING "btree" ("pet_type_id");



CREATE INDEX "idx_products_price" ON "public"."products" USING "btree" ("price");



CREATE INDEX "idx_products_stock" ON "public"."products" USING "btree" ("stock_quantity");



CREATE INDEX "idx_profile_images_active" ON "public"."profile_images" USING "btree" ("is_active");



CREATE INDEX "idx_profile_images_order" ON "public"."profile_images" USING "btree" ("profile_type", "profile_id", "image_order");



CREATE INDEX "idx_profile_images_profile" ON "public"."profile_images" USING "btree" ("profile_type", "profile_id");



CREATE INDEX "idx_review_replies_created" ON "public"."review_replies" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_review_replies_replier_role_id" ON "public"."review_replies" USING "btree" ("replier_role_id");



CREATE INDEX "idx_review_replies_review_id" ON "public"."review_replies" USING "btree" ("review_id");



CREATE INDEX "idx_review_replies_status" ON "public"."review_replies" USING "btree" ("status");



CREATE INDEX "idx_review_reports_created" ON "public"."review_reports" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_review_reports_reason" ON "public"."review_reports" USING "btree" ("reason");



CREATE INDEX "idx_review_reports_reporter_user_id" ON "public"."review_reports" USING "btree" ("reporter_user_id");



CREATE INDEX "idx_review_reports_review_id" ON "public"."review_reports" USING "btree" ("review_id");



CREATE INDEX "idx_review_reports_status" ON "public"."review_reports" USING "btree" ("status");



CREATE INDEX "idx_reviews_created" ON "public"."reviews" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_reviews_rating" ON "public"."reviews" USING "btree" ("rating");



CREATE INDEX "idx_reviews_review_type" ON "public"."reviews" USING "btree" ("review_type");



CREATE INDEX "idx_reviews_reviewer_user_id" ON "public"."reviews" USING "btree" ("reviewer_user_id");



CREATE INDEX "idx_reviews_status" ON "public"."reviews" USING "btree" ("status");



CREATE INDEX "idx_reviews_target_id" ON "public"."reviews" USING "btree" ("target_id");



CREATE INDEX "idx_reviews_type_target" ON "public"."reviews" USING "btree" ("review_type", "target_id");



CREATE INDEX "idx_shopping_cart_created" ON "public"."shopping_cart" USING "btree" ("created_at");



CREATE INDEX "idx_shopping_cart_product_id" ON "public"."shopping_cart" USING "btree" ("product_id");



CREATE INDEX "idx_shopping_cart_user_id" ON "public"."shopping_cart" USING "btree" ("user_id");



CREATE INDEX "idx_user_devices_active" ON "public"."user_devices" USING "btree" ("is_active");



CREATE INDEX "idx_user_devices_firebase_token" ON "public"."user_devices" USING "btree" ("firebase_token");



CREATE INDEX "idx_user_devices_last_used" ON "public"."user_devices" USING "btree" ("last_used_at" DESC);



CREATE INDEX "idx_user_devices_user_id" ON "public"."user_devices" USING "btree" ("user_id");



CREATE INDEX "idx_user_profiles_user_id" ON "public"."user_profiles" USING "btree" ("user_id");



CREATE INDEX "idx_user_roles_status" ON "public"."user_roles" USING "btree" ("status");



CREATE INDEX "idx_user_roles_user_id" ON "public"."user_roles" USING "btree" ("user_id");



CREATE INDEX "idx_user_verifications_admin_status" ON "public"."user_verifications" USING "btree" ("admin_verification_status");



CREATE INDEX "idx_user_verifications_ai_status" ON "public"."user_verifications" USING "btree" ("ai_verification_status");



CREATE INDEX "idx_user_verifications_attempt" ON "public"."user_verifications" USING "btree" ("user_role_id", "attempt_number");



CREATE INDEX "idx_user_verifications_confidence" ON "public"."user_verifications" USING "btree" ("ai_confidence_score");



CREATE INDEX "idx_user_verifications_created" ON "public"."user_verifications" USING "btree" ("created_at");



CREATE INDEX "idx_user_verifications_user_role_id" ON "public"."user_verifications" USING "btree" ("user_role_id");



CREATE OR REPLACE TRIGGER "auto_hide_review_trigger" AFTER INSERT ON "public"."review_reports" FOR EACH ROW EXECUTE FUNCTION "public"."auto_hide_reported_review"();



CREATE OR REPLACE TRIGGER "calculate_order_items_line_total" BEFORE INSERT OR UPDATE ON "public"."order_items" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_line_total"();



CREATE OR REPLACE TRIGGER "favorites_count_trigger" AFTER INSERT OR DELETE ON "public"."favorites" FOR EACH ROW EXECUTE FUNCTION "public"."update_favorite_count"();



CREATE OR REPLACE TRIGGER "notification_read_trigger" BEFORE UPDATE ON "public"."notifications" FOR EACH ROW EXECUTE FUNCTION "public"."mark_notification_read"();



CREATE OR REPLACE TRIGGER "update_admin_users_updated_at" BEFORE UPDATE ON "public"."admin_users" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_adoption_listings_updated_at" BEFORE UPDATE ON "public"."adoption_listings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_clinic_profiles_updated_at" BEFORE UPDATE ON "public"."clinic_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_clinic_service_categories_updated_at" BEFORE UPDATE ON "public"."clinic_service_categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_clinic_veterinarians_updated_at" BEFORE UPDATE ON "public"."clinic_veterinarians" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_conversations_updated_at" BEFORE UPDATE ON "public"."conversations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_lost_pet_listings_updated_at" BEFORE UPDATE ON "public"."lost_pet_listings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_messages_updated_at" BEFORE UPDATE ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_order_items_updated_at" BEFORE UPDATE ON "public"."order_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_orders_updated_at" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_payments_updated_at" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_pet_hotel_profiles_updated_at" BEFORE UPDATE ON "public"."pet_hotel_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_pet_hotel_service_categories_updated_at" BEFORE UPDATE ON "public"."pet_hotel_service_categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_pet_shop_profiles_updated_at" BEFORE UPDATE ON "public"."pet_shop_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_pet_sitter_profiles_updated_at" BEFORE UPDATE ON "public"."pet_sitter_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_pet_sitter_service_categories_updated_at" BEFORE UPDATE ON "public"."pet_sitter_service_categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_pet_sitter_services_updated_at" BEFORE UPDATE ON "public"."pet_sitter_services" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_pet_types_updated_at" BEFORE UPDATE ON "public"."pet_types" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_pet_vaccinations_updated_at" BEFORE UPDATE ON "public"."pet_vaccinations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_pets_updated_at" BEFORE UPDATE ON "public"."pets" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_product_categories_updated_at" BEFORE UPDATE ON "public"."product_categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_products_updated_at" BEFORE UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profile_images_updated_at" BEFORE UPDATE ON "public"."profile_images" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_review_replies_updated_at" BEFORE UPDATE ON "public"."review_replies" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_review_reports_updated_at" BEFORE UPDATE ON "public"."review_reports" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_reviews_updated_at" BEFORE UPDATE ON "public"."reviews" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_shopping_cart_updated_at" BEFORE UPDATE ON "public"."shopping_cart" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_devices_updated_at" BEFORE UPDATE ON "public"."user_devices" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_profiles_updated_at" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_roles_updated_at" BEFORE UPDATE ON "public"."user_roles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_verifications_updated_at" BEFORE UPDATE ON "public"."user_verifications" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."admin_activity_logs"
    ADD CONSTRAINT "admin_activity_logs_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."admin_users"
    ADD CONSTRAINT "admin_users_created_by_admin_id_fkey" FOREIGN KEY ("created_by_admin_id") REFERENCES "public"."admin_users"("id");



ALTER TABLE ONLY "public"."adoption_listings"
    ADD CONSTRAINT "adoption_listings_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."adoption_listings"
    ADD CONSTRAINT "adoption_listings_pet_type_id_fkey" FOREIGN KEY ("pet_type_id") REFERENCES "public"."pet_types"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."adoption_listings"
    ADD CONSTRAINT "adoption_listings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clinic_profiles"
    ADD CONSTRAINT "clinic_profiles_user_role_id_fkey" FOREIGN KEY ("user_role_id") REFERENCES "public"."user_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clinic_services"
    ADD CONSTRAINT "clinic_services_clinic_profile_id_fkey" FOREIGN KEY ("clinic_profile_id") REFERENCES "public"."clinic_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clinic_services"
    ADD CONSTRAINT "clinic_services_service_category_id_fkey" FOREIGN KEY ("service_category_id") REFERENCES "public"."clinic_service_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."clinic_veterinarians"
    ADD CONSTRAINT "clinic_veterinarians_clinic_profile_id_fkey" FOREIGN KEY ("clinic_profile_id") REFERENCES "public"."clinic_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversation_participants"
    ADD CONSTRAINT "conversation_participants_participant_role_id_fkey" FOREIGN KEY ("participant_role_id") REFERENCES "public"."user_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_last_message_sender_role_id_fkey" FOREIGN KEY ("last_message_sender_role_id") REFERENCES "public"."user_roles"("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_participant_1_role_id_fkey" FOREIGN KEY ("participant_1_role_id") REFERENCES "public"."user_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_participant_2_role_id_fkey" FOREIGN KEY ("participant_2_role_id") REFERENCES "public"."user_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favorites"
    ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lost_pet_listings"
    ADD CONSTRAINT "lost_pet_listings_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lost_pet_listings"
    ADD CONSTRAINT "lost_pet_listings_pet_type_id_fkey" FOREIGN KEY ("pet_type_id") REFERENCES "public"."pet_types"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."lost_pet_listings"
    ADD CONSTRAINT "lost_pet_listings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_role_id_fkey" FOREIGN KEY ("sender_role_id") REFERENCES "public"."user_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_customer_user_id_fkey" FOREIGN KEY ("customer_user_id") REFERENCES "public"."user_profiles"("user_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pet_shop_profile_id_fkey" FOREIGN KEY ("pet_shop_profile_id") REFERENCES "public"."pet_shop_profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("user_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."pet_hotel_profiles"
    ADD CONSTRAINT "pet_hotel_profiles_user_role_id_fkey" FOREIGN KEY ("user_role_id") REFERENCES "public"."user_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pet_hotel_services"
    ADD CONSTRAINT "pet_hotel_services_pet_hotel_profile_id_fkey" FOREIGN KEY ("pet_hotel_profile_id") REFERENCES "public"."pet_hotel_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pet_hotel_services"
    ADD CONSTRAINT "pet_hotel_services_service_category_id_fkey" FOREIGN KEY ("service_category_id") REFERENCES "public"."pet_hotel_service_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pet_shop_profiles"
    ADD CONSTRAINT "pet_shop_profiles_user_role_id_fkey" FOREIGN KEY ("user_role_id") REFERENCES "public"."user_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pet_sitter_profiles"
    ADD CONSTRAINT "pet_sitter_profiles_user_role_id_fkey" FOREIGN KEY ("user_role_id") REFERENCES "public"."user_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pet_sitter_services"
    ADD CONSTRAINT "pet_sitter_services_pet_sitter_profile_id_fkey" FOREIGN KEY ("pet_sitter_profile_id") REFERENCES "public"."pet_sitter_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pet_sitter_services"
    ADD CONSTRAINT "pet_sitter_services_pet_type_id_fkey" FOREIGN KEY ("pet_type_id") REFERENCES "public"."pet_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pet_sitter_services"
    ADD CONSTRAINT "pet_sitter_services_service_category_id_fkey" FOREIGN KEY ("service_category_id") REFERENCES "public"."pet_sitter_service_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pet_vaccinations"
    ADD CONSTRAINT "pet_vaccinations_pet_id_fkey" FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pets"
    ADD CONSTRAINT "pets_pet_type_id_fkey" FOREIGN KEY ("pet_type_id") REFERENCES "public"."pet_types"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."pets"
    ADD CONSTRAINT "pets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pet_shop_profile_id_fkey" FOREIGN KEY ("pet_shop_profile_id") REFERENCES "public"."pet_shop_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pet_type_id_fkey" FOREIGN KEY ("pet_type_id") REFERENCES "public"."pet_types"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."review_replies"
    ADD CONSTRAINT "review_replies_replier_role_id_fkey" FOREIGN KEY ("replier_role_id") REFERENCES "public"."user_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_replies"
    ADD CONSTRAINT "review_replies_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_reports"
    ADD CONSTRAINT "review_reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."user_profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."review_reports"
    ADD CONSTRAINT "review_reports_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."user_profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shopping_cart"
    ADD CONSTRAINT "shopping_cart_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shopping_cart"
    ADD CONSTRAINT "shopping_cart_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_devices"
    ADD CONSTRAINT "user_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_verifications"
    ADD CONSTRAINT "user_verifications_user_role_id_fkey" FOREIGN KEY ("user_role_id") REFERENCES "public"."user_roles"("id") ON DELETE CASCADE;





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."auto_hide_reported_review"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_hide_reported_review"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_hide_reported_review"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_line_total"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_line_total"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_line_total"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_expired_notifications"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_expired_notifications"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_expired_notifications"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_inactive_devices"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_inactive_devices"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_inactive_devices"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_old_admin_logs"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_admin_logs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_admin_logs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_order_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_order_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_order_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_payment_token"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_payment_token"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_payment_token"() TO "service_role";



GRANT ALL ON FUNCTION "public"."mark_notification_read"() TO "anon";
GRANT ALL ON FUNCTION "public"."mark_notification_read"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_notification_read"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_favorite_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_favorite_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_favorite_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "public"."admin_activity_logs" TO "anon";
GRANT ALL ON TABLE "public"."admin_activity_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_activity_logs" TO "service_role";



GRANT ALL ON TABLE "public"."admin_users" TO "anon";
GRANT ALL ON TABLE "public"."admin_users" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_users" TO "service_role";



GRANT ALL ON TABLE "public"."adoption_listings" TO "anon";
GRANT ALL ON TABLE "public"."adoption_listings" TO "authenticated";
GRANT ALL ON TABLE "public"."adoption_listings" TO "service_role";



GRANT ALL ON TABLE "public"."clinic_profiles" TO "anon";
GRANT ALL ON TABLE "public"."clinic_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."clinic_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."clinic_service_categories" TO "anon";
GRANT ALL ON TABLE "public"."clinic_service_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."clinic_service_categories" TO "service_role";



GRANT ALL ON TABLE "public"."clinic_services" TO "anon";
GRANT ALL ON TABLE "public"."clinic_services" TO "authenticated";
GRANT ALL ON TABLE "public"."clinic_services" TO "service_role";



GRANT ALL ON TABLE "public"."clinic_veterinarians" TO "anon";
GRANT ALL ON TABLE "public"."clinic_veterinarians" TO "authenticated";
GRANT ALL ON TABLE "public"."clinic_veterinarians" TO "service_role";



GRANT ALL ON TABLE "public"."conversation_participants" TO "anon";
GRANT ALL ON TABLE "public"."conversation_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."conversation_participants" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."favorite_counts" TO "anon";
GRANT ALL ON TABLE "public"."favorite_counts" TO "authenticated";
GRANT ALL ON TABLE "public"."favorite_counts" TO "service_role";



GRANT ALL ON TABLE "public"."favorites" TO "anon";
GRANT ALL ON TABLE "public"."favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."favorites" TO "service_role";



GRANT ALL ON TABLE "public"."lost_pet_listings" TO "anon";
GRANT ALL ON TABLE "public"."lost_pet_listings" TO "authenticated";
GRANT ALL ON TABLE "public"."lost_pet_listings" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."order_items" TO "anon";
GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."pet_hotel_profiles" TO "anon";
GRANT ALL ON TABLE "public"."pet_hotel_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."pet_hotel_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."pet_hotel_service_categories" TO "anon";
GRANT ALL ON TABLE "public"."pet_hotel_service_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."pet_hotel_service_categories" TO "service_role";



GRANT ALL ON TABLE "public"."pet_hotel_services" TO "anon";
GRANT ALL ON TABLE "public"."pet_hotel_services" TO "authenticated";
GRANT ALL ON TABLE "public"."pet_hotel_services" TO "service_role";



GRANT ALL ON TABLE "public"."pet_shop_profiles" TO "anon";
GRANT ALL ON TABLE "public"."pet_shop_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."pet_shop_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."pet_sitter_profiles" TO "anon";
GRANT ALL ON TABLE "public"."pet_sitter_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."pet_sitter_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."pet_sitter_service_categories" TO "anon";
GRANT ALL ON TABLE "public"."pet_sitter_service_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."pet_sitter_service_categories" TO "service_role";



GRANT ALL ON TABLE "public"."pet_sitter_services" TO "anon";
GRANT ALL ON TABLE "public"."pet_sitter_services" TO "authenticated";
GRANT ALL ON TABLE "public"."pet_sitter_services" TO "service_role";



GRANT ALL ON TABLE "public"."pet_types" TO "anon";
GRANT ALL ON TABLE "public"."pet_types" TO "authenticated";
GRANT ALL ON TABLE "public"."pet_types" TO "service_role";



GRANT ALL ON TABLE "public"."pet_vaccinations" TO "anon";
GRANT ALL ON TABLE "public"."pet_vaccinations" TO "authenticated";
GRANT ALL ON TABLE "public"."pet_vaccinations" TO "service_role";



GRANT ALL ON TABLE "public"."pets" TO "anon";
GRANT ALL ON TABLE "public"."pets" TO "authenticated";
GRANT ALL ON TABLE "public"."pets" TO "service_role";



GRANT ALL ON TABLE "public"."product_categories" TO "anon";
GRANT ALL ON TABLE "public"."product_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."product_categories" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."profile_images" TO "anon";
GRANT ALL ON TABLE "public"."profile_images" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_images" TO "service_role";



GRANT ALL ON TABLE "public"."review_replies" TO "anon";
GRANT ALL ON TABLE "public"."review_replies" TO "authenticated";
GRANT ALL ON TABLE "public"."review_replies" TO "service_role";



GRANT ALL ON TABLE "public"."review_reports" TO "anon";
GRANT ALL ON TABLE "public"."review_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."review_reports" TO "service_role";



GRANT ALL ON TABLE "public"."reviews" TO "anon";
GRANT ALL ON TABLE "public"."reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."reviews" TO "service_role";



GRANT ALL ON TABLE "public"."shopping_cart" TO "anon";
GRANT ALL ON TABLE "public"."shopping_cart" TO "authenticated";
GRANT ALL ON TABLE "public"."shopping_cart" TO "service_role";



GRANT ALL ON TABLE "public"."system_settings" TO "anon";
GRANT ALL ON TABLE "public"."system_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."system_settings" TO "service_role";



GRANT ALL ON TABLE "public"."user_devices" TO "anon";
GRANT ALL ON TABLE "public"."user_devices" TO "authenticated";
GRANT ALL ON TABLE "public"."user_devices" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."user_verifications" TO "anon";
GRANT ALL ON TABLE "public"."user_verifications" TO "authenticated";
GRANT ALL ON TABLE "public"."user_verifications" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































RESET ALL;

