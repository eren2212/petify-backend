-- =====================================================
-- MAP RPC FUNCTIONS
-- Harita için yakındaki ilanları ve profilleri getiren fonksiyonlar
-- =====================================================

-- PostGIS extension'ı aktif et (eğer yoksa)
CREATE EXTENSION IF NOT EXISTS postgis;

-- =====================================================
-- 1. ADOPTION LISTINGS NEARBY
-- =====================================================
CREATE OR REPLACE FUNCTION get_adoptions_nearby(
    user_lat NUMERIC,
    user_lon NUMERIC,
    search_radius_meters INTEGER DEFAULT 50000
)
RETURNS TABLE(
    id UUID,
    distance NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        ST_Distance(
            a.location,
            ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)::geography
        )::NUMERIC as distance
    FROM adoption_listings a
    WHERE a.is_active = true
      AND a.status = 'active'
      AND a.location IS NOT NULL
      AND ST_DWithin(
          a.location,
          ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)::geography,
          search_radius_meters
      )
    ORDER BY distance ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- 2. LOST PET LISTINGS NEARBY
-- =====================================================
CREATE OR REPLACE FUNCTION get_lost_pets_nearby(
    user_lat NUMERIC,
    user_lon NUMERIC,
    search_radius_meters INTEGER DEFAULT 50000
)
RETURNS TABLE(
    id UUID,
    distance NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        l.id,
        ST_Distance(
            l.location,
            ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)::geography
        )::NUMERIC as distance
    FROM lost_pet_listings l
    WHERE l.is_active = true
      AND l.status = 'active'
      AND l.location IS NOT NULL
      AND ST_DWithin(
          l.location,
          ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)::geography,
          search_radius_meters
      )
    ORDER BY distance ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- 3. CLINIC PROFILES NEARBY
-- =====================================================
CREATE OR REPLACE FUNCTION get_clinics_nearby(
    user_lat NUMERIC,
    user_lon NUMERIC,
    search_radius_meters INTEGER DEFAULT 50000
)
RETURNS TABLE(
    id UUID,
    distance NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        ST_Distance(
            c.location,
            ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)::geography
        )::NUMERIC as distance
    FROM clinic_profiles c
    WHERE c.location IS NOT NULL
      AND ST_DWithin(
          c.location,
          ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)::geography,
          search_radius_meters
      )
    ORDER BY distance ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- 4. PET HOTEL PROFILES NEARBY
-- =====================================================
CREATE OR REPLACE FUNCTION get_hotels_nearby(
    user_lat NUMERIC,
    user_lon NUMERIC,
    search_radius_meters INTEGER DEFAULT 50000
)
RETURNS TABLE(
    id UUID,
    distance NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        h.id,
        ST_Distance(
            h.location,
            ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)::geography
        )::NUMERIC as distance
    FROM pet_hotel_profiles h
    WHERE h.location IS NOT NULL
      AND ST_DWithin(
          h.location,
          ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)::geography,
          search_radius_meters
      )
    ORDER BY distance ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- 5. PET SHOP PROFILES NEARBY
-- =====================================================
CREATE OR REPLACE FUNCTION get_shops_nearby(
    user_lat NUMERIC,
    user_lon NUMERIC,
    search_radius_meters INTEGER DEFAULT 50000
)
RETURNS TABLE(
    id UUID,
    distance NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        ST_Distance(
            s.location,
            ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)::geography
        )::NUMERIC as distance
    FROM pet_shop_profiles s
    WHERE s.location IS NOT NULL
      AND ST_DWithin(
          s.location,
          ST_SetSRID(ST_MakePoint(user_lon, user_lat), 4326)::geography,
          search_radius_meters
      )
    ORDER BY distance ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON FUNCTION get_adoptions_nearby IS 'Kullanıcının konumuna yakın sahiplendirme ilanlarını getirir (default 50km)';
COMMENT ON FUNCTION get_lost_pets_nearby IS 'Kullanıcının konumuna yakın kayıp hayvan ilanlarını getirir (default 50km)';
COMMENT ON FUNCTION get_clinics_nearby IS 'Kullanıcının konumuna yakın veteriner kliniklerini getirir (default 50km)';
COMMENT ON FUNCTION get_hotels_nearby IS 'Kullanıcının konumuna yakın pet otellerini getirir (default 50km)';
COMMENT ON FUNCTION get_shops_nearby IS 'Kullanıcının konumuna yakın pet shopları getirir (default 50km)';

