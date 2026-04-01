-- =====================================================
-- MIGRACIÓN: Normalizar números de teléfono y crear unicidad
-- =====================================================
-- Objetivos:
-- 1) Normalizar y propagar un formato consistente para phone_number y whatsapp_number
-- 2) Añadir índices/constraints únicos para evitar duplicados futuros
-- EJECUTAR con precaución en producción (hacer backup antes).

-- Helper: función para normalizar a dígitos (quita todo excepto dígitos y añade +)
CREATE OR REPLACE FUNCTION normalize_phone(input TEXT) RETURNS TEXT LANGUAGE SQL IMMUTABLE AS $$
  SELECT CASE
    WHEN input IS NULL THEN NULL
    ELSE ('+' || regexp_replace(regexp_replace(input, '[^0-9]+', '', 'g'), '^0+', ''))
  END;
$$;

-- Actualizar filas existentes en patients
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS phone_number_normalized TEXT;

UPDATE patients
SET phone_number_normalized = normalize_phone(phone_number)
WHERE phone_number IS NOT NULL AND (phone_number_normalized IS NULL OR phone_number_normalized = '');

-- Actualizar filas existentes en conversations
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS whatsapp_number_normalized TEXT;

UPDATE conversations
SET whatsapp_number_normalized = normalize_phone(whatsapp_number)
WHERE whatsapp_number IS NOT NULL AND (whatsapp_number_normalized IS NULL OR whatsapp_number_normalized = '');

-- Crear índice único sobre patients.phone_number_normalized
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uq_patients_phone_number_normalized'
  ) THEN
    CREATE UNIQUE INDEX uq_patients_phone_number_normalized ON patients (phone_number_normalized);
  END IF;
END$$;

-- Crear índice único sobre conversations.whatsapp_number_normalized
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'uq_conversations_whatsapp_number_normalized'
  ) THEN
    CREATE UNIQUE INDEX uq_conversations_whatsapp_number_normalized ON conversations (whatsapp_number_normalized);
  END IF;
END$$;

-- Opcional: Forzar trigger para mantener columnas normalizadas en inserts/updates
CREATE OR REPLACE FUNCTION conversations_normalize_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.whatsapp_number_normalized := normalize_phone(NEW.whatsapp_number);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_conversations_normalize BEFORE INSERT OR UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION conversations_normalize_trigger();

CREATE OR REPLACE FUNCTION patients_normalize_trigger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.phone_number_normalized := normalize_phone(NEW.phone_number);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_patients_normalize BEFORE INSERT OR UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION patients_normalize_trigger();

-- Nota: Si la tabla tiene datos duplicados que violen los índices únicos, estos
-- CREATE INDEX fallarán. Revisa e intenta limpiar duplicados antes de aplicar.
