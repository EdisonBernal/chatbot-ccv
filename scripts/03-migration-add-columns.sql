-- =====================================================
-- MIGRACIÓN: Agregar columnas a tabla conversations
-- =====================================================
-- Este script agrega las columnas necesarias para el sistema
-- de indicador de mensajes nuevos en WhatsApp.
-- Ejecutar DESPUÉS de 01-init-database.sql y 02-seed-data.sql

-- Verificar si la columna ya existe (PostgreSQL)
DO $$ 
BEGIN
  -- Agregar last_message si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversations' AND column_name = 'last_message'
  ) THEN
    ALTER TABLE conversations ADD COLUMN last_message text;
  END IF;

  -- Agregar last_view_at si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'conversations' AND column_name = 'last_view_at'
  ) THEN
    ALTER TABLE conversations ADD COLUMN last_view_at timestamp with time zone DEFAULT NULL;
  END IF;
END $$;

-- Crear índice para mejorar búsquedas por estado y mensaje reciente
CREATE INDEX IF NOT EXISTS idx_conversations_status_last_message 
  ON conversations(status, last_message_at DESC);

-- Crear índice para búsquedas de conversaciones sin leer
CREATE INDEX IF NOT EXISTS idx_conversations_unread
  ON conversations(last_message_at, last_view_at)
  WHERE last_message_at IS NOT NULL AND (last_view_at IS NULL OR last_message_at > last_view_at);

-- Comentarios sobre las columnas nuevas
COMMENT ON COLUMN conversations.last_message IS 'Último mensaje en la conversación';
COMMENT ON COLUMN conversations.last_view_at IS 'Última vez que un staff vio esta conversación. Si es NULL o < last_message_at, hay mensajes nuevos';
